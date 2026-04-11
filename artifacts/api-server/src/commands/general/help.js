export default {
  name: "help",
  description: "List all available commands",
  execute: async ({ sock, msg, sender, args, commands }) => {
    const jid = msg.key.remoteJid;
    const lines = ["*🤖 Bot Commands*\n"];
    for (const [name, cmd] of commands.entries()) {
      lines.push(`• *!${name}* — ${cmd.description || "No description"}`);
    }
    await sock.sendMessage(jid, { text: lines.join("\n") }, { quoted: msg });
  },
};
