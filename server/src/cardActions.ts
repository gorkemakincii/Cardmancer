import type { Card, GameState, PendingAction, Player } from './types';
import { shuffle } from './gameEngine';

export interface CardPayload {
  targetPlayerId?: string;
  guessValue?: number;
}

export interface CardActionResult {
  advanceTurn: boolean;
  actionPromptData?: Record<string, unknown>;
  privateReveal?: { targetName: string; cardValue: number };
  guessInfo?: { targetName: string; guessValue: number; correct: boolean };
  shieldBlocked?: boolean;
  error?: string;
}

export function executeCardAction(
  room: GameState,
  actor: Player,
  card: Card,
  payload: CardPayload,
): CardActionResult {
  switch (card.value) {
    case 0:  return { advanceTurn: true };
    case 1:  return handleCrystalBowl(room, actor, payload);
    case 2:  return handleMouseTrapper(room, actor, payload);
    case 3:  return handleBattleBunny(room, actor, payload);
    case 4:  return handleShellShield(actor);
    case 5:  return handleSnakeSorcerer(room, actor, payload);
    case 6:  return handleDoggyGraveDigger(room, actor);
    case 7:  return handleJitteryJuggler(room);
    case 8:  return handleHermitHomeSwap(room, actor, payload);
    case 9:  return handleNotAPet(room, actor, payload);
    case 10: return handleKingCat(actor);
    default: return { advanceTurn: true };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findTarget(room: GameState, actor: Player, targetId?: string): Player | null {
  if (!targetId) return null;
  return room.players.find(
    p => p.socketId === targetId && !p.isEliminated && p.socketId !== actor.socketId,
  ) ?? null;
}

function eliminate(player: Player) {
  player.isEliminated = true;
  player.faceUpCards.push(...player.hand);
  player.hand = [];
}

// ── Card handlers ──────────────────────────────────────────────────────────────

// 10 – King Cat: playing it eliminates the player who played it
function handleKingCat(actor: Player): CardActionResult {
  eliminate(actor);
  return { advanceTurn: true };
}

// 4 – Shell Shield: protected until start of your next turn
function handleShellShield(actor: Player): CardActionResult {
  actor.isProtected = true;
  return { advanceTurn: true };
}

// 1 – Crystal Bowl: guess target's card; if correct, target is eliminated. Can't guess 1.
function handleCrystalBowl(room: GameState, actor: Player, { targetPlayerId, guessValue }: CardPayload): CardActionResult {
  const target = findTarget(room, actor, targetPlayerId);
  if (!target) return { advanceTurn: true };
  if (target.isProtected) return { advanceTurn: true, shieldBlocked: true };
  if (guessValue === undefined || guessValue === 1) return { advanceTurn: true };

  const correct = target.hand[0]?.value === guessValue;
  if (correct) eliminate(target);
  // Broadcast the guess (and its outcome) to everyone.
  return { advanceTurn: true, guessInfo: { targetName: target.username, guessValue, correct } };
}

// 3 – Battle Bunny: secretly compare hands; lower card is eliminated. Tie = nothing.
function handleBattleBunny(room: GameState, actor: Player, { targetPlayerId }: CardPayload): CardActionResult {
  const target = findTarget(room, actor, targetPlayerId);
  if (!target) return { advanceTurn: true };
  if (target.isProtected) return { advanceTurn: true, shieldBlocked: true };

  const myVal = actor.hand[0]?.value;
  const theirVal = target.hand[0]?.value;
  if (myVal === undefined || theirVal === undefined) return { advanceTurn: true };

  if (myVal < theirVal) eliminate(actor);
  else if (theirVal < myVal) eliminate(target);
  // equal: no effect
  return { advanceTurn: true };
}

// 5 – Snake Sorcerer: target discards their card (no action) and draws a new one.
//     If discarded card was 10, target is eliminated instead.
//     If deck empty, target draws setAsideCard.
function handleSnakeSorcerer(room: GameState, actor: Player, { targetPlayerId }: CardPayload): CardActionResult {
  const target = findTarget(room, actor, targetPlayerId);
  if (!target) return { advanceTurn: true };
  if (target.isProtected) return { advanceTurn: true, shieldBlocked: true };

  const discarded = target.hand.shift();
  if (!discarded) return { advanceTurn: true };

  target.faceUpCards.push(discarded);

  if (discarded.value === 10) {
    eliminate(target);
  } else {
    if (room.deck.length > 0) {
      target.hand = [room.deck.shift()!];
    } else if (room.setAsideCard) {
      target.hand = [room.setAsideCard];
      room.setAsideCard = null;
    }
  }
  return { advanceTurn: true };
}

// 8 – Hermit Home Swap: swap hands with target
function handleHermitHomeSwap(room: GameState, actor: Player, { targetPlayerId }: CardPayload): CardActionResult {
  const target = findTarget(room, actor, targetPlayerId);
  if (!target) return { advanceTurn: true };
  if (target.isProtected) return { advanceTurn: true, shieldBlocked: true };

  [actor.hand, target.hand] = [target.hand, actor.hand];
  return { advanceTurn: true };
}

// 9 – Not A Pet!: swap only if target holds King Cat (10)
function handleNotAPet(room: GameState, actor: Player, { targetPlayerId }: CardPayload): CardActionResult {
  const target = findTarget(room, actor, targetPlayerId);
  if (!target) return { advanceTurn: true };
  if (target.isProtected) return { advanceTurn: true, shieldBlocked: true };

  if (target.hand[0]?.value === 10) {
    [actor.hand, target.hand] = [target.hand, actor.hand];
  }
  return { advanceTurn: true };
}

// 7 – Jittery Juggler: all non-eliminated, non-protected players return hands, deck reshuffled, re-deal
function handleJitteryJuggler(room: GameState): CardActionResult {
  const affected = room.players.filter(p => !p.isEliminated && !p.isProtected);
  for (const p of affected) {
    room.deck.push(...p.hand);
    p.hand = [];
  }
  room.deck = shuffle(room.deck);
  for (const p of affected) {
    if (room.deck.length > 0) p.hand = [room.deck.shift()!];
  }
  return { advanceTurn: true };
}

// 6 – Doggy Grave Digger: reveal setAsideCard value to player, ask if they want to swap (multi-step)
function handleDoggyGraveDigger(room: GameState, actor: Player): CardActionResult {
  if (!room.setAsideCard) return { advanceTurn: true };

  const pending: PendingAction = {
    type: 'grave_digger',
    playerId: actor.socketId,
    card: room.setAsideCard,
  };
  room.pendingAction = pending;

  return {
    advanceTurn: false,
    actionPromptData: { revealedCard: room.setAsideCard },
  };
}

// 2 – Mouse Trapper (Priest): peek at a target player's hand card privately
function handleMouseTrapper(room: GameState, actor: Player, { targetPlayerId }: CardPayload): CardActionResult {
  const target = findTarget(room, actor, targetPlayerId);
  if (!target) return { advanceTurn: true };
  if (target.isProtected) return { advanceTurn: true, shieldBlocked: true };

  const peeked = target.hand[0];
  if (!peeked) return { advanceTurn: true };

  return {
    advanceTurn: true,
    privateReveal: { targetName: target.username, cardValue: peeked.value },
  };
}
