import { eq } from "drizzle-orm";

export default {
  ownerOnly: true,
  name: "setprefix",
  description: "[Admin] Change the command prefix. Usage: !setprefix <new_prefix>",
  execute: async ({ sock, msg, sender, args, db, tables }) => {
    const jid = msg.key.remoteJid;
    const newPrefix = args[0]?.trim();

    if (!newPrefix) {
      return sock.sendMessage(jid, { text: "Usage: !setprefix <new_prefix>\nExample: !setprefix /" }, { quoted: msg });
    }

    if (newPrefix.length > 3) {
      return sock.sendMessage(jid, { text: "⚠️ Prefix must be 1–3 characters." }, { quoted: msg });
    }

    const { waConfigTable } = tables;
    await db.update(waConfigTable).set({ prefix: newPrefix })
      .where(eq(waConfigTable.id, "singleton"));

    await sock.sendMessage(jid, {
      text: `✅ Prefix updated to: *${newPrefix}*\nNew command example: ${newPrefix}ping\n\n⚠️ Restart the bot for the new prefix to take effect.`,
    }, { quoted: msg });
  },
};
