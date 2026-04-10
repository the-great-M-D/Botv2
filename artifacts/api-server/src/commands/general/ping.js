// src/commands/ping.ts

export default {
  name: "ping",
  description: "Check bot response",
  execute: async ({ sock, sender, args }) => {
    await sock.sendMessage(sender, { text: "Bot is alive 👋😀!" });
  },
};
