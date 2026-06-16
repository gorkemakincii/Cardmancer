import { useEffect } from 'react';
import { socket } from '../socket';
import type { GameState, PlayerGameView } from '../types';

interface SocketHandlers {
  onRoomJoined?: (data: { roomCode: string; state: GameState }) => void;
  onRoomStateUpdated?: (state: GameState) => void;
  onGameStarted?: (view: PlayerGameView) => void;
  onJoinError?: (data: { message: string }) => void;
}

export function useSocket(handlers: SocketHandlers = {}) {
  const { onRoomJoined, onRoomStateUpdated, onGameStarted, onJoinError } = handlers;

  useEffect(() => {
    if (!socket.connected) socket.connect();

    if (onRoomJoined) socket.on('room_joined', onRoomJoined);
    if (onRoomStateUpdated) socket.on('room_state_updated', onRoomStateUpdated);
    if (onGameStarted) socket.on('game_started', onGameStarted);
    if (onJoinError) socket.on('join_error', onJoinError);

    return () => {
      if (onRoomJoined) socket.off('room_joined', onRoomJoined);
      if (onRoomStateUpdated) socket.off('room_state_updated', onRoomStateUpdated);
      if (onGameStarted) socket.off('game_started', onGameStarted);
      if (onJoinError) socket.off('join_error', onJoinError);
    };
  }, [onRoomJoined, onRoomStateUpdated, onGameStarted, onJoinError]);

  return socket;
}
