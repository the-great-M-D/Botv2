import { eq } from "drizzle-orm";

export default {
  ownerOnly: true,
  adminOnly: true,
  name: "togglereply",
  description: "[Admin] Enable or disable an auto-reply rule. Usage: !togglereply <trigger>",
  execute: async ({ sock, msg, sender, args, db, tables }) => {
    const jid = msg.key.remoteJid;
    const trigger = args.join(" ").trim();

    if (!trigger) {
      return sock.sendMessage(jid, { text: "Usage: !togglereply <trigger>" }, { quoted: msg });
    }

    const { waAutoRepliesTable } = tables;
    const rows = await db.select().from(waAutoRepliesTable)
      .where(eq(waAutoRepliesTable.trigger, trigger));

    if (!rows.length) {
      return sock.sendMessage(jid, { text: `⚠️ No rule found with trigger: "${trigger}"` }, { quoted: msg });
    }

    const newState = !rows[0].enabled;
    await db.update(waAutoRepliesTable).set({ enabled: newState })
      .where(eq(waAutoRepliesTable.trigger, trigger));

    await sock.sendMessage(jid, {
      text: `${newState ? "✅ Enabled" : "❌ Disabled"} auto-reply rule: "${trigger}"`,
    }, { quoted: msg });
  },
};
