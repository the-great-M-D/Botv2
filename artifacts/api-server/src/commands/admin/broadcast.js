export default {
  ownerOnly: true,
  adminOnly: true,
  name: "broadcast",
  description: "[Admin] Send a message to all contacts. Usage: !broadcast <message>",
  execute: async ({ sock, msg, sender, args, db, tables }) => {
    const jid = msg.key.remoteJid;
    const message = args.join(" ").trim();

    if (!message) {
      return sock.sendMessage(jid, { text: "Usage: !broadcast <message>" }, { quoted: msg });
    }

    const { waContactsTable } = tables;
    const contacts = await db.select().from(waContactsTable);

    if (!contacts.length) {
      return sock.sendMessage(jid, { text: "No contacts to broadcast to." }, { quoted: msg });
    }

    await sock.sendMessage(jid, {
      text: `📢 Broadcasting to ${contacts.length} contact(s)...`,
    }, { quoted: msg });

    let sent = 0, failed = 0;
    for (const contact of contacts) {
      try {
        await sock.sendMessage(contact.jid, { text: message });
        sent++;
        await delay(500);
      } catch { failed++; }
    }

    await sock.sendMessage(jid, {
      text: `✅ Broadcast complete.\n• Sent: ${sent}\n• Failed: ${failed}`,
    }, { quoted: msg });
  },
};

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
