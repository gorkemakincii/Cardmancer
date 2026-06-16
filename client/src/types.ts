export interface Card {
  id: string;
  value: number;
}

// ── Lobby types ──────────────────────────────────────────────────────────────

export interface Player {
  socketId: string;
  username: string;
  isHost: boolean;
}

export interface GameState {
  roomCode: string;
  hostId: string;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  players: Player[];
  maxPlayers: number;
  createdAt: string;
}

// ── Game types ───────────────────────────────────────────────────────────────

export interface PlayerPublicView {
  socketId: string;
  username: string;
  isHost: boolean;
  handSize: number;
  faceUpCards: Card[];
  isEliminated: boolean;
  isProtected: boolean;
  connected: boolean;
}

export interface PlayerGameView {
  roomCode: string;
  status: 'PLAYING' | 'FINISHED';
  activePlayerId: string;
  phase: 'draw' | 'play' | null;
  deckSize: number;
  roundNumber: number;
  mySocketId: string;
  myHand: Card[];
  players: PlayerPublicView[];
  twoPlayerFaceUpCards: Card[];
  hasPendingAction: boolean;
}

export interface GameOverData {
  reason: string;
  winner: { socketId: string; username: string; hand: Card[] } | null;
  players: Array<{ socketId: string; username: string; hand: Card[]; faceUpCards: Card[] }>;
}

export type ActionPromptType = 'grave_digger';

export interface ActionPromptEvent {
  type: ActionPromptType;
  revealedCard?: Card;
}

export interface PrivateRevealEvent {
  targetName: string;
  cardValue: number;
}

// ── Chat types ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  socketId: string;
  username: string;
  message: string;
  ts: number;
}
