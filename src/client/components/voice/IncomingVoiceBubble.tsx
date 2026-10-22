import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Radio, X, Volume2 } from 'lucide-react';
import type { MatchVoiceEvent } from '../../../shared/events';
import { playVoiceAudio } from '../../lib/audio-radio';

interface IncomingVoiceBubbleProps {
  voice: MatchVoiceEvent;
  onDismiss: () => void;
  senderName: string;
  isYou: boolean;
  align?: 'left' | 'right';
}

export const IncomingVoiceBubble: React.FC<IncomingVoiceBubbleProps> = ({
  voice,
  onDismiss,
  senderName,
  isYou,
  align = 'left',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const audioControllerRef = useRef<{ stop: () => void } | null>(null);
  const autoPlayStartedRef = useRef(false);

  // Play audio on mount
  useEffect(() => {
    if (autoPlayStartedRef.current) return;
    autoPlayStartedRef.current = true;

    const controller = playVoiceAudio(voice.audioData, (state) => {
      setIsPlaying(state.isPlaying);
      setPlaybackProgress(state.progress);

      // Auto dismiss 3.5 seconds after playback finishes
      if (!state.isPlaying && state.progress >= 1.0) {
        setTimeout(() => {
          onDismiss();
        }, 3500);
      }
    });

    audioControllerRef.current = controller;

    return () => {
      if (audioControllerRef.current) {
        audioControllerRef.current.stop();
        audioControllerRef.current = null;
      }
    };
  }, [voice, onDismiss]);

  const togglePlayPause = () => {
    if (isPlaying) {
      if (audioControllerRef.current) {
        audioControllerRef.current.stop();
        audioControllerRef.current = null;
      }
      setIsPlaying(false);
    } else {
      const controller = playVoiceAudio(voice.audioData, (state) => {
        setIsPlaying(state.isPlaying);
        setPlaybackProgress(state.progress);
        if (!state.isPlaying && state.progress >= 1.0) {
          setTimeout(() => {
            onDismiss();
          }, 3500);
        }
      });
      audioControllerRef.current = controller;
    }
  };

  const durationSec = (voice.durationMs / 1000).toFixed(1);
  const waveformBars =
    voice.waveform && voice.waveform.length > 0
      ? voice.waveform
      : [0.2, 0.5, 0.8, 0.4, 0.7, 0.9, 0.6, 0.3, 0.7, 0.8, 0.4, 0.2];

  return (
    <div
      role="region"
      aria-label={`Voice message from ${senderName}`}
      className={`relative z-40 flex items-center animate-in fade-in zoom-in-95 duration-200 ${
        align === 'right' ? 'justify-end' : 'justify-start'
      }`}
    >
      <div
        className={`flex max-w-[260px] sm:max-w-[280px] flex-col rounded-2xl border px-3 py-2 shadow-xl backdrop-blur-xl transition-all ${
          isYou
            ? 'border-accent/40 bg-slate-900/95 text-white shadow-accent/20'
            : 'border-emerald-500/40 bg-slate-950/95 text-white shadow-emerald-950/40'
        }`}
      >
        {/* Callsign and close button header */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Radio
              className={`h-3 w-3 shrink-0 ${
                isPlaying ? 'text-emerald-400 animate-pulse' : 'text-slate-400'
              }`}
            />
            <span className="truncate text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
              {isYou ? 'YOU · TX' : `${senderName} · RX`}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[9px] font-mono text-slate-400">{durationSec}s</span>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss voice message"
              className="rounded-lg p-0.5 text-slate-400 hover:text-white transition"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Play/Pause Button & Animated Waveform ("auto waw") */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={togglePlayPause}
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition active:scale-90 ${
              isPlaying
                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                : 'bg-white/15 text-white hover:bg-white/25'
            }`}
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
            )}
          </button>

          {/* Dancing Waveform Bars */}
          <div
            className="flex h-8 flex-1 items-center gap-1 cursor-pointer"
            onClick={togglePlayPause}
            title="Tap to replay"
          >
            {waveformBars.map((level, index) => {
              const barProgress = index / waveformBars.length;
              const isPast = playbackProgress >= barProgress;
              const barHeight = Math.max(8, Math.round(level * 28));

              return (
                <div
                  key={index}
                  className="flex-1 rounded-full transition-all duration-100"
                  style={{
                    height: `${barHeight}px`,
                    backgroundColor: isPast ? '#10b981' : 'rgba(255, 255, 255, 0.25)',
                    transform: isPlaying && isPast ? 'scaleY(1.15)' : 'scaleY(1.0)',
                  }}
                />
              );
            })}
          </div>

          <Volume2
            className={`h-3.5 w-3.5 shrink-0 ${
              isPlaying ? 'text-emerald-400 animate-pulse' : 'text-slate-500'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
