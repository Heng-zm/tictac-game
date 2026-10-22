import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Radio, Trash2, ChevronUp, AlertCircle, Volume2 } from 'lucide-react';
import {
  checkMicrophoneSupport,
  playCancelBeep,
  WalkieTalkieRecorder,
} from '../../lib/audio-radio';

interface WalkieTalkieButtonProps {
  matchId: string;
  onSendVoice: (audioData: string, durationMs: number, waveform: number[]) => Promise<void>;
  disabled?: boolean;
}

const MAX_RECORDING_MS = 10_000;
const MIN_HOLD_DURATION_MS = 500;
const CANCEL_SLIDE_DISTANCE_PX = 50;

export const WalkieTalkieButton: React.FC<WalkieTalkieButtonProps> = ({
  onSendVoice,
  disabled = false,
}) => {
  const [status, setStatus] = useState<'idle' | 'recording' | 'cancelling' | 'sending'>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [liveWaveform, setLiveWaveform] = useState<number[]>([0.15, 0.2, 0.15, 0.25, 0.15]);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [shortTapHint, setShortTapHint] = useState(false);

  const recorderRef = useRef<WalkieTalkieRecorder | null>(null);
  const startPointerY = useRef(0);
  const startPointerX = useRef(0);
  const startTimeRef = useRef(0);
  const statusRef = useRef(status);
  statusRef.current = status;
  const isHeldRef = useRef(false);

  // Clear short tap hint after 2.5s
  useEffect(() => {
    if (!shortTapHint) return;
    const t = setTimeout(() => setShortTapHint(false), 2500);
    return () => clearTimeout(t);
  }, [shortTapHint]);

  const commitRecording = useCallback(
    async (recorder: WalkieTalkieRecorder) => {
      setStatus('sending');
      try {
        const result = await recorder.stop();
        if (result && result.audioData) {
          await onSendVoice(result.audioData, result.durationMs, result.waveform);
        }
      } catch {
        // Voice sending failed silently handled by toasts
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
      setPermissionError(support.message || 'Microphone is not supported.');
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
      (bars) => setLiveWaveform(bars),
      (ms) => setElapsedMs(ms),
    );
    recorderRef.current = recorder;

    const res = await recorder.start();
    if (!res.success) {
      isHeldRef.current = false;
      recorderRef.current = null;
      setPermissionError(res.error || 'Microphone permission denied.');
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

    // Slide up by 50px or diagonal drag away to cancel
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

    // 1. Accidental short tap (<500ms) prevention
    if (holdDuration < MIN_HOLD_DURATION_MS) {
      if (rec) rec.cancel();
      recorderRef.current = null;
      setStatus('idle');
      setElapsedMs(0);
      playCancelBeep();
      setShortTapHint(true);
      return;
    }

    // 2. Drag-to-cancel check
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
  const tenths = Math.floor((elapsedMs % 1000) / 100);
  const progressRatio = Math.min(1.0, elapsedMs / MAX_RECORDING_MS);

  return (
    <>
      {/* Short Tap Hint Toast */}
      {shortTapHint && (
        <div
          role="status"
          aria-live="polite"
          className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-amber-500/30 bg-amber-950/90 px-3 py-1.5 text-[11px] font-semibold text-amber-300 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
        >
          <Volume2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Hold to talk (Icom Walkie-Talkie)</span>
        </div>
      )}

      {/* Permission Error Modal / Alert */}
      {permissionError && (
        <div
          role="dialog"
          aria-label="Microphone permission required"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="w-full max-w-xs rounded-2xl border border-rose-500/30 bg-slate-900 p-4 text-center shadow-2xl">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 mb-3">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Microphone Access</h4>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">{permissionError}</p>
            <button
              type="button"
              onClick={() => setPermissionError(null)}
              className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2 text-xs font-semibold text-white transition active:scale-95"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Live Walkie-Talkie Transmit HUD overlay during hold */}
      {(status === 'recording' || status === 'cancelling' || status === 'sending') && (
        <div
          role="region"
          aria-label="Walkie-Talkie transmission in progress"
          className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+120px)] sm:bottom-[calc(env(safe-area-inset-bottom)+110px)] z-50 mx-auto max-w-sm flex flex-col items-center pointer-events-none select-none animate-in fade-in zoom-in-95 duration-150"
        >
          <div
            className={`w-full rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl transition-all duration-200 ${
              status === 'cancelling'
                ? 'border-rose-500/60 bg-rose-950/90 shadow-rose-950/50 scale-105'
                : 'border-emerald-500/50 bg-slate-950/95 shadow-emerald-950/50'
            }`}
          >
            {/* Header: Radio Callsign & Transmission LED */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
              <div className="flex items-center gap-2">
                <Radio
                  className={`h-4 w-4 ${status === 'cancelling' ? 'text-rose-400' : 'text-emerald-400 animate-pulse'}`}
                />
                <span className="text-[11px] font-mono font-bold tracking-wider text-slate-200 uppercase">
                  ICOM PTT · CH-01
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    status === 'cancelling'
                      ? 'bg-rose-500 animate-ping'
                      : status === 'sending'
                      ? 'bg-amber-400'
                      : 'bg-emerald-500 animate-ping'
                  }`}
                />
                <span
                  className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                    status === 'cancelling'
                      ? 'text-rose-400'
                      : status === 'sending'
                      ? 'text-amber-300'
                      : 'text-emerald-400'
                  }`}
                >
                  {status === 'cancelling' ? 'DISCARD' : status === 'sending' ? 'SENDING' : 'TX ON AIR'}
                </span>
              </div>
            </div>

            {/* Live Waveform ("auto waw") & Timer */}
            <div className="flex items-center justify-between gap-3 my-1">
              {/* Dynamic Frequency Bars */}
              <div
                className="flex items-center gap-1.5 h-10 flex-1 px-2 rounded-xl bg-black/40 border border-white/5"
                title="Live Audio Waveform"
              >
                {liveWaveform.map((level, idx) => {
                  const barHeight = Math.max(12, Math.round(level * 36));
                  return (
                    <div
                      key={idx}
                      className="flex-1 rounded-full transition-all duration-75"
                      style={{
                        height: `${barHeight}px`,
                        backgroundColor:
                          status === 'cancelling'
                            ? '#f43f5e'
                            : level > 0.6
                            ? '#10b981'
                            : level > 0.3
                            ? '#34d399'
                            : '#059669',
                        opacity: status === 'cancelling' ? 0.9 : 0.4 + level * 0.6,
                      }}
                    />
                  );
                })}
              </div>

              {/* Transmission Timer Ring */}
              <div className="flex flex-col items-center justify-center shrink-0 w-14">
                <span className="font-mono text-sm font-black tracking-tight text-white">
                  0:{seconds < 10 ? `0${seconds}` : seconds}
                  <span className="text-[10px] text-slate-400">.{tenths}</span>
                </span>
                <span className="text-[9px] font-mono text-slate-400 uppercase">max 10s</span>
              </div>
            </div>

            {/* Auto-Stop Progress Bar */}
            <div className="w-full h-1 bg-white/10 rounded-full mt-2.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  status === 'cancelling'
                    ? 'bg-rose-500'
                    : progressRatio > 0.8
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.round(progressRatio * 100)}%` }}
              />
            </div>

            {/* Slide up to cancel indicator */}
            <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold">
              {status === 'cancelling' ? (
                <div className="flex items-center gap-1.5 text-rose-400 animate-bounce">
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Release to cancel</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-slate-400">
                  <ChevronUp className="h-3.5 w-3.5 animate-bounce" />
                  <span>Slide up to cancel</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Hold-to-Talk Push Button */}
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        disabled={disabled}
        aria-label="Hold to talk with Icom walkie-talkie"
        title="Hold to talk (Icom Walkie-Talkie)"
        className={`pointer-events-auto relative flex h-10 px-3 shrink-0 items-center justify-center gap-1.5 rounded-2xl border font-bold text-xs shadow-soft transition-all duration-150 select-none touch-none ${
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
        ) : (
          <Mic
            className={`h-4 w-4 ${
              status === 'recording'
                ? 'text-white animate-pulse'
                : 'text-accent'
            }`}
            aria-hidden
          />
        )}
        <span className="text-[11px] font-semibold tracking-wide uppercase">
          {status === 'recording'
            ? 'REC'
            : status === 'cancelling'
            ? 'CANCEL'
            : status === 'sending'
            ? 'SENDING'
            : 'PTT'}
        </span>
      </button>
    </>
  );
};
