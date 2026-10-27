/**
 * Procedural Walkie-Talkie (Icom) Radio Audio Engine & Voice Recorder
 *
 * Provides:
 * 1. Authentic procedural walkie-talkie SFX (PTT key-on chirp, squelch roger-beep, cancel blip).
 * 2. Microphone permission detection with graceful degradation ("not always allowed").
 * 3. MediaRecorder + Web Audio Analyser for live visual waveforms ("auto waw").
 * 4. Audio playback with auto-play handling for opponent ("auto play auto waw").
 */

import { validateVoiceDataUrl } from '../../shared/audio';

let sharedAudioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioCtx();
  }
  if (sharedAudioContext.state === 'suspended') {
    void sharedAudioContext.resume().catch(() => undefined);
  }
  return sharedAudioContext;
}

/**
 * Procedural Icom PTT key-on transmission start chirp.
 * Dual-tone burst (1850Hz + 2200Hz) with slight radio static click.
 */
export function playPttStartChirp(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(1850, now);
  osc1.frequency.exponentialRampToValueAtTime(2150, now + 0.04);

  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(920, now);
  osc2.frequency.exponentialRampToValueAtTime(1075, now + 0.04);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.05);
  osc2.stop(now + 0.05);
}

/**
 * Procedural walkie-talkie roger beep & squelch tail.
 * Classic 2475Hz radio tone followed by a short static burst.
 */
export function playRogerBeep(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. High-pitched roger beep (2475Hz)
  const osc = ctx.createOscillator();
  const toneGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(2475, now);
  toneGain.gain.setValueAtTime(0.0001, now);
  toneGain.gain.exponentialRampToValueAtTime(0.2, now + 0.005);
  toneGain.gain.setValueAtTime(0.18, now + 0.065);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

  osc.connect(toneGain);
  toneGain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.08);

  // 2. Procedural radio squelch white noise tail (25ms)
  try {
    const bufferSize = Math.floor(ctx.sampleRate * 0.035);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now + 0.075);
    filter.Q.setValueAtTime(2.0, now + 0.075);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.09, now + 0.075);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now + 0.075);
  } catch {
    // Noise buffer generation fallback
  }
}

/**
 * Procedural cancel / discard blip (two rapid low tones).
 */
export function playCancelBeep(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.09);

  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.11);
}

export interface MicSupportStatus {
  supported: boolean;
  reason?: 'NO_MEDIA_DEVICES' | 'INSECURE_CONTEXT' | 'NO_RECORDER';
  message?: string;
}

/**
 * Check if the current browser environment supports audio recording.
 */
export function checkMicrophoneSupport(): MicSupportStatus {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { supported: false, reason: 'NO_MEDIA_DEVICES', message: 'Environment does not support audio devices.' };
  }
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return { supported: false, reason: 'NO_MEDIA_DEVICES', message: 'Browser does not support microphone access.' };
  }
  if (window.isSecureContext === false && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return { supported: false, reason: 'INSECURE_CONTEXT', message: 'Microphone requires a secure HTTPS connection.' };
  }
  if (typeof MediaRecorder === 'undefined') {
    return { supported: false, reason: 'NO_RECORDER', message: 'MediaRecorder is not supported in this browser.' };
  }
  return { supported: true };
}

export interface MicPermissionResult {
  granted: boolean;
  stream: MediaStream | null;
  error?: 'PERMISSION_DENIED' | 'NOT_FOUND' | 'INSECURE_CONTEXT' | 'UNSUPPORTED' | 'UNKNOWN';
  message?: string;
}

/**
 * Safely requests microphone permission with localized friendly messages.
 */
export async function requestMicrophoneStream(): Promise<MicPermissionResult> {
  const support = checkMicrophoneSupport();
  if (!support.supported) {
    return {
      granted: false,
      stream: null,
      error: support.reason === 'INSECURE_CONTEXT' ? 'INSECURE_CONTEXT' : 'UNSUPPORTED',
      message: support.message,
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    return { granted: true, stream };
  } catch (err: unknown) {
    const errorName = (err as Error)?.name || '';
    if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
      return {
        granted: false,
        stream: null,
        error: 'PERMISSION_DENIED',
        message: 'Microphone access is blocked. Please enable microphone permission in your browser or Telegram settings.',
      };
    }
    if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
      return {
        granted: false,
        stream: null,
        error: 'NOT_FOUND',
        message: 'No microphone was detected on this device.',
      };
    }
    return {
      granted: false,
      stream: null,
      error: 'UNKNOWN',
      message: (err as Error)?.message || 'Failed to initialize microphone.',
    };
  }
}

export interface VoiceRecordingResult {
  audioData: string;
  durationMs: number;
  waveform: number[];
}

const DEFAULT_WAVEFORM_BARS = 14;

/**
 * Active Voice Recorder manager for Walkie-Talkie Hold-to-Talk.
 */
