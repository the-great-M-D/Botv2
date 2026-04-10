// src/utils/admin.js

/**
 * Checks if a specific JID is an admin in the given group metadata
 * @param {string} jid - The person we are checking
 * @param {object} groupMetadata - The data fetched via sock.groupMetadata()
 */
export const isAdmin = (jid, groupMetadata) => {
    // If we aren't in a group, groupMetadata will be missing
    if (!groupMetadata || !groupMetadata.participants) return false;

    // Find the participant in the list
    const participant = groupMetadata.participants.find(p => p.id === jid);

    // In Baileys, the 'admin' property is either 'admin', 'superadmin', or null
    return participant?.admin === 'admin' || participant?.admin === 'superadmin';
};

