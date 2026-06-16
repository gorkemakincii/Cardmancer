export interface Card {
  id: string;
  value: number;
}

export interface Player {
  socketId: string;
  userId: string | null;   // set for logged-in users; null for guests
  reconnectKey: string;    // userId or guest clientId — stable across reconnects
  connected: boolean;      // false while disconnected (seat held during grace period)
  username: string;
  isHost: boolean;
  hand: Card[];
  faceUpCards: Card[];
  isEliminated: boolean;
  isProtected: boolean;
  tokens: number;
}

export interface PendingAction {
  type: 'grave_digger';
  playerId: string;
  card: Card;
}

export interface GameState {
  roomCode: string;
  hostId: string;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  players: Player[];
  maxPlayers: number;
  createdAt: Date;
  deck: Card[];
  setAsideCard: Card | null;
  twoPlayerFaceUpCards: Card[];
  activePlayerId: string;
  roundNumber: number;
  phase: 'draw' | 'play' | null;
  pendingAction: PendingAction | null;
}

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
