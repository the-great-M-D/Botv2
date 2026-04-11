export default {
  name: "ping",
  description: "Check bot response",
  execute: async ({ sock, msg, sender }) => {
    const jid = msg.key.remoteJid;
    await sock.sendMessage(jid, { text: "Bot is alive 👋😀!" }, { quoted: msg });
  },
};
