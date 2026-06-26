import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type { GameState, Player } from './types';
import { createDeck, shuffle, buildPlayerView, determineWinner, getNextActivePlayer } from './gameEngine';
import { executeCardAction } from './cardActions';
import { prisma } from './db';
import { registerHandler, loginHandler, meHandler, verifyToken } from './auth';

// Fail fast: refuse to start without a JWT secret (no insecure fallback).
if (!process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET environment variable is required. Set it in your environment (.env locally, dashboard in production).');
  process.exit(1);
}

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;                          // non-browser clients / same-origin
  if (origin.startsWith('http://localhost')) return true;
  if (origin === CLIENT_URL) return true;
  try {
    // Allow Vercel deployments (production + preview) so the frontend just works.
    if (new URL(origin).hostname.endsWith('.vercel.app')) return true;
  } catch { /* malformed origin */ }
  return false;
}

const corsOrigin = (origin: string | undefined, cb: (e: Error | null, allow?: boolean) => void) => {
  if (isAllowedOrigin(origin)) cb(null, true);
  else cb(new Error('Not allowed by CORS'));
};

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

const io = new Server(httpServer, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'], credentials: true },
});

// Optional auth: if the client sends a valid JWT, attach the user identity.
// Guests connect without a token but still send a persistent clientId, which
// (together with userId) gives every player a stable reconnection key.
io.use((socket, next) => {
  const auth = socket.handshake.auth ?? {};
  const token = auth.token as string | undefined;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      socket.data.userId = payload.userId;
      socket.data.username = payload.username;
    }
  }
  socket.data.clientId = typeof auth.clientId === 'string' ? auth.clientId : undefined;
  next();
});

// Stable identity used to reattach a reconnecting socket to its seat.
function reconnectKeyOf(socket: { data: { userId?: string; clientId?: string; }; id: string }): string {
  return socket.data.userId ?? socket.data.clientId ?? socket.id;
}

const rooms = new Map<string, GameState>();

// Grace period a disconnected player's seat is held before they are eliminated.
const RECONNECT_GRACE_MS = 45_000;
const reconnectTimers = new Map<string, NodeJS.Timeout>(); // key: `${roomCode}:${reconnectKey}`

