/**
 * Procedural Walkie-Talkie (Icom) Radio Audio Engine & Voice Recorder
 *
 * Provides:
 * 1. Authentic procedural walkie-talkie SFX (PTT key-on chirp, squelch roger-beep, cancel blip).
 * 2. Microphone permission detection with graceful degradation ("not always allowed").
 * 3. MediaRecorder + Web Audio Analyser for live visual waveforms ("auto waw").
 * 4. Audio playback with auto-play handling for opponent ("auto play auto waw").
 */

import {
  normalizeVoiceDataUrl,
  validateVoiceDataUrl,
} from '../../shared/audio';

let sharedAudioContext: AudioContext | null = null;

/** Voice notes are re-encoded as 16 kHz mono PCM so every client can play them. */
const VOICE_WAV_SAMPLE_RATE = 16_000;
/** Mirrors the walkie-talkie's maximum hold time. */
const VOICE_MAX_CAPTURE_MS = 10_000;
const VOICE_MIN_CAPTURE_MS = 400;

function clampVoiceDuration(durationMs: number): number {
  return Math.min(VOICE_MAX_CAPTURE_MS, Math.max(VOICE_MIN_CAPTURE_MS, Math.round(durationMs)));
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

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
  private destination: MediaStreamAudioDestinationNode | null = null;
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
    let recordStream = this.stream;

    // Play walkie-talkie start chirp
    playPttStartChirp();

    // Hook up Analyser for live frequency visualization ("auto waw").
    //
    // iOS Safari has historically "stolen" the microphone track from
    // MediaRecorder as soon as it is attached to a Web Audio graph. Recording
    // from a MediaStreamAudioDestinationNode keeps the graph and the recorder
    // on the same stream, and skipping the graph while the AudioContext is
    // suspended prevents a silent recording.
    const ctx = getAudioContext();
    if (ctx && (!isIosDevice() || ctx.state === 'running')) {
      try {
        const source = ctx.createMediaStreamSource(this.stream);
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 64;
        this.analyser.smoothingTimeConstant = 0.65;
        source.connect(this.analyser);

        if (isIosDevice()) {
          this.destination = ctx.createMediaStreamDestination();
          this.analyser.connect(this.destination);
          recordStream = this.destination.stream;
        }
      } catch {
        // Continue with the raw microphone stream if the analyser fails.
        this.analyser = null;
        this.destination = null;
        recordStream = this.stream;
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
        ? new MediaRecorder(recordStream, { mimeType: selectedMime, audioBitsPerSecond: 32_000 })
        : new MediaRecorder(recordStream, { audioBitsPerSecond: 32_000 });
    } catch {
      try {
        this.recorder = selectedMime
          ? new MediaRecorder(recordStream, { mimeType: selectedMime })
          : new MediaRecorder(recordStream);
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
        const finalWaveform = this.computeFinalWaveform();
        this.cleanup();

        if (blob.size === 0) {
          resolve(null);
          return;
        }

        // Play authentic roger beep on successful transmission
        playRogerBeep();

        void prepareVoiceRecording(blob, durationMs)
          .then((prepared) => {
            resolve(prepared ? { ...prepared, waveform: finalWaveform } : null);
          })
          .catch(() => resolve(null));
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
    if (this.destination) {
      this.destination.stream.getTracks().forEach((track) => track.stop());
      this.destination = null;
    }
    this.recorder = null;
    this.analyser = null;
    this.chunks = [];
  }
}

interface PreparedVoiceRecording {
  audioData: string;
  durationMs: number;
}

/**
 * Converts a browser recording into a 16 kHz mono WAV data URL. WAV is
 * universally supported for playback, so a WebM/Opus note recorded on Android
 * also plays in Safari, and an iOS MP4/AAC note plays everywhere else.
 *
 * If the browser cannot decode its own recording, the original data URL is
 * used instead after its MIME label has been repaired from the magic bytes.
 */
export async function prepareVoiceRecording(
  blob: Blob,
  measuredDurationMs: number,
): Promise<PreparedVoiceRecording | null> {
  const wav = await transcodeBlobToWav(blob).catch(() => null);
  if (wav) {
    return {
      audioData: wav.dataUrl,
      durationMs: clampVoiceDuration(Math.min(measuredDurationMs, wav.durationMs)),
    };
  }

  const dataUrl = await readBlobAsDataUrl(blob);
  const normalized = dataUrl ? normalizeVoiceDataUrl(dataUrl) : null;
  if (!normalized) return null;
  return { audioData: normalized, durationMs: clampVoiceDuration(measuredDurationMs) };
}

async function transcodeBlobToWav(
  blob: Blob,
): Promise<{ dataUrl: string; durationMs: number } | null> {
  const ctx = getAudioContext();
  if (!ctx) return null;

  const encoded = await blob.arrayBuffer();
  if (encoded.byteLength === 0) return null;

  const decoded = await decodeAudioBuffer(ctx, encoded);
  if (!decoded || decoded.duration <= 0) return null;

  const maxFrames = Math.round((VOICE_MAX_CAPTURE_MS / 1000) * VOICE_WAV_SAMPLE_RATE);
  const frames = Math.max(1, Math.min(Math.round(decoded.duration * VOICE_WAV_SAMPLE_RATE), maxFrames));
  const samples = await renderMonoSamples(decoded, frames);
  if (!samples) return null;

  const wav = encodePcmWav(samples, VOICE_WAV_SAMPLE_RATE);
  const dataUrl = `data:audio/wav;base64,${arrayBufferToBase64(wav)}`;
  if (!validateVoiceDataUrl(dataUrl)) return null;

  return {
    dataUrl,
    durationMs: Math.round((samples.length / VOICE_WAV_SAMPLE_RATE) * 1000),
  };
}

function decodeAudioBuffer(ctx: AudioContext, encoded: ArrayBuffer): Promise<AudioBuffer | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (buffer: AudioBuffer | null) => {
      if (settled) return;
      settled = true;
      resolve(buffer);
    };

    try {
      const maybePromise = ctx.decodeAudioData(
        encoded.slice(0),
        (buffer) => finish(buffer),
        () => finish(null),
      ) as unknown;
      if (maybePromise && typeof (maybePromise as Promise<AudioBuffer>).then === 'function') {
        (maybePromise as Promise<AudioBuffer>)
          .then((buffer) => finish(buffer))
          .catch(() => finish(null));
      }
    } catch {
      finish(null);
    }
  });
}

