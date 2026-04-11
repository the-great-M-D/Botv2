import { eq } from "drizzle-orm";

export default {
  ownerOnly: true,
  adminOnly: true,
  name: "delreply",
  description: "[Admin] Delete auto-reply rule by trigger. Usage: !delreply <trigger>",
  execute: async ({ sock, msg, sender, args, db, tables }) => {
    const jid = msg.key.remoteJid;
    const trigger = args.join(" ").trim();

    if (!trigger) {
      return sock.sendMessage(jid, { text: "Usage: !delreply <trigger>" }, { quoted: msg });
    }

    const { waAutoRepliesTable } = tables;
    const deleted = await db.delete(waAutoRepliesTable)
      .where(eq(waAutoRepliesTable.trigger, trigger)).returning();

    if (!deleted.length) {
      return sock.sendMessage(jid, { text: `⚠️ No rule found with trigger: "${trigger}"` }, { quoted: msg });
    }

    await sock.sendMessage(jid, { text: `🗑️ Deleted auto-reply rule: "${trigger}"` }, { quoted: msg });
  },
};
