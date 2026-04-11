export default {
  name: "id",
  description: "Show your WhatsApp ID",
  execute: async ({ sock, msg, sender }) => {
    const jid = msg.key.remoteJid;
    const number = sender.split("@")[0];
    await sock.sendMessage(jid, {
      text: `📱 *Your WhatsApp ID:*\n\n${number}`
    }, { quoted: msg });
  },
};