async function renderMonoSamples(buffer: AudioBuffer, frames: number): Promise<Float32Array | null> {
  if (typeof OfflineAudioContext !== 'undefined') {
    try {
      const offline = new OfflineAudioContext(1, frames, VOICE_WAV_SAMPLE_RATE);
      const source = offline.createBufferSource();
      source.buffer = buffer;
      source.connect(offline.destination);
      source.start(0);
      const rendered = await offline.startRendering();
      return rendered.getChannelData(0).slice(0, frames);
    } catch {
      // Fall through to the manual downmix/resample path.
    }
  }

  try {
    const channelCount = Math.max(1, buffer.numberOfChannels);
    const mono = new Float32Array(buffer.length);
    for (let channel = 0; channel < channelCount; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < mono.length; index += 1) {
        mono[index] = (mono[index] ?? 0) + (data[index] ?? 0);
      }
    }
    for (let index = 0; index < mono.length; index += 1) {
      mono[index] = (mono[index] ?? 0) / channelCount;
    }

    const output = new Float32Array(frames);
    const ratio = buffer.sampleRate / VOICE_WAV_SAMPLE_RATE;
    for (let index = 0; index < frames; index += 1) {
      const position = Math.min(buffer.length - 1, index * ratio);
      const left = Math.floor(position);
      const fraction = position - left;
      output[index] = (mono[left] ?? 0) * (1 - fraction) + (mono[left + 1] ?? 0) * fraction;
    }
    return output;
  } catch {
    return null;
  }
}

/** Encodes mono float samples as a 16-bit PCM WAV file. */
export function encodePcmWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function readBlobAsDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    } catch {
      resolve(null);
    }
  });
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

  if (!ctx || !arrayBuf) {
    playViaHtml5();
    return { stop: stopAll };
  }

  // A suspended AudioContext schedules sources but never plays them, which is
  // the classic "voice received but silent" symptom in iOS WebViews. Only use
  // Web Audio when the context is (or can become) running; otherwise route the
  // note through an HTML5 element so the platform gets its own chance to play.
  void (async () => {
    const running = await ensureAudioContextRunning(ctx);
    if (isStopped) return;
    if (!running) {
      playViaHtml5();
      return;
    }

    const audioBuffer = await decodeAudioBuffer(ctx, arrayBuf);
    if (isStopped) return;
    if (!audioBuffer || ctx.state !== 'running') {
      playViaHtml5();
      return;
    }

    try {
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(1.15, ctx.currentTime);
      source.connect(gain);
      gain.connect(ctx.destination);

      const duration = audioBuffer.duration;
      const startCtxTime = ctx.currentTime;

      source.onended = () => {
        if (isStopped) return;
        activeSource = null;
        if (animFrameId) cancelAnimationFrame(animFrameId);
        onStateChange?.({ isPlaying: false, progress: 1.0 });
        playRogerBeep();
      };

      source.start(0);
      activeSource = source;

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
    } catch {
      playViaHtml5();
    }
  })();

  return { stop: stopAll };
}

/**
 * Resumes a suspended AudioContext and reports whether it is really running.
 * `resume()` can resolve while the context stays suspended when the call was
 * made outside a user gesture, so the state is checked instead of assumed.
 */
async function ensureAudioContextRunning(ctx: AudioContext): Promise<boolean> {
  if (ctx.state === 'running') return true;
  if (ctx.state !== 'suspended') return false;
  try {
    await ctx.resume();
  } catch {
    return false;
  }
  // `resume()` can resolve while the context remains suspended when it was
  // called outside a user gesture, so re-read the state before trusting it.
  return currentAudioContextState(ctx) === 'running';
}

function currentAudioContextState(ctx: AudioContext): AudioContextState {
  return ctx.state;
}
