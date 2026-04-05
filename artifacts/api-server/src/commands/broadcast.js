import { isAdmin } from "../utils/admin.js";

export default {
  name: "broadcast",
  description: "[Admin] Send a message to all contacts. Usage: !broadcast <message>",
  execute: async ({ sock, sender, args, db, tables }) => {
    if (!isAdmin(sender)) {
      return sock.sendMessage(sender, { text: "⛔ Admin only." });
    }

    const message = args.join(" ").trim();

    if (!message) {
      return sock.sendMessage(sender, { text: "Usage: !broadcast <message>" });
    }

    const { waContactsTable } = tables;
    const contacts = await db.select().from(waContactsTable);

    if (!contacts.length) {
      return sock.sendMessage(sender, { text: "No contacts to broadcast to." });
    }

    await sock.sendMessage(sender, {
      text: `📢 Broadcasting to ${contacts.length} contact(s)...`,
    });

    let sent = 0;
    let failed = 0;

    for (const contact of contacts) {
      try {
        await sock.sendMessage(contact.jid, { text: message });
        sent++;
        await delay(500);
      } catch {
        failed++;
      }
    }

    await sock.sendMessage(sender, {
      text: `✅ Broadcast complete.\n• Sent: ${sent}\n• Failed: ${failed}`,
    });
  },
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
