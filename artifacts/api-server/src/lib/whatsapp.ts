import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import {
  waMessagesTable,
  waContactsTable,
  waConfigTable,
  waAutoRepliesTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logger } from "./logger";

import { loadCommands } from "../utils/loader";
import { handleMessage } from "../handlers/messageHandler";


const AUTH_DIR = path.resolve(process.cwd(), "wa_auth");

export type BotState = "disconnected" | "connecting" | "awaiting_pairing" | "connected";

export interface BotInfo {
  state: BotState;
  phoneNumber?: string;
  deviceName?: string;
  platform?: string;
  connectedAt?: Date;
}

type SseClient = {
  id: string;
  write: (event: string, data: unknown) => void;
};

let socket: WASocket | null = null;
let botInfo: BotInfo = { state: "disconnected" };
const sseClients: SseClient[] = [];

export function getBotInfo(): BotInfo {
  return { ...botInfo };
}

export function addSseClient(client: SseClient) {
  sseClients.push(client);
  logger.info({ clientId: client.id }, "SSE client connected");
}

export function removeSseClient(id: string) {
  const idx = sseClients.findIndex((c) => c.id === id);
  if (idx !== -1) sseClients.splice(idx, 1);
  logger.info({ clientId: id }, "SSE client disconnected");
}

function broadcast(event: string, data: unknown) {
  for (const client of sseClients) {
    try {
      client.write(event, data);
    } catch {
      // client gone — will be cleaned up on disconnect
    }
  }
}

function setBotState(update: Partial<BotInfo>) {
  botInfo = { ...botInfo, ...update };
  broadcast("status", botInfo);
}

async function upsertContact(jid: string, name?: string | null) {
  const phoneNumber = jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
  const existing = await db.select().from(waContactsTable).where(eq(waContactsTable.jid, jid));
  if (existing.length === 0) {
    await db.insert(waContactsTable).values({
      id: randomUUID(),
      jid,
      name: name ?? null,
      phoneNumber,
      messageCount: 1,
      lastMessageAt: new Date(),
    }).onConflictDoNothing();
  } else {
    await db.update(waContactsTable)
      .set({
        messageCount: sql`${waContactsTable.messageCount} + 1`,
        lastMessageAt: new Date(),
        ...(name ? { name } : {}),
      })
      .where(eq(waContactsTable.jid, jid));
  }
}

async function checkAutoReply(content: string, groupName?: string | null): Promise<string | null> {
  const rules = await db.select().from(waAutoRepliesTable).where(eq(waAutoRepliesTable.enabled, true));

  for (const rule of rules) {
    const text = rule.caseSensitive ? content : content.toLowerCase();
    const trigger = rule.caseSensitive ? rule.trigger : rule.trigger.toLowerCase();

    let matched = false;
    if (rule.matchType === "exact") matched = text === trigger;
    else if (rule.matchType === "contains") matched = text.includes(trigger);
    else if (rule.matchType === "startsWith") matched = text.startsWith(trigger);
    else if (rule.matchType === "regex") {
      try {
        matched = new RegExp(rule.trigger, rule.caseSensitive ? "" : "i").test(content);
      } catch {
        matched = false;
      }
    }

    if (matched) {
      await db.update(waAutoRepliesTable)
        .set({ hitCount: sql`${waAutoRepliesTable.hitCount} + 1` })
        .where(eq(waAutoRepliesTable.id, rule.id));
      const prefix = groupName ? `[${groupName}] ` : "";
      return `${prefix}${rule.response}`;
    }
  }
  return null;
}

// ── Message extraction helpers ────────────────────────────────────────────────
//
// Baileys wraps the actual message content in different outer layers depending
// on: the WhatsApp client version, whether the message is ephemeral (disappearing),
// whether it's view-once, and whether it has a caption or not.
//
// The strategy here is to first "unwrap" any outer container (ephemeral /
// view-once) to get to the real inner content, then pull fields from all known
// document and text shapes. This is safer than a long optional-chain because if
// Baileys ever changes its shape we'll catch it in the diagnostic logs below.

function unwrapMessage(m: any): any {
  if (!m) return m;
  // Disappearing messages nest the real content under ephemeralMessage.message
  if (m.ephemeralMessage?.message) return unwrapMessage(m.ephemeralMessage.message);
  // View-once messages do the same under viewOnceMessage.message
  if (m.viewOnceMessage?.message) return unwrapMessage(m.viewOnceMessage.message);
  if (m.viewOnceMessageV2?.message) return unwrapMessage(m.viewOnceMessageV2.message);
  return m;
}

