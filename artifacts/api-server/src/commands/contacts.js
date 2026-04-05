import { desc } from "drizzle-orm";
import { isAdmin } from "../utils/admin.js";

export default {
  name: "contacts",
  description: "[Admin] List top 10 contacts by message count",
  execute: async ({ sock, sender, db, tables }) => {
    if (!isAdmin(sender)) {
      return sock.sendMessage(sender, { text: "⛔ Admin only." });
    }

    const { waContactsTable } = tables;

    const rows = await db
      .select()
      .from(waContactsTable)
      .orderBy(desc(waContactsTable.messageCount))
      .limit(10);

    if (!rows.length) {
      return sock.sendMessage(sender, { text: "No contacts yet." });
    }

    const lines = ["*📒 Top Contacts*\n"];
    rows.forEach((c, i) => {
      const label = c.name ? `${c.name} (${c.phoneNumber})` : c.phoneNumber;
      lines.push(`${i + 1}. ${label} — ${c.messageCount} msg(s)`);
    });

    await sock.sendMessage(sender, { text: lines.join("\n") });
  },
};
