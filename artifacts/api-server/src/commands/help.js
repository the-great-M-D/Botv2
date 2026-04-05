export default {
  name: "help",
  description: "List all available commands",
  execute: async ({ sock, sender, args, commands }) => {
    const lines = ["*🤖 Bot Commands*\n"];
    for (const [name, cmd] of commands.entries()) {
      lines.push(`• *!${name}* — ${cmd.description || "No description"}`);
    }
    await sock.sendMessage(sender, { text: lines.join("\n") });
  },
};
