let sharedAudioCtx: AudioContext | null = null;

export const SOUND_STORAGE_KEY = 'tictac_sound_muted';

export function isSoundMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SOUND_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (muted) localStorage.setItem(SOUND_STORAGE_KEY, 'true');
    else localStorage.removeItem(SOUND_STORAGE_KEY);
  } catch {
    // Ignore storage errors in sandboxed iframes
  }
}

export function toggleSound(): boolean {
  const next = !isSoundMuted();
  setSoundMuted(next);
  return next;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    try {
      sharedAudioCtx = new AudioCtx();
    } catch {
      return null;
    }
  }
  return sharedAudioCtx;
}

/**
 * Synthesizes a crisp, tactile stone placement sound (wood/ceramic snap).
 * Side determines subtle pitch tone: 'X' is slightly brighter, 'O' is warmer.
 */
export function playStoneSound(side: 'X' | 'O' = 'X'): void {
  if (isSoundMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;

    // 1. Attack snap (crisp high frequency tap)
    const attackOsc = ctx.createOscillator();
    const attackGain = ctx.createGain();
    attackOsc.type = 'triangle';
    attackOsc.frequency.setValueAtTime(side === 'X' ? 1150 : 980, now);
    attackOsc.frequency.exponentialRampToValueAtTime(320, now + 0.025);
    attackGain.gain.setValueAtTime(0.09, now);
    attackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    attackOsc.connect(attackGain);
    attackGain.connect(ctx.destination);
    attackOsc.start(now);
    attackOsc.stop(now + 0.03);

    // 2. Resonant board body resonance (warm thud)
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'sine';
    const baseFreq = side === 'X' ? 340 : 280;
    bodyOsc.frequency.setValueAtTime(baseFreq, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.75, now + 0.07);
    bodyGain.gain.setValueAtTime(0.12, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.08);
  } catch {
    // Best-effort audio playback
  }
}

/**
 * Synthesizes a soft two-bell chime to notify the player that their turn has started.
 */
export function playTurnSound(): void {
  if (isSoundMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const notes = [
      { freq: 659.25, time: 0, dur: 0.14, vol: 0.06 }, // E5
      { freq: 880.0, time: 0.07, dur: 0.22, vol: 0.07 }, // A5
    ];

    notes.forEach(({ freq, time, dur, vol }) => {
      const start = now + time;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(vol, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur);
    });
  } catch {
    // Best-effort audio playback
  }
}

/**
 * Synthesizes a woodblock tick when the turn countdown is urgent (<= 5s).
 */
export function playUrgentCountdownSound(): void {
  if (isSoundMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(840, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.02);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.025);
  } catch {
    // Best-effort audio playback
  }
}

/**
 * Synthesizes a celebratory major arpeggio when winning a match.
 */
export function playVictorySound(): void {
  if (isSoundMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const chords = [
      { freq: 523.25, time: 0, dur: 0.22, vol: 0.07 }, // C5
      { freq: 659.25, time: 0.09, dur: 0.24, vol: 0.08 }, // E5
      { freq: 783.99, time: 0.18, dur: 0.28, vol: 0.09 }, // G5
      { freq: 1046.5, time: 0.28, dur: 0.45, vol: 0.1 }, // C6
    ];

    chords.forEach(({ freq, time, dur, vol }) => {
      const start = now + time;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(vol, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur);
    });
  } catch {
    // Best-effort audio playback
  }
}

/**
 * Synthesizes a gentle, sympathetic descending chime when losing a match.
 */
export function playDefeatSound(): void {
  if (isSoundMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const notes = [
      { freq: 392.0, time: 0, dur: 0.22, vol: 0.07 }, // G4
      { freq: 349.23, time: 0.12, dur: 0.24, vol: 0.06 }, // F4
      { freq: 311.13, time: 0.24, dur: 0.42, vol: 0.06 }, // Eb4
    ];

    notes.forEach(({ freq, time, dur, vol }) => {
      const start = now + time;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(vol, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur);
    });
  } catch {
    // Best-effort audio playback
  }
}

/**
 * Synthesizes a subtle low-frequency tap when attempting an illegal or occupied cell.
 */
export function playIllegalMoveSound(): void {
  if (isSoundMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.04);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  } catch {
    // Best-effort audio playback
  }
}

/**
 * Synthesizes a gentle two-tone chirp for incoming/outgoing animated sticker reactions.
 */
export function playReactionSound(): void {
  if (isSoundMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  } catch {
    // Best-effort audio playback
  }
}

/**
 * Synthesizes a gentle soft bubble-pop sound for chat messages.
 */
export function playChatSound(): void {
  if (isSoundMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.06);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    // Best-effort audio playback
  }
}
