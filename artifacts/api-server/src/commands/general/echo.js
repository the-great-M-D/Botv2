export default {
  name: "echo",
  description: "Echo text",
  execute: async ({ sock, msg, sender, args }) => {
    const jid = msg.key.remoteJid;
    await sock.sendMessage(jid, {
      text: args.join(" ") || "Say something 🤡",
    }, { quoted: msg });
  },
};
