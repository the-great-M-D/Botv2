import type { WASocket } from "@whiskeysockets/baileys";

export interface BotCommand {
  name: string;
  description: string;
  usage?: string;

  // Access control flags — checked by commandHandler before execute() is called
  ownerOnly?: boolean;  // only the bot owner (OWNER_JID) can run this
  adminOnly?: boolean;  // only group admins (or owner) can run this
  groupOnly?: boolean;  // command only works inside a group chat
  privateOnly?: boolean; // command only works in private/DM chat
}

export interface CommandContext {
  sock: WASocket;
  msg: any;
  sender: string;       // full JID of who sent the message e.g. "2761...@s.whatsapp.net"
  args: string[];       // words after the command name
  commands: Map<string, BotCommand & { execute: (ctx: CommandContext) => Promise<void> }>;
  db: any;
  tables: any;
  getBotInfo: () => any;

  // Resolved by commandHandler — ready to use inside execute()
  isOwner: boolean;     // sender JID matches OWNER_JID
  isAdmin: boolean;     // sender is a group admin (always false in private chats)
  isGroup: boolean;     // message came from a group chat
  prefix: string;
}

