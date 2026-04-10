// src/commands/echo.ts

export default {
  name: "echo",
  description: "Echo text",
  execute: async ({ sock, sender, args }) => {
    await sock.sendMessage(sender, {
      text: args.join(" ") || "Say something 🤡",
    });
  },
};
