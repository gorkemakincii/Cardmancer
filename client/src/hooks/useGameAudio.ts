import { useState, useCallback } from 'react';
import { getMuted, toggleMute as _toggle, playClick } from '../audio';

export function useGameAudio() {
  const [muted, setMuted] = useState(getMuted);

  const toggleMute = useCallback(() => {
    playClick();          // plays if currently unmuted
    const next = _toggle();
    setMuted(next);
  }, []);

  return { muted, toggleMute };
}
