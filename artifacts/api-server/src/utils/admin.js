const ADMIN_JID = process.env.ADMIN_JID;

export function isAdmin(sender) {
  if (!ADMIN_JID) {
    console.warn("[admin] ADMIN_JID env var not set — admin commands are open to everyone. Set ADMIN_JID to restrict access.");
    return true;
  }
  const normalized = sender.replace(/:[0-9]+@/, "@");
  const adminNorm = ADMIN_JID.replace(/:[0-9]+@/, "@");
  return normalized === adminNorm;
}
