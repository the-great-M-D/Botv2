// src/handlers/messageHandler.ts

import { handleCommand } from "./commandHandler";

export async function handleMessage({
  sock,
  msg,
  text,
  commands,
  prefix,
}) {
  // COMMAND FIRST (priority)
  const isCommand = await handleCommand({
    sock,
    msg,
    text,
    commands,
    prefix,
  });

  if (isCommand) return;

  // 👇 fallback (auto replies / DB logic)
  console.log("Normal message:", text);
}
