import { useCallback, useEffect, useState } from 'react';
import { isSoundMuted, setSoundMuted, subscribeSoundChange } from '../lib/sound';
import { hapticImpact } from '../lib/telegram';

export interface SoundSettings {
  soundOn: boolean;
  setSoundOn: (on: boolean) => void;
  toggle: () => void;
}

/**
 * Reads the persisted mute preference and keeps the local state in sync when
 * another control (game header or settings) changes it.
 */
export function useSoundSettings(): SoundSettings {
  const [soundOn, setSoundOnState] = useState(() => !isSoundMuted());

  useEffect(() => subscribeSoundChange((muted) => setSoundOnState(!muted)), []);

  const setSoundOn = useCallback((on: boolean) => {
    setSoundMuted(!on);
    hapticImpact('light');
  }, []);

  const toggle = useCallback(() => {
    // Storage is the source of truth: reading it here keeps the toggle free of
    // side effects inside a state updater, which React may call twice.
    setSoundMuted(!isSoundMuted());
    hapticImpact('light');
  }, []);

  return { soundOn, setSoundOn, toggle };
}
