export default {
  ownerOnly: true,
  name: "clearmsgs",
  description: "[Admin] Clear all stored message history from the database",
  execute: async ({ sock, msg, sender, args, db, tables }) => {
    const jid = msg.key.remoteJid;
    const confirm = args[0]?.toLowerCase();

    if (confirm !== "confirm") {
      return sock.sendMessage(jid, {
        text: "⚠️ This will delete ALL message history.\nType *!clearmsgs confirm* to proceed.",
      }, { quoted: msg });
    }

    const { waMessagesTable } = tables;
    await db.delete(waMessagesTable);
    await sock.sendMessage(jid, { text: "🗑️ All message history has been cleared." }, { quoted: msg });
  },
};
