import { isAdmin } from "../utils/admin.js";

export default {
  name: "clearmsgs",
  description: "[Admin] Clear all stored message history from the database",
  execute: async ({ sock, sender, args, db, tables }) => {
    if (!isAdmin(sender)) {
      return sock.sendMessage(sender, { text: "⛔ Admin only." });
    }

    const confirm = args[0]?.toLowerCase();

    if (confirm !== "confirm") {
      return sock.sendMessage(sender, {
        text: "⚠️ This will delete ALL message history.\nType *!clearmsgs confirm* to proceed.",
      });
    }

    const { waMessagesTable } = tables;
    await db.delete(waMessagesTable);

    await sock.sendMessage(sender, { text: "🗑️ All message history has been cleared." });
  },
};
