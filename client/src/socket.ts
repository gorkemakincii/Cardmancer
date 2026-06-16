import { io } from 'socket.io-client';
import { getClientId } from './session';

export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export const socket = io(SERVER_URL, {
  autoConnect: false,
  // Sent on every (re)connection attempt: token identifies logged-in users,
  // clientId gives guests a stable reconnection key.
  auth: (cb) => cb({
    token: localStorage.getItem('php_token') || undefined,
    clientId: getClientId(),
  }),
});