function extractText(m: any): string | null {
  if (!m) return null;
  const inner = unwrapMessage(m);
  // Each branch here corresponds to a different Baileys message shape.
  // We return the first non-nullish value, or null if there's genuinely no text.
  return (
    inner.conversation ??                                               // plain text message
    inner.extendedTextMessage?.text ??                                 // reply / link preview
    inner.imageMessage?.caption ??                                     // photo with caption
    inner.videoMessage?.caption ??                                     // video with caption
    inner.documentMessage?.caption ??                                  // document with inline caption
    inner.documentWithCaptionMessage?.message?.documentMessage?.caption ?? // doc + caption (newer clients)
    null
  );
}

function extractFileName(m: any): string | null {
  if (!m) return null;
  const inner = unwrapMessage(m);
  return (
    inner.documentMessage?.fileName ??
    inner.documentWithCaptionMessage?.message?.documentMessage?.fileName ??
    null
  );
}

function isDocumentMessage(m: any): boolean {
  if (!m) return false;
  const inner = unwrapMessage(m);
  return !!(
    inner.documentMessage ||
    inner.documentWithCaptionMessage?.message?.documentMessage
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export async function connectBot(): Promise<void> {
  console.log("🚀 connectBot CALLED");
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

  const commands = await loadCommands();
  console.log("🔥 COMMANDS LOADED:", [...commands.keys()]);

  const { version } = await fetchLatestBaileysVersion();
  const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  setBotState({ state: "connecting" });

  socket = makeWASocket({
    version,
    auth: authState,
    printQRInTerminal: false,
    logger: logger.child({ module: "baileys" }) as never,
    getMessage: async () => undefined,
  });

  socket.ev.on("creds.update", saveCreds);

  socket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

      logger.info({ shouldReconnect }, "Connection closed");

      if (shouldReconnect) {
        setBotState({ state: "disconnected" });
        setTimeout(() => connectBot(), 5000);
      } else {
        setBotState({ state: "disconnected", phoneNumber: undefined, deviceName: undefined });
        clearAuth();
      }
    }

    if (connection === "open") {
      const me = socket?.user;
      setBotState({
        state: "connected",
        phoneNumber: me?.id?.replace(":0@s.whatsapp.net", "").replace("@s.whatsapp.net", "") ?? undefined,
        deviceName: me?.name ?? undefined,
        connectedAt: new Date(),
      });
      logger.info({ phone: botInfo.phoneNumber }, "WhatsApp connected");
    }
  });

  socket.ev.on("messages.upsert", async ({ messages: rawMessages, type }) => {
    let messages = rawMessages;
    console.log("📨 upsert type:", type, "| count:", messages.length);

    // "notify" = live incoming message (always process)
    // "append" = used by some WA clients when sending files (process if recent)
    // anything else (e.g. history sync batches) = skip
    if (type !== "notify" && type !== "append") return;

    // For "append" messages, only process if the message timestamp is within
    // the last 60 seconds — this filters out history sync replays on reconnect
    // while still catching real file sends that arrive as "append"
    if (type === "append") {
      const now = Math.floor(Date.now() / 1000);
      const recentMessages = messages.filter(m => {
        const ts = (m.messageTimestamp as number) ?? 0;
        return now - ts < 60; // within last 60 seconds
      });
      if (recentMessages.length === 0) {
        console.log("⏩ append skipped — all messages older than 60s (history sync)");
        return;
      }
      // Replace messages array with only the recent ones
      messages = recentMessages;
    }

    // FIX: was "singleton" — schema defines the config row ID as "default"
    const config = await db
      .select()
      .from(waConfigTable)
      .where(eq(waConfigTable.id, "default"));

    const cfg = config[0];
    const prefix = cfg?.prefix || "!";

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const jid = msg.key.remoteJid ?? "";
      if (!jid || jid === "status@broadcast") continue;

      const pushName = msg.pushName ?? null;

      // ── Diagnostic log — shows the raw Baileys message shape ────────────
      // This tells us exactly which keys are present so we can confirm our
      // extraction helpers are matching the right shape. Remove once confirmed.
      console.log("📦 msg.message keys:", Object.keys(msg.message));

      // ── Extract content using our defensive helper functions ─────────────
      const textContent  = extractText(msg.message);
      const docFileName  = extractFileName(msg.message);
      const isDocument   = isDocumentMessage(msg.message);

      // Confirm what was extracted — essential for debugging scanner misses
      console.log("🔍 extracted:", { textContent, docFileName, isDocument });

      // content is what we store in the DB and display in the dashboard
      const content = textContent ?? "[media]";

      // 🧾 Save / update contact record
      await upsertContact(jid, pushName);

      // 💾 Save inbound message to DB
      const msgId = randomUUID();
      await db.insert(waMessagesTable).values({
        id: msgId,
        remoteJid: jid,
        contactName: pushName,
        content,
        direction: "inbound",
        messageType: "text",
        status: "delivered",
        isAutoReply: false,
      });

      // ── Scanner logic 🚩 ─────────────────────────────────────────────────
      //
      // We concatenate the caption text AND the filename into a single string
      // before scanning. This means a file called "router.hat" with no caption
      // still triggers the keyword match because the filename itself contains
      // the keyword ".hat".
      //
      // Document forwarding is intentionally decoupled from the keyword check.
      // Any document gets forwarded to the owner regardless of whether its
      // filename or caption matched a keyword — the interesting thing is the
      // file itself, and we don't want to miss it just because the sender
      // didn't type a caption.

      const scanKeywords = ["snif", "decrypt", "unlimited", "bdnet", "telkom", "mtn", ".hat", ".bdnet", ".tls", ".stk"];
      const textToScan = `${textContent ?? ""} ${docFileName ?? ""}`.toLowerCase().trim();
      const matchedKeywords = scanKeywords.filter(kw => textToScan.includes(kw));
      const hasKeywordMatch = matchedKeywords.length > 0;

      console.log("🚩 scanner:", { textToScan, matchedKeywords, hasKeywordMatch, isDocument });

      if ((hasKeywordMatch || isDocument) && socket) {
        const ownerJid = "27697834825@s.whatsapp.net";
        const senderInfo = jid.endsWith("@g.us")
          ? `Group: ${jid}`
          : `Private: ${pushName || jid}`;

        // Send the keyword alert message only when something actually matched
        if (hasKeywordMatch) {
          await socket.sendMessage(ownerJid, {
            text:
              `🚩 *File Scanner Alert*\n\n` +
              `*Match:* ${matchedKeywords.join(", ")}\n` +
              `*From:* ${senderInfo}\n` +
              `*File:* ${docFileName ?? "n/a"}\n` +
              `*Content:* ${textContent ?? "[no caption]"}`,
          });
        }

        // Always forward any document attachment to the owner for inspection,
        // even if no keyword matched in the caption or filename
        if (isDocument) {
          await socket.sendMessage(ownerJid, { forward: msg });
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      broadcast("message", {
        id: msgId,
        remoteJid: jid,
        contactName: pushName,
        content,
        direction: "inbound",
        messageType: "text",
        status: "delivered",
        isAutoReply: false,
        createdAt: new Date().toISOString(),
      });

      // 🚀 Command handler — runs before auto-reply, skips non-text messages
      if (textContent) {
        const handled = await handleMessage({
          sock: socket!,
          msg,
          text: textContent,
          commands,
          prefix,
          db,
          tables: { waMessagesTable, waContactsTable, waAutoRepliesTable, waConfigTable },
          getBotInfo,
        });

        if (handled) {
          logger.info({ jid, content: textContent }, "Command handled");
          continue; // ⛔ Command matched — skip auto-reply for this message
        }
      }

      // 🤖 Auto-reply — only runs if no command matched, and only on text
      if (cfg?.autoReplyEnabled !== false && textContent) {
        let groupName: string | null = null;
        if (jid.endsWith("@g.us")) {
          try {
            const meta = await socket!.groupMetadata(jid);
            groupName = meta.subject ?? null;
          } catch { /* ignore */ }
        }
        const reply = await checkAutoReply(textContent, groupName);

        if (reply && socket) {
          if (cfg?.typingIndicatorEnabled) {
            await socket.sendPresenceUpdate("composing", jid);
            await new Promise((r) => setTimeout(r, 800));
            await socket.sendPresenceUpdate("paused", jid);
          }

          await socket.sendMessage(jid, { text: reply });

          const replyId = randomUUID();
          await db.insert(waMessagesTable).values({
            id: replyId,
            remoteJid: jid,
            contactName: pushName,
            content: reply,
            direction: "outbound",
            messageType: "text",
            status: "sent",
            isAutoReply: true,
          });

          broadcast("message", {
            id: replyId,
            remoteJid: jid,
            contactName: pushName,
            content: reply,
            direction: "outbound",
            messageType: "text",
            status: "sent",
            isAutoReply: true,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  });
}

export async function requestPairingCode(phoneNumber: string): Promise<string> {
  if (!socket) {
    await connectBot();
    await new Promise((r) => setTimeout(r, 2000));
  }

  const cleaned = phoneNumber.replace(/\D/g, "");
  setBotState({ state: "awaiting_pairing" });

  const code = await socket!.requestPairingCode(cleaned);
  broadcast("pairing_code", { code });
  return code;
}

export async function sendMessage(to: string, content: string): Promise<void> {
  if (!socket || botInfo.state !== "connected") {
    throw new Error("Bot is not connected");
  }
  const jid = to.includes("@") ? to : `${to.replace(/\D/g, "")}@s.whatsapp.net`;
  await socket.sendMessage(jid, { text: content });
}

export async function logoutBot(): Promise<void> {
  if (socket) {
    await socket.logout().catch(() => {});
    socket = null;
  }
  clearAuth();
  setBotState({
    state: "disconnected",
    phoneNumber: undefined,
    deviceName: undefined,
    connectedAt: undefined,
  });
}

function clearAuth() {
  if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  }
}

export function getSocket(): WASocket | null {
  return socket;
}