function clearReconnectTimer(key: string) {
  const t = reconnectTimers.get(key);
  if (t) { clearTimeout(t); reconnectTimers.delete(key); }
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getUniqueRoomCode(): string {
  let code = generateRoomCode();
  while (rooms.has(code)) code = generateRoomCode();
  return code;
}

function emitPersonalized(room: GameState, event: string, data: (socketId: string) => object) {
  for (const p of room.players) {
    const s = io.sockets.sockets.get(p.socketId);
    if (s) s.emit(event, data(p.socketId));
  }
}

function triggerGameOver(room: GameState, roomCode: string, reason: string) {
  if (room.status === 'FINISHED') return; // guard against double game-over
  room.status = 'FINISHED';
  const winner = determineWinner(room);
  void persistGameStats(room, winner?.socketId ?? null);
  io.to(roomCode).emit('game_over', {
    reason,
    winner: winner ? { socketId: winner.socketId, username: winner.username, hand: winner.hand } : null,
    players: room.players.map(p => ({
      socketId: p.socketId,
      username: p.username,
      hand: p.hand,
      faceUpCards: p.faceUpCards,
    })),
  });
  setTimeout(() => rooms.delete(roomCode), 60_000);
  console.log(`[Room] Game over: ${roomCode} | winner: ${winner?.username ?? 'none'} | reason: ${reason}`);
}

// Advance turn to next active player and emit the given event to all
function advanceAndEmit(room: GameState, roomCode: string, currentSocketId: string, event: string, extraData: object = {}) {
  const activePlayers = room.players.filter(p => !p.isEliminated);
  if (activePlayers.length <= 1) { triggerGameOver(room, roomCode, 'last_player'); return; }

  const nextPlayer = getNextActivePlayer(room, currentSocketId);
  if (!nextPlayer) { triggerGameOver(room, roomCode, 'no_next_player'); return; }

  room.activePlayerId = nextPlayer.socketId;
  room.phase = 'draw';
  room.roundNumber++;

  emitPersonalized(room, event, (sid) => ({ ...extraData, gameView: buildPlayerView(room, sid) }));
  console.log(`[Game] Turn → ${nextPlayer.username} (${roomCode})`);
}

// Reveal a seat's hand and mark it eliminated (mirrors cardActions.eliminate).
function eliminateSeat(room: GameState, player: Player) {
  player.isEliminated = true;
  player.faceUpCards.push(...player.hand);
  player.hand = [];
  if (room.pendingAction?.playerId === player.socketId) room.pendingAction = null;
}

// Eliminate a player (intentional leave or reconnect-timeout), then continue the game.
function eliminateAndAdvance(room: GameState, roomCode: string, player: Player, reason: string) {
  const wasActive = room.activePlayerId === player.socketId;
  eliminateSeat(room, player);

  const activePlayers = room.players.filter(p => !p.isEliminated);
  if (activePlayers.length <= 1) { triggerGameOver(room, roomCode, reason); return; }

  if (wasActive) {
    const next = getNextActivePlayer(room, player.socketId);
    if (next) { room.activePlayerId = next.socketId; room.phase = 'draw'; }
  }
  emitPersonalized(room, 'game_state_updated', (sid) => buildPlayerView(room, sid));
}

// Hold a disconnected player's seat; eliminate them if the grace period lapses.
function startReconnectTimer(roomCode: string, player: Player) {
  const key = `${roomCode}:${player.reconnectKey}`;
  clearReconnectTimer(key);
  const t = setTimeout(() => {
    reconnectTimers.delete(key);
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'PLAYING') return;
    const p = room.players.find(x => x.reconnectKey === player.reconnectKey);
    if (!p || p.connected || p.isEliminated) return;
    console.log(`[Reconnect] grace expired → eliminate ${p.username} (${roomCode})`);
    eliminateAndAdvance(room, roomCode, p, 'disconnect');
  }, RECONNECT_GRACE_MS);
  reconnectTimers.set(key, t);
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Cardmancer server is running!' });
});

// ── AUTH ROUTES ───────────────────────────────────────────────────────────────
app.post('/auth/register', registerHandler);
app.post('/auth/login', loginHandler);
app.get('/auth/me', meHandler);

