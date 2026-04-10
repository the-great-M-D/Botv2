import { eq } from "drizzle-orm";
//import { isAdmin } from "../utils/admin.js";

export default {
  ownerOnly: true,
  adminOnly: true,
  name: "togglereply",
  description: "[Admin] Enable or disable an auto-reply rule. Usage: !togglereply <trigger>",
  execute: async ({ sock, sender, args, db, tables }) => {
    

    const trigger = args.join(" ").trim();

    if (!trigger) {
      return sock.sendMessage(sender, { text: "Usage: !togglereply <trigger>" });
    }

    const { waAutoRepliesTable } = tables;

    const rows = await db
      .select()
      .from(waAutoRepliesTable)
      .where(eq(waAutoRepliesTable.trigger, trigger));

    if (!rows.length) {
      return sock.sendMessage(sender, { text: `⚠️ No rule found with trigger: "${trigger}"` });
    }

    const newState = !rows[0].enabled;

    await db
      .update(waAutoRepliesTable)
      .set({ enabled: newState })
      .where(eq(waAutoRepliesTable.trigger, trigger));

    await sock.sendMessage(sender, {
      text: `${newState ? "✅ Enabled" : "❌ Disabled"} auto-reply rule: "${trigger}"`,
    });
  },
};
