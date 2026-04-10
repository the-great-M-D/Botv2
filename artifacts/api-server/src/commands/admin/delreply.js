import { eq } from "drizzle-orm";
//import { isAdmin } from "../utils/admin.js";

export default {
  ownerOnly: true,
  adminOwnly: true,
  name: "delreply",
  description: "[Admin] Delete auto-reply rule by trigger. Usage: !delreply <trigger>",
  execute: async ({ sock, sender, args, db, tables }) => {
    

    const trigger = args.join(" ").trim();

    if (!trigger) {
      return sock.sendMessage(sender, { text: "Usage: !delreply <trigger>" });
    }

    const { waAutoRepliesTable } = tables;

    const deleted = await db
      .delete(waAutoRepliesTable)
      .where(eq(waAutoRepliesTable.trigger, trigger))
      .returning();

    if (!deleted.length) {
      return sock.sendMessage(sender, { text: `⚠️ No rule found with trigger: "${trigger}"` });
    }

    await sock.sendMessage(sender, { text: `🗑️ Deleted auto-reply rule: "${trigger}"` });
  },
};
