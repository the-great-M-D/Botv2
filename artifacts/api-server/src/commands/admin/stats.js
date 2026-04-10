import { count, eq } from "drizzle-orm";
//import { isAdmin } from "../utils/admin.js";

export default {
  onwerOnly: true,
  adminOnly: true,
  name: "stats",
  description: "[Admin] Show message and contact stats",
  execute: async ({ sock, sender, db, tables }) => {
    

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

    await sock.sendMessage(sender, { text: lines.join("\n") });
  },
};
