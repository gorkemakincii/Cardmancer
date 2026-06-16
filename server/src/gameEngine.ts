import type { Card, GameState, Player, PlayerGameView, PlayerPublicView } from './types';

export function createDeck(): Card[] {
  // Distribution: 1×10, 1×9, 1×8, 1×7, 1×6, 2×5, 2×4, 3×3, 3×2, 5×1, 3×0 = 24 cards
  const distribution: Array<[number, number]> = [
    [10, 1], [9, 1], [8, 1], [7, 1], [6, 1],
    [5, 2], [4, 2], [3, 3], [2, 3], [1, 5], [0, 3],
  ];
  let id = 0;
  const deck: Card[] = [];
  for (const [value, count] of distribution) {
    for (let i = 0; i < count; i++) {
      deck.push({ id: `card_${id++}`, value });
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildPlayerView(room: GameState, socketId: string): PlayerGameView {
  return {
    roomCode: room.roomCode,
    status: room.status as 'PLAYING' | 'FINISHED',
    activePlayerId: room.activePlayerId,
    phase: room.phase,
    deckSize: room.deck.length,
    roundNumber: room.roundNumber,
    mySocketId: socketId,
    myHand: room.players.find(p => p.socketId === socketId)?.hand ?? [],
    players: room.players.map((p): PlayerPublicView => ({
      socketId: p.socketId,
      username: p.username,
      isHost: p.isHost,
      handSize: p.hand.length,
      faceUpCards: p.faceUpCards,
      isEliminated: p.isEliminated,
      isProtected: p.isProtected,
      connected: p.connected,
    })),
    twoPlayerFaceUpCards: room.twoPlayerFaceUpCards,
    hasPendingAction: room.pendingAction !== null,
  };
}

export function determineWinner(room: GameState): Player | null {
  // Spy rule (card 0): if exactly one player (including eliminated) played a 0,
  // that player wins regardless of their hand
  const spyPlayers = room.players.filter(p => p.faceUpCards.some(c => c.value === 0));
  if (spyPlayers.length === 1) return spyPlayers[0];

  // Normal: highest hand card among active players wins
  const active = room.players.filter(p => !p.isEliminated);
  if (active.length === 0) return null;
  if (active.length === 1) return active[0];

  return [...active].sort((a, b) => {
    const aVal = a.hand[0]?.value ?? 0;
    const bVal = b.hand[0]?.value ?? 0;
    if (bVal !== aVal) return bVal - aVal;
    // Tiebreaker: sum of face-up cards
    const aSum = a.faceUpCards.reduce((s, c) => s + c.value, 0);
    const bSum = b.faceUpCards.reduce((s, c) => s + c.value, 0);
    return bSum - aSum;
  })[0] ?? null;
}

// Finds the next non-eliminated player in original seating order,
// even if currentSocketId belongs to an eliminated player.
export function getNextActivePlayer(room: GameState, currentSocketId: string): Player | null {
  const { players } = room;
  const startIdx = players.findIndex(p => p.socketId === currentSocketId);
  if (startIdx === -1) return players.find(p => !p.isEliminated) ?? null;

  for (let i = 1; i <= players.length; i++) {
    const candidate = players[(startIdx + i) % players.length];
    if (!candidate.isEliminated) return candidate;
  }
  return null;
}
