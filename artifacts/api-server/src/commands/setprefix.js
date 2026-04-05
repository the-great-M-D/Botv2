import { eq } from "drizzle-orm";
import { isAdmin } from "../utils/admin.js";

export default {
  name: "setprefix",
  description: "[Admin] Change the command prefix. Usage: !setprefix <new_prefix>",
  execute: async ({ sock, sender, args, db, tables }) => {
    if (!isAdmin(sender)) {
      return sock.sendMessage(sender, { text: "⛔ Admin only." });
    }

    const newPrefix = args[0]?.trim();

    if (!newPrefix) {
      return sock.sendMessage(sender, { text: "Usage: !setprefix <new_prefix>\nExample: !setprefix /" });
    }

    if (newPrefix.length > 3) {
      return sock.sendMessage(sender, { text: "⚠️ Prefix must be 1–3 characters." });
    }

    const { waConfigTable } = tables;

    await db
      .update(waConfigTable)
      .set({ prefix: newPrefix })
      .where(eq(waConfigTable.id, "singleton"));

    await sock.sendMessage(sender, {
      text: `✅ Prefix updated to: *${newPrefix}*\nNew command example: ${newPrefix}ping\n\n⚠️ Restart the bot for the new prefix to take effect.`,
    });
  },
};
