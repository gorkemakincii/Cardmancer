// Persistent per-browser identity + active-game tracking, used for reconnection.

const CLIENT_ID_KEY = 'php_client_id';
const ACTIVE_ROOM_KEY = 'php_active_room';

// Stable id for guests (and an extra anchor for logged-in users) across reloads.
export function getClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `c_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function getActiveRoom(): string | null {
  return localStorage.getItem(ACTIVE_ROOM_KEY);
}

export function setActiveRoom(roomCode: string) {
  localStorage.setItem(ACTIVE_ROOM_KEY, roomCode);
}

export function clearActiveRoom() {
  localStorage.removeItem(ACTIVE_ROOM_KEY);
}