// Persist game outcome stats for logged-in players (guests are skipped).
async function persistGameStats(room: GameState, winnerSocketId: string | null) {
  const updates = room.players
    .filter(p => p.userId)
    .map(p => prisma.user.update({
      where: { id: p.userId! },
      data: {
        totalGames: { increment: 1 },
        ...(p.socketId === winnerSocketId ? { wins: { increment: 1 } } : {}),
      },
    }));
  if (updates.length === 0) return;
  try {
    await Promise.all(updates);
  } catch (e) {
    console.error('[stats] persist error', e);
  }
}

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ── LOBBY EVENTS ────────────────────────────────────────────────────────────

  socket.on('join_room', ({ username, roomCode }: { username: string; roomCode?: string }) => {
    const trimmedCode = roomCode?.trim().toUpperCase();
    const userId: string | null = socket.data.userId ?? null;
    // Logged-in users always use their account name (prevents impersonation).
    const displayName = (socket.data.username || username || '').trim();
    if (!displayName) { socket.emit('join_error', { message: 'Kullanıcı adı gerekli.' }); return; }

    const freshPlayer = (isHost: boolean): Player => ({
      socketId: socket.id,
      userId,
      reconnectKey: reconnectKeyOf(socket),
      connected: true,
      username: displayName,
      isHost,
      hand: [],
      faceUpCards: [],
      isEliminated: false,
      isProtected: false,
      tokens: 0,
    });

    if (!trimmedCode) {
      const newCode = getUniqueRoomCode();
      const room: GameState = {
        roomCode: newCode,
        hostId: socket.id,
        status: 'WAITING',
        players: [freshPlayer(true)],
        maxPlayers: 6,
        createdAt: new Date(),
        deck: [],
        setAsideCard: null,
        twoPlayerFaceUpCards: [],
        activePlayerId: '',
        roundNumber: 0,
        phase: null,
        pendingAction: null,
      };
      rooms.set(newCode, room);
      socket.join(newCode);
      socket.data.roomCode = newCode;
      socket.emit('room_joined', { roomCode: newCode, state: room });
      io.to(newCode).emit('room_state_updated', room);
      console.log(`[Room] Created: ${newCode} by ${displayName}`);
      return;
    }

    const room = rooms.get(trimmedCode);
    if (!room) { socket.emit('join_error', { message: 'Oda bulunamadı. Kodu kontrol et.' }); return; }
    if (room.status !== 'WAITING') { socket.emit('join_error', { message: 'Oyun zaten başladı.' }); return; }
    if (room.players.length >= room.maxPlayers) { socket.emit('join_error', { message: 'Oda dolu.' }); return; }
    if (room.players.some(p => p.username === displayName)) { socket.emit('join_error', { message: 'Bu kullanıcı adı odada zaten var.' }); return; }

    room.players.push(freshPlayer(false));
    socket.join(trimmedCode);
    socket.data.roomCode = trimmedCode;
    socket.emit('room_joined', { roomCode: trimmedCode, state: room });
    io.to(trimmedCode).emit('room_state_updated', room);
    console.log(`[Room] ${displayName} joined: ${trimmedCode}`);
  });

  socket.on('start_game', ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.hostId !== socket.id) { socket.emit('game_error', { message: 'Sadece host oyunu başlatabilir.' }); return; }
    if (room.players.length < 2) { socket.emit('game_error', { message: 'En az 2 oyuncu gerekli.' }); return; }
    if (room.status !== 'WAITING') { socket.emit('game_error', { message: 'Oyun zaten başladı.' }); return; }

    let deck = shuffle(createDeck());

    for (const p of room.players) {
      p.hand = [deck.shift()!];
      p.faceUpCards = [];
      p.isEliminated = false;
      p.isProtected = false;
    }

    room.setAsideCard = deck.shift()!;
    room.twoPlayerFaceUpCards = [];
    if (room.players.length === 2) {
      // 2-player rule: 3 extra cards are revealed face-up, out of the round
      room.twoPlayerFaceUpCards = [deck.shift()!, deck.shift()!, deck.shift()!];
    }

    room.deck = deck;
    room.status = 'PLAYING';
    room.activePlayerId = room.players[Math.floor(Math.random() * room.players.length)].socketId;
    room.roundNumber = 1;
    room.phase = 'draw';
    room.pendingAction = null;

    emitPersonalized(room, 'game_started', (sid) => buildPlayerView(room, sid));
    const starter = room.players.find(p => p.socketId === room.activePlayerId);
    console.log(`[Room] Game started: ${roomCode} | first: ${starter?.username} | deck: ${deck.length}`);
  });

  // ── GAME EVENTS ──────────────────────────────────────────────────────────────

  socket.on('draw_card', ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'PLAYING') return;
    if (room.activePlayerId !== socket.id) { socket.emit('game_error', { message: 'Sıra sende değil.' }); return; }
    if (room.phase !== 'draw') { socket.emit('game_error', { message: 'Şu an kart çekme aşamasında değilsin.' }); return; }

    if (room.deck.length === 0) { triggerGameOver(room, roomCode, 'deck_empty'); return; }

    // Reset Shell Shield protection at start of this player's turn
    const player = room.players.find(p => p.socketId === socket.id)!;
    player.isProtected = false;

    const card = room.deck.shift()!;
    player.hand.push(card);
    room.phase = 'play';

    emitPersonalized(room, 'card_drawn', (sid) => ({
      drawerId: socket.id,
      gameView: buildPlayerView(room, sid),
    }));
    console.log(`[Game] ${player.username} drew (${roomCode}) | deck left: ${room.deck.length}`);
  });

  socket.on('play_card', ({
    roomCode, cardId, targetPlayerId, guessValue,
  }: {
    roomCode: string;
    cardId: string;
    targetPlayerId?: string;
    guessValue?: number;
  }) => {
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'PLAYING') return;
    if (room.activePlayerId !== socket.id) { socket.emit('game_error', { message: 'Sıra sende değil.' }); return; }
    if (room.phase !== 'play') { socket.emit('game_error', { message: 'Şu an kart oynama aşamasında değilsin.' }); return; }

    const player = room.players.find(p => p.socketId === socket.id)!;
    const cardIdx = player.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) { socket.emit('game_error', { message: 'Bu kart elinde yok.' }); return; }

    const [playedCard] = player.hand.splice(cardIdx, 1);
    player.faceUpCards.push(playedCard);

    const result = executeCardAction(room, player, playedCard, { targetPlayerId, guessValue });

    if (!result.advanceTurn) {
      // Multi-step: pause the turn and prompt the active player
      emitPersonalized(room, 'card_played', (sid) => ({
        playerId: socket.id,
        card: playedCard,
        gameView: buildPlayerView(room, sid),
      }));
      const activeSocket = io.sockets.sockets.get(socket.id);
      if (activeSocket) {
        activeSocket.emit('action_prompt', {
          type: room.pendingAction!.type,
          ...result.actionPromptData,
        });
      }
      console.log(`[Game] ${player.username} played ${playedCard.value} → pending: ${room.pendingAction?.type} (${roomCode})`);
      return;
    }

    if (result.privateReveal) {
      socket.emit('private_reveal', result.privateReveal);
    }

    console.log(`[Game] ${player.username} played ${playedCard.value} (${roomCode})${result.shieldBlocked ? ' → shield blocked' : ''}`);
    advanceAndEmit(room, roomCode, socket.id, 'card_played', {
      playerId: socket.id,
      card: playedCard,
      shieldBlocked: result.shieldBlocked ?? false,
      guessInfo: result.guessInfo ?? null,
    });
  });

  socket.on('action_response', ({
    roomCode, type, accept,
  }: {
    roomCode: string;
    type: 'grave_digger';
    accept?: boolean;
  }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.pendingAction) return;
    if (room.pendingAction.playerId !== socket.id) return; // security: only the right player
    if (room.pendingAction.type !== type) return;

    const player = room.players.find(p => p.socketId === socket.id)!;

    // grave_digger: optionally swap your hand with the revealed set-aside card
    if (accept) {
      const currentCard = player.hand[0];
      const swapCard = room.pendingAction.card; // was setAsideCard
      if (currentCard && swapCard) {
        player.hand = [swapCard];
        room.setAsideCard = currentCard;
      }
    }

    room.pendingAction = null;
    console.log(`[Game] action_response: ${type} (${roomCode})`);
    advanceAndEmit(room, roomCode, socket.id, 'action_resolved', { type });
  });

  // ── RESTART ──────────────────────────────────────────────────────────────────

  socket.on('restart_game', ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.hostId !== socket.id) { socket.emit('game_error', { message: 'Sadece host oyunu yeniden başlatabilir.' }); return; }
    if (room.status !== 'FINISHED') { socket.emit('game_error', { message: 'Oyun henüz bitmedi.' }); return; }

    for (const p of room.players) {
      p.hand = [];
      p.faceUpCards = [];
      p.isEliminated = false;
      p.isProtected = false;
      p.connected = true;
      p.tokens = 0;
    }

    room.status = 'WAITING';
    room.deck = [];
    room.setAsideCard = null;
    room.twoPlayerFaceUpCards = [];
    room.activePlayerId = '';
    room.roundNumber = 0;
    room.phase = null;
    room.pendingAction = null;

    io.to(roomCode).emit('room_state_updated', room);
    console.log(`[Room] Restarted: ${roomCode} by ${room.players.find(p => p.socketId === socket.id)?.username}`);
  });

  // ── CHAT ─────────────────────────────────────────────────────────────────────

  socket.on('chat_message', ({ roomCode, message }: { roomCode: string; message: string }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return; // only players in the room can chat

    const text = String(message ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!text) return;

    io.to(roomCode).emit('chat_message', {
      socketId: socket.id,
      username: player.username,
      message: text,
      ts: Date.now(),
    });
  });

  // ── LEAVE / RECONNECT ──────────────────────────────────────────────────────────

  // Intentional leave: eliminate immediately (don't make others wait out the grace period).
  socket.on('leave_game', ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'PLAYING') return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || player.isEliminated) return;

    clearReconnectTimer(`${roomCode}:${player.reconnectKey}`);
    console.log(`[Game] ${player.username} left the game (${roomCode})`);
    eliminateAndAdvance(room, roomCode, player, 'disconnect');
    socket.leave(roomCode);
    socket.data.roomCode = undefined;
  });

  // Reconnect into a held seat after a drop/refresh.
  socket.on('rejoin_room', ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room) { socket.emit('rejoin_failed', { reason: 'no_room' }); return; }
    if (room.status !== 'PLAYING') { socket.emit('rejoin_failed', { reason: 'not_playing' }); return; }

    const key = reconnectKeyOf(socket);
    // A reconnect should reclaim a seat that genuinely dropped — never hijack a
    // seat that is still live. If several seats share a reconnectKey (e.g. two
    // same-browser tabs that ended up with the same clientId), prefer the one
    // that is actually disconnected; only fall back to a live seat when this is
    // the same socket re-announcing itself.
    const candidates = room.players.filter(p => p.reconnectKey === key && !p.isEliminated);
    const player = candidates.find(p => !p.connected)
      ?? candidates.find(p => p.socketId === socket.id)
      ?? null;
    if (!player) {
      const onlyEliminated = room.players.some(p => p.reconnectKey === key && p.isEliminated);
      socket.emit('rejoin_failed', { reason: onlyEliminated ? 'eliminated' : 'no_seat' });
      return;
    }

    const oldSocketId = player.socketId;
    const newSocketId = socket.id;

    // Remap every socketId-based reference from the old socket to the new one.
    if (room.hostId === oldSocketId) room.hostId = newSocketId;
    if (room.activePlayerId === oldSocketId) room.activePlayerId = newSocketId;
    if (room.pendingAction?.playerId === oldSocketId) room.pendingAction.playerId = newSocketId;
    player.socketId = newSocketId;
    player.connected = true;
    player.userId = socket.data.userId ?? player.userId; // keep identity fresh

    clearReconnectTimer(`${roomCode}:${key}`);
    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    socket.emit('rejoin_success', { gameView: buildPlayerView(room, newSocketId) });

    // Re-show a pending grave-digger prompt the player may have missed while away.
    if (room.pendingAction && room.pendingAction.playerId === newSocketId) {
      socket.emit('action_prompt', { type: room.pendingAction.type, revealedCard: room.pendingAction.card });
    }

    emitPersonalized(room, 'game_state_updated', (sid) => buildPlayerView(room, sid));
    console.log(`[Reconnect] ${player.username} rejoined (${roomCode})`);
  });

  // ── DISCONNECT ───────────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    const roomCode: string | undefined = socket.data.roomCode;
    console.log(`[-] Disconnected: ${socket.id} (room: ${roomCode ?? 'none'})`);
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (!room) return;

    if (room.status === 'WAITING') {
      room.players = room.players.filter(p => p.socketId !== socket.id);
      if (room.players.length === 0) { rooms.delete(roomCode); return; }
      if (room.hostId === socket.id) {
        room.hostId = room.players[0].socketId;
        room.players[0].isHost = true;
      }
      io.to(roomCode).emit('room_state_updated', room);
      return;
    }

    if (room.status === 'PLAYING') {
      const leaving = room.players.find(p => p.socketId === socket.id);
      if (!leaving || leaving.isEliminated) return;

      // Hold the seat: mark disconnected and give them a grace period to return.
      leaving.connected = false;
      startReconnectTimer(roomCode, leaving);
      emitPersonalized(room, 'game_state_updated', (sid) => buildPlayerView(room, sid));
      console.log(`[Reconnect] ${leaving.username} disconnected, holding seat (${roomCode})`);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
