import { count, eq } from "drizzle-orm";

export default {
  adminOnly: true,
  name: "stats",
  description: "[Admin] Show message and contact stats",
  execute: async ({ sock, msg, sender, db, tables }) => {
    const jid = msg.key.remoteJid;
    const { waMessagesTable, waContactsTable, waAutoRepliesTable } = tables;

    const [[{ total: totalMsgs }], [{ total: inbound }], [{ total: outbound }], [{ total: contacts }], [{ total: replies }]] =
      await Promise.all([
        db.select({ total: count() }).from(waMessagesTable),
        db.select({ total: count() }).from(waMessagesTable).where(eq(waMessagesTable.direction, "inbound")),
        db.select({ total: count() }).from(waMessagesTable).where(eq(waMessagesTable.direction, "outbound")),
        db.select({ total: count() }).from(waContactsTable),
        db.select({ total: count() }).from(waAutoRepliesTable),
      ]);

    const lines = [
      "*📊 Bot Statistics*",
      `• Total messages: *${totalMsgs}*`,
      `• Inbound: *${inbound}*`,
      `• Outbound: *${outbound}*`,
      `• Contacts: *${contacts}*`,
      `• Auto-reply rules: *${replies}*`,
    ];

    await sock.sendMessage(jid, { text: lines.join("\n") }, { quoted: msg });
  },
};
