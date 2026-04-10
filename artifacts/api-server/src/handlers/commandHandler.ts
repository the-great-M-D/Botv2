import { jidNormalizedUser } from "@whiskeysockets/baileys";

const OWNER_JID = "27697834825@s.whatsapp.net";

async function resolveIsAdmin(sock: any, jid: string, sender: string): Promise<boolean> {
  if (!jid.endsWith("@g.us")) return false;

  try {
    const metadata = await sock.groupMetadata(jid);

    // Normalize the incoming sender so @lid and @s.whatsapp.net both reduce
    // to the same bare phone number before we compare
    const normalizedSender = jidNormalizedUser(sender);

    const participant = metadata.participants.find((p: any) => {
      // Also normalize each participant's ID for the same reason —
      // the metadata itself might mix formats depending on Baileys version
      return jidNormalizedUser(p.id) === normalizedSender;
    });

    return participant?.admin === "admin" || participant?.admin === "superadmin";
  } catch {
    return false;
  }
}

export async function handleCommand({ sock, msg, text, commands, prefix, db, tables, getBotInfo }) {
  if (!text.startsWith(prefix)) return false;

  const jid    = msg.key.remoteJid!;
  const sender = msg.key.participant ?? jid;

  // Normalize here too so the isOwner comparison is format-agnostic
  const normalizedSender = jidNormalizedUser(sender);
  const normalizedOwner  = jidNormalizedUser(OWNER_JID);

  const args = text.slice(prefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();
  if (!commandName) return false;

  const command = commands.get(commandName);
  if (!command) {
    await sock.sendMessage(jid, { text: "Unknown command 🤨" });
    return true;
  }

  const isOwner = normalizedSender === normalizedOwner;
  const isGroup = jid.endsWith("@g.us");
  const isAdmin = isOwner || (isGroup ? await resolveIsAdmin(sock, jid, sender) : false);

  console.log(`⚙️ command: ${commandName} | sender: ${sender} | normalized: ${normalizedSender} | isOwner: ${isOwner} | isAdmin: ${isAdmin} | isGroup: ${isGroup}`);

  if (command.ownerOnly && !isOwner) {
    await sock.sendMessage(jid, { text: "🔒 This command is restricted to the bot owner." });
    return true;
  }
  if (command.adminOnly && !isAdmin) {
    await sock.sendMessage(jid, { text: "🔒 This command is for group admins only." });
    return true;
  }
  if (command.groupOnly && !isGroup) {
    await sock.sendMessage(jid, { text: "👥 This command can only be used in a group." });
    return true;
  }
  if (command.privateOnly && isGroup) {
    await sock.sendMessage(jid, { text: "🔐 This command can only be used in private chat." });
    return true;
  }

  try {
    await command.execute({ sock, msg, sender, args, commands, db, tables, getBotInfo, isOwner, isAdmin, isGroup, prefix });
  } catch (err) {
    console.error("❌ Command error:", err);
    await sock.sendMessage(jid, { text: "Command failed 💀" });
  }

  return true;
}
