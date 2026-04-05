import { handleCommand } from "./commandHandler";

export async function handleMessage({
  sock,
  msg,
  text,
  commands,
  prefix,
  db,
  tables,
  getBotInfo,
}) {
  const isCommand = await handleCommand({
    sock,
    msg,
    text,
    commands,
    prefix,
    db,
    tables,
    getBotInfo,
  });

  if (isCommand) return;

  console.log("Normal message:", text);
}
