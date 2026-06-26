// Per-TAB identity + active-game tracking, used for reconnection.
//
// IMPORTANT: this is intentionally backed by sessionStorage, not localStorage.
// localStorage is shared across every tab of the same origin, so two tabs in the
// same browser (the normal way you test a 2-player game locally) would send an
// identical clientId — colliding their server-side reconnectKey and letting one
// tab's reconnect hijack the other's seat, freezing the turn. sessionStorage is
// scoped to a single tab and survives that tab's own refresh, so each player gets
// a stable-yet-unique reconnect anchor.

const CLIENT_ID_KEY = 'php_client_id';
const ACTIVE_ROOM_KEY = 'php_active_room';

// Stable id for guests (and an extra anchor for logged-in users), unique per tab
// and persistent across reloads of that tab.
export function getClientId(): string {
  let id = sessionStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `c_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    sessionStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function getActiveRoom(): string | null {
  return sessionStorage.getItem(ACTIVE_ROOM_KEY);
}

export function setActiveRoom(roomCode: string) {
  sessionStorage.setItem(ACTIVE_ROOM_KEY, roomCode);
}

export function clearActiveRoom() {
  sessionStorage.removeItem(ACTIVE_ROOM_KEY);
}
