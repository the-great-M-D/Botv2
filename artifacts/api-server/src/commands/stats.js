import { count, eq } from "drizzle-orm";
import { isAdmin } from "../utils/admin.js";

export default {
  name: "stats",
  description: "[Admin] Show message and contact stats",
  execute: async ({ sock, sender, db, tables }) => {
    if (!isAdmin(sender)) {
      return sock.sendMessage(sender, { text: "⛔ Admin only." });
    }

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
