// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isSoundMuted,
  playChatSound,
  playDefeatSound,
  playIllegalMoveSound,
  playReactionSound,
  playStoneSound,
  playTurnSound,
  playUrgentCountdownSound,
  playVictorySound,
  setSoundMuted,
  SOUND_STORAGE_KEY,
  subscribeSoundChange,
  toggleSound,
} from '../src/client/lib/sound';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

describe('Sound System', () => {
  beforeEach(() => {
    localStorage.clear();
    setSoundMuted(false);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('manages mute preferences with localStorage', () => {
    expect(isSoundMuted()).toBe(false);

    setSoundMuted(true);
    expect(isSoundMuted()).toBe(true);
    expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe('true');

    setSoundMuted(false);
    expect(isSoundMuted()).toBe(false);
    expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBeNull();

    expect(toggleSound()).toBe(true);
    expect(isSoundMuted()).toBe(true);
    expect(toggleSound()).toBe(false);
    expect(isSoundMuted()).toBe(false);
  });

  it('notifies subscribers on every mute change and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSoundChange(listener);

    setSoundMuted(true);
    setSoundMuted(false);
    expect(listener.mock.calls).toEqual([[true], [false]]);

    unsubscribe();
    setSoundMuted(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('notifies subscribers even when localStorage rejects writes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSoundChange(listener);
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => setSoundMuted(true)).not.toThrow();
    expect(listener).toHaveBeenCalledWith(true);

    setItem.mockRestore();
    unsubscribe();
  });

  it('does not invoke audio synthesis when muted', () => {
    setSoundMuted(true);
    const audioContextSpy = vi.fn();
    vi.stubGlobal('AudioContext', audioContextSpy);

    playStoneSound('X');
    playStoneSound('O');
    playTurnSound();
    playUrgentCountdownSound();
    playVictorySound();
    playDefeatSound();
    playIllegalMoveSound();
    playReactionSound();
    playChatSound();

    expect(audioContextSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('synthesizes sounds cleanly when unmuted without throwing', () => {
    setSoundMuted(false);

    const mockOsc = {
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    class MockAudioContext {
      currentTime = 0;
      state = 'running';
      destination = {};
      createOscillator = vi.fn().mockReturnValue(mockOsc);
      createGain = vi.fn().mockReturnValue(mockGain);
      resume = vi.fn().mockResolvedValue(undefined);
    }

    vi.stubGlobal('AudioContext', MockAudioContext);

    expect(() => playStoneSound('X')).not.toThrow();
    expect(() => playStoneSound('O')).not.toThrow();
    expect(() => playTurnSound()).not.toThrow();
    expect(() => playUrgentCountdownSound()).not.toThrow();
    expect(() => playVictorySound()).not.toThrow();
    expect(() => playDefeatSound()).not.toThrow();
    expect(() => playIllegalMoveSound()).not.toThrow();
    expect(() => playReactionSound()).not.toThrow();
    expect(() => playChatSound()).not.toThrow();

    vi.unstubAllGlobals();
  });
});