export class WalkieTalkieRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime = 0;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private recordedWaveformSamples: number[][] = [];
  private isCancelled = false;
  private selectedMime = '';

  constructor(
    private readonly onLiveWaveform?: (bars: number[]) => void,
    private readonly onTimeUpdate?: (elapsedMs: number) => void,
  ) {}

  async start(): Promise<{ success: boolean; error?: string; cancelled?: boolean }> {
    this.isCancelled = false;
    this.chunks = [];
    this.recordedWaveformSamples = [];

    const perm = await requestMicrophoneStream();

    // The user may have released/cancelled while the permission prompt was open.
    if (this.isCancelled) {
      perm.stream?.getTracks().forEach((track) => track.stop());
      return { success: false, cancelled: true };
    }

    if (!perm.granted || !perm.stream) {
      return { success: false, error: perm.message || 'Microphone not available' };
    }

    this.stream = perm.stream;

    // Play walkie-talkie start chirp
    playPttStartChirp();

    // Hook up Analyser for live frequency visualization ("auto waw")
    const ctx = getAudioContext();
    if (ctx) {
      try {
        const source = ctx.createMediaStreamSource(this.stream);
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 64;
        this.analyser.smoothingTimeConstant = 0.65;
        source.connect(this.analyser);
      } catch {
        // Continue if analyser fails
      }
    }

    // Determine MIME type
    const candidateTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    let selectedMime = '';
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
      for (const type of candidateTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMime = type;
          this.selectedMime = type;
          break;
        }
      }
    }

    try {
      this.recorder = selectedMime
        ? new MediaRecorder(this.stream, { mimeType: selectedMime, audioBitsPerSecond: 32_000 })
        : new MediaRecorder(this.stream, { audioBitsPerSecond: 32_000 });
    } catch {
      try {
        this.recorder = selectedMime
          ? new MediaRecorder(this.stream, { mimeType: selectedMime })
          : new MediaRecorder(this.stream);
      } catch {
        this.cleanup();
        return { success: false, error: 'Could not create audio recorder.' };
      }
    }

    this.recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.startTime = Date.now();
    try {
      this.recorder.start(100);
    } catch {
      this.cleanup();
      return { success: false, error: 'Could not start audio recorder.' };
    }

    // Start live waveform and timer loop
    this.startAnalysisLoop();

    return { success: true };
  }

  private startAnalysisLoop(): void {
    const dataArray = this.analyser ? new Uint8Array(this.analyser.frequencyBinCount) : null;

    const tick = () => {
      if (this.isCancelled || !this.recorder || this.recorder.state !== 'recording') return;

      const elapsed = Date.now() - this.startTime;
      this.onTimeUpdate?.(elapsed);

      if (this.analyser && dataArray) {
        this.analyser.getByteFrequencyData(dataArray);

        // Group into DEFAULT_WAVEFORM_BARS normalized values (0.05 to 1.0)
        const bars: number[] = [];
        const step = Math.max(1, Math.floor(dataArray.length / DEFAULT_WAVEFORM_BARS));
        for (let i = 0; i < DEFAULT_WAVEFORM_BARS; i++) {
          let sum = 0;
          let count = 0;
          for (let j = 0; j < step; j++) {
            const idx = i * step + j;
            if (idx < dataArray.length) {
              sum += dataArray[idx] ?? 0;
              count++;
            }
          }
          const avg = count > 0 ? sum / count : 0;
          const normalized = Math.max(0.08, Math.min(1.0, +(avg / 255).toFixed(2)));
          bars.push(normalized);
        }

        this.onLiveWaveform?.(bars);
        this.recordedWaveformSamples.push(bars);
      }

      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  cancel(): void {
    this.isCancelled = true;
    playCancelBeep();
    this.cleanup();
  }

  async stop(): Promise<VoiceRecordingResult | null> {
    if (this.isCancelled || !this.recorder) {
      this.cleanup();
      return null;
    }

    const durationMs = this.startTime > 0 ? Math.max(400, Date.now() - this.startTime) : 400;

    return new Promise((resolve) => {
      if (!this.recorder || this.recorder.state === 'inactive') {
        this.cleanup();
        resolve(null);
        return;
      }

      this.recorder.onstop = () => {
        const mimeType = this.recorder?.mimeType || this.selectedMime || 'audio/webm';
        const blob = new Blob(this.chunks, { type: mimeType });
        this.cleanup();

        if (blob.size === 0) {
          resolve(null);
          return;
        }

        // Play authentic roger beep on successful transmission
        playRogerBeep();

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;

          // Compute final waveform signature
          const finalWaveform = this.computeFinalWaveform();

          resolve({
            audioData: base64Audio,
            durationMs,
            waveform: finalWaveform,
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      };

      try {
        this.recorder.stop();
      } catch {
        this.cleanup();
        resolve(null);
      }
    });
  }

  private computeFinalWaveform(): number[] {
    if (this.recordedWaveformSamples.length === 0) {
      return [0.2, 0.5, 0.8, 0.4, 0.7, 0.9, 0.6, 0.3, 0.7, 0.8, 0.4, 0.2];
    }

    const finalBars: number[] = new Array(DEFAULT_WAVEFORM_BARS).fill(0);
    for (const sample of this.recordedWaveformSamples) {
      for (let i = 0; i < DEFAULT_WAVEFORM_BARS; i++) {
        finalBars[i] = Math.max(finalBars[i] ?? 0, sample[i] ?? 0.1);
      }
    }
    return finalBars.map((val) => +(val.toFixed(2)));
  }

  private cleanup(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.recorder = null;
    this.analyser = null;
    this.chunks = [];
  }
}

/**
 * Convert base64 data URL to ArrayBuffer synchronously.
 */
export function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer | null {
  try {
    const comma = dataUrl.indexOf(',');
    const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    if (typeof atob !== 'function') return null;
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch {
    return null;
  }
}

/**
 * Play a received voice message with walkie-talkie cues and progress tracking.
 * Uses Web Audio API buffer playback first (exempt from HTML5 element autoplay restrictions),
 * with seamless fallback to HTML5 Audio element.
 */
export function playVoiceAudio(
  audioData: string,
  onStateChange?: (state: { isPlaying: boolean; progress: number }) => void,
): { stop: () => void } {
  if (!validateVoiceDataUrl(audioData)) {
    onStateChange?.({ isPlaying: false, progress: 0 });
    return { stop: () => undefined };
  }

  // Squelch tone when incoming transmission opens
  playPttStartChirp();

  let isStopped = false;
  let activeSource: AudioBufferSourceNode | null = null;
  let fallbackAudio: HTMLAudioElement | null = null;
  let animFrameId: number | null = null;

  const stopAll = () => {
    isStopped = true;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (activeSource) {
      try {
        activeSource.stop();
      } catch {
        // Ignored
      }
      activeSource = null;
    }
    if (fallbackAudio) {
      try {
        fallbackAudio.pause();
        fallbackAudio.currentTime = 0;
      } catch {
        // Ignored
      }
      fallbackAudio = null;
    }
    onStateChange?.({ isPlaying: false, progress: 0 });
  };

  const playViaHtml5 = () => {
    if (isStopped) return;
    try {
      const audio = new Audio(audioData);
      audio.preload = 'auto';
      audio.setAttribute('playsinline', '');
      audio.setAttribute('webkit-playsinline', '');
      fallbackAudio = audio;

      const handleTimeUpdate = () => {
        if (isStopped) return;
        const progress = audio.duration ? Math.min(1.0, audio.currentTime / audio.duration) : 0;
        onStateChange?.({ isPlaying: true, progress });
      };

      const handleEnded = () => {
        if (isStopped) return;
        onStateChange?.({ isPlaying: false, progress: 1.0 });
        playRogerBeep();
      };

      const handleError = () => {
        if (isStopped) return;
        onStateChange?.({ isPlaying: false, progress: 0 });
      };

      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);

      audio.play().catch(() => {
        onStateChange?.({ isPlaying: false, progress: 0 });
      });
    } catch {
      onStateChange?.({ isPlaying: false, progress: 0 });
    }
  };

  const ctx = getAudioContext();
  const arrayBuf = dataUrlToArrayBuffer(audioData);

  if (ctx && arrayBuf) {
    try {
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => undefined);
      }
      ctx.decodeAudioData(
        arrayBuf.slice(0),
        (audioBuffer) => {
          if (isStopped) return;
          try {
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(1.15, ctx.currentTime);
            source.connect(gain);
            gain.connect(ctx.destination);
            activeSource = source;

            const duration = audioBuffer.duration;
            const startCtxTime = ctx.currentTime;

            const tickProgress = () => {
              if (isStopped || !activeSource) return;
              const elapsed = ctx.currentTime - startCtxTime;
              const progress = Math.min(1.0, elapsed / duration);
              onStateChange?.({ isPlaying: true, progress });
              if (progress < 1.0) {
                animFrameId = requestAnimationFrame(tickProgress);
              }
            };
            animFrameId = requestAnimationFrame(tickProgress);

            source.onended = () => {
              if (isStopped) return;
              activeSource = null;
              if (animFrameId) cancelAnimationFrame(animFrameId);
              onStateChange?.({ isPlaying: false, progress: 1.0 });
              playRogerBeep();
            };

            source.start(0);
          } catch {
            playViaHtml5();
          }
        },
        () => {
          playViaHtml5();
        },
      );
    } catch {
      playViaHtml5();
    }
  } else {
    playViaHtml5();
  }

  return { stop: stopAll };
}
