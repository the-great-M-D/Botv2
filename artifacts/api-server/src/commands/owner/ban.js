export default {
  ownerOnly: true,
  name: "ban",
  description: "[Admin] Block a user from messaging the bot. Usage: !ban <phone_number>",
  execute: async ({ sock, msg, sender, args }) => {
    const jid = msg.key.remoteJid;
    const phone = args[0]?.replace(/\D/g, "");

    if (!phone) {
      return sock.sendMessage(jid, {
        text: "Usage: !ban <phone_number>\nExample: !ban 27600000000",
      }, { quoted: msg });
    }

    const targetJid = `${phone}@s.whatsapp.net`;
    try {
      await sock.updateBlockStatus(targetJid, "block");
      await sock.sendMessage(jid, { text: `🚫 Blocked: +${phone}` }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Failed to block: ${err.message}` }, { quoted: msg });
    }
  },
};
