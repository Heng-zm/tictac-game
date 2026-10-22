import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Trash2, Loader2 } from 'lucide-react';
import {
  checkMicrophoneSupport,
  playCancelBeep,
  WalkieTalkieRecorder,
} from '../../lib/audio-radio';

interface WalkieTalkieButtonProps {
  matchId: string;
  onSendVoice: (audioData: string, durationMs: number, waveform: number[]) => Promise<void>;
  onError?: (message: string) => void;
  disabled?: boolean;
}

const MAX_RECORDING_MS = 10_000;
const MIN_HOLD_DURATION_MS = 500;
const CANCEL_SLIDE_DISTANCE_PX = 50;

export const WalkieTalkieButton: React.FC<WalkieTalkieButtonProps> = ({
  onSendVoice,
  onError,
  disabled = false,
}) => {
  const [status, setStatus] = useState<'idle' | 'recording' | 'cancelling' | 'sending'>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef<WalkieTalkieRecorder | null>(null);
  const startPointerY = useRef(0);
  const startPointerX = useRef(0);
  const startTimeRef = useRef(0);
  const statusRef = useRef(status);
  statusRef.current = status;
  const isHeldRef = useRef(false);

  const commitRecording = useCallback(
    async (recorder: WalkieTalkieRecorder) => {
      setStatus('sending');
      try {
        const result = await recorder.stop();
        if (result && result.audioData) {
          await onSendVoice(result.audioData, result.durationMs, result.waveform);
        }
      } catch {
        // Voice sending error
      } finally {
        setStatus('idle');
        setElapsedMs(0);
        recorderRef.current = null;
      }
    },
    [onSendVoice],
  );

  // Auto-send when reaching MAX_RECORDING_MS (10 seconds)
  useEffect(() => {
    if (status === 'recording' && elapsedMs >= MAX_RECORDING_MS && recorderRef.current) {
      isHeldRef.current = false;
      const rec = recorderRef.current;
      void commitRecording(rec);
    }
  }, [status, elapsedMs, commitRecording]);

  const handlePointerDown = async (e: React.PointerEvent) => {
    if (disabled || status !== 'idle') return;

    // Fast check for microphone capability
    const support = checkMicrophoneSupport();
    if (!support.supported) {
      onError?.(support.message || 'Microphone is not supported.');
      return;
    }

    startPointerY.current = e.clientY;
    startPointerX.current = e.clientX;
    startTimeRef.current = Date.now();
    isHeldRef.current = true;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignored if capture unsupported
    }

    const recorder = new WalkieTalkieRecorder(
      undefined,
      (ms) => setElapsedMs(ms),
    );
    recorderRef.current = recorder;

    const res = await recorder.start();
    if (!res.success) {
      isHeldRef.current = false;
      recorderRef.current = null;
      onError?.(res.error || 'Microphone permission denied.');
      return;
    }

    // If pointer was already released while permission was prompting
    if (!isHeldRef.current) {
      recorder.cancel();
      recorderRef.current = null;
      return;
    }

    setStatus('recording');
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isHeldRef.current || (status !== 'recording' && status !== 'cancelling')) return;

    const deltaY = startPointerY.current - e.clientY;
    const deltaX = Math.abs(e.clientX - startPointerX.current);

    // Slide up or drag away by > 50px to cancel
    if (deltaY > CANCEL_SLIDE_DISTANCE_PX || deltaX > CANCEL_SLIDE_DISTANCE_PX * 1.5) {
      if (status !== 'cancelling') {
        setStatus('cancelling');
      }
    } else {
      if (status !== 'recording') {
        setStatus('recording');
      }
    }
  };

  const handlePointerUp = async (e: React.PointerEvent) => {
    if (!isHeldRef.current) return;
    isHeldRef.current = false;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    const holdDuration = Date.now() - startTimeRef.current;
    const currentStatus = statusRef.current;
    const rec = recorderRef.current;

    // 1. Accidental short tap (<500ms) prevention: discard quietly without popup
    if (holdDuration < MIN_HOLD_DURATION_MS) {
      if (rec) rec.cancel();
      recorderRef.current = null;
      setStatus('idle');
      setElapsedMs(0);
      playCancelBeep();
      return;
    }

    // 2. Drag-to-cancel check: discard cleanly
    if (currentStatus === 'cancelling') {
      if (rec) rec.cancel();
      recorderRef.current = null;
      setStatus('idle');
      setElapsedMs(0);
      return;
    }

    // 3. Valid recording completed -> Commit and send
    if (rec) {
      await commitRecording(rec);
    } else {
      setStatus('idle');
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (!isHeldRef.current) return;
    isHeldRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    if (recorderRef.current) {
      recorderRef.current.cancel();
      recorderRef.current = null;
    }
    setStatus('idle');
    setElapsedMs(0);
  };

  const seconds = Math.min(10, Math.floor(elapsedMs / 1000));

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      disabled={disabled}
      aria-label="Hold to record voice, release to send, slide to cancel"
      title="Hold to talk (Icom Walkie-Talkie)"
      className={`pointer-events-auto relative flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-2xl border font-bold text-xs shadow-soft transition-all duration-150 select-none touch-none ${
        status === 'idle' ? 'w-10 px-0 sm:w-auto sm:px-3' : 'px-3'
      } ${
        status === 'recording'
          ? 'scale-105 border-emerald-500/80 bg-emerald-600 text-white shadow-emerald-500/40 ring-4 ring-emerald-500/20'
          : status === 'cancelling'
          ? 'scale-105 border-rose-500/80 bg-rose-600 text-white shadow-rose-500/40 ring-4 ring-rose-500/20'
          : status === 'sending'
          ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
          : 'border-line bg-surface text-ink hover:bg-elevated hover:border-accent/40 active:scale-95'
      }`}
    >
      {status === 'cancelling' ? (
        <Trash2 className="h-4 w-4 text-white animate-bounce" aria-hidden />
      ) : status === 'sending' ? (
        <Loader2 className="h-4 w-4 animate-spin text-amber-300" aria-hidden />
      ) : status === 'recording' ? (
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
        </span>
      ) : (
        <Mic className="h-4 w-4 text-accent" aria-hidden />
      )}

      <span
        aria-live="polite"
        className={`text-[11px] font-semibold uppercase tracking-wide ${
          status === 'idle' ? 'hidden sm:inline' : ''
        }`}
      >
        {status === 'recording'
          ? `REC ${seconds}s`
          : status === 'cancelling'
          ? 'CANCEL'
          : status === 'sending'
          ? 'SEND'
          : 'PTT'}
      </span>
    </button>
  );
};
