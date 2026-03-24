/**
 * In-memory store for message_handle (Apple GUID) tracking.
 * Maps peer phone numbers to their most recent message handles,
 * enabling reactions to specific messages.
 */

// Map<peerId, { inbound: messageHandle, outbound: messageHandle }>
const handles = new Map();

// Map<messageHandle, { peer, direction, timestamp }>
const handleIndex = new Map();

const MAX_HANDLES = 10000;

/**
 * Store a message handle for a peer.
 * @param {string} peer - Phone number (E.164)
 * @param {string} messageHandle - Apple GUID
 * @param {"inbound"|"outbound"} direction
 */
export function storeHandle(peer, messageHandle, direction) {
  if (!handles.has(peer)) {
    handles.set(peer, {});
  }
  handles.get(peer)[direction] = messageHandle;

  handleIndex.set(messageHandle, {
    peer,
    direction,
    timestamp: Date.now(),
  });

  // Evict old entries if index grows too large
  if (handleIndex.size > MAX_HANDLES) {
    const entries = [...handleIndex.entries()];
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < entries.length - MAX_HANDLES; i++) {
      handleIndex.delete(entries[i][0]);
    }
  }
}

/**
 * Get the most recent inbound message handle for a peer.
 * @param {string} peer - Phone number
 * @returns {string|null}
 */
export function getLastInboundHandle(peer) {
  return handles.get(peer)?.inbound || null;
}

/**
 * Get the most recent outbound message handle for a peer.
 * @param {string} peer - Phone number
 * @returns {string|null}
 */
export function getLastOutboundHandle(peer) {
  return handles.get(peer)?.outbound || null;
}

/**
 * Look up metadata for a specific message handle.
 * @param {string} messageHandle
 * @returns {{ peer: string, direction: string, timestamp: number }|null}
 */
export function lookupHandle(messageHandle) {
  return handleIndex.get(messageHandle) || null;
}
