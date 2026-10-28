import { memo, useId } from 'react';
import type { StickerId } from '../../../shared/stickers';

interface StickerCharacterProps {
  id: StickerId;
  size?: number;
  className?: string;
  animate?: boolean;
}

export const StickerCharacter = memo(function StickerCharacter({
  id,
  size = 64,
  className = '',
  animate = true,
}: StickerCharacterProps) {
  const reactId = useId();
  const idPrefix = `stk_${reactId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const animClass = animate ? 'sticker-animated' : 'sticker-static';

  return (
    <div
      className={`inline-flex items-center justify-center select-none ${animClass} ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible drop-shadow-sm"
      >
        <defs>
          <radialGradient id={`${idPrefix}-body`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="45%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </radialGradient>
          <radialGradient id={`${idPrefix}-highlight`} cx="30%" cy="25%" r="35%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${idPrefix}-body-red`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#F87171" />
            <stop offset="45%" stopColor="#EF4444" />
            <stop offset="100%" stopColor="#B91C1C" />
          </radialGradient>
          <radialGradient id={`${idPrefix}-gold`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="60%" stopColor="#EAB308" />
            <stop offset="100%" stopColor="#CA8A04" />
          </radialGradient>
          <radialGradient id={`${idPrefix}-aura`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FCD34D" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${idPrefix}-glove-red`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#F87171" />
            <stop offset="50%" stopColor="#EF4444" />
            <stop offset="100%" stopColor="#991B1B" />
          </radialGradient>
          <radialGradient id={`${idPrefix}-glove-blue`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="50%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </radialGradient>
        </defs>

        <style>{`
          /* --- Springy, bouncy keyframe motions --- */
          @keyframes st-victory-jump {
            0%, 100% { transform: translateY(0) scale(1, 1); }
            15% { transform: translateY(4px) scale(1.08, 0.92); }
            45% { transform: translateY(-13px) scale(0.92, 1.08); }
            65% { transform: translateY(0) scale(1.06, 0.94); }
            80% { transform: translateY(-3px) scale(0.98, 1.02); }
          }
          @keyframes st-crown-sway {
            0%, 100% { transform: rotate(-5deg) translateY(0); }
            50% { transform: rotate(5deg) translateY(-2px); }
          }
          @keyframes st-trophy-shine {
            0%, 100% { transform: rotate(-3deg) scale(1); }
            50% { transform: rotate(3deg) scale(1.08); }
          }
          @keyframes st-sparkle-twinkle {
            0%, 100% { transform: scale(0.5) rotate(0deg); opacity: 0.35; }
            50% { transform: scale(1.25) rotate(45deg); opacity: 1; }
          }

          @keyframes st-greet-sway {
            0%, 100% { transform: rotate(-3deg) translateY(0); }
            50% { transform: rotate(3deg) translateY(-2px); }
          }
          @keyframes st-wave-springy {
            0%, 100% { transform: rotate(0deg); }
            20% { transform: rotate(-32deg); }
            40% { transform: rotate(22deg); }
            60% { transform: rotate(-24deg); }
            80% { transform: rotate(14deg); }
          }
          @keyframes st-wave-arc {
            0%, 100% { opacity: 0; transform: scale(0.6); }
            40% { opacity: 0.9; transform: scale(1); }
            80% { opacity: 0; transform: scale(1.3); }
          }

          @keyframes st-laugh-belly {
            0%, 100% { transform: translateY(0) rotate(-4deg) scale(1, 1); }
            25% { transform: translateY(-5px) rotate(4deg) scale(0.95, 1.05); }
            50% { transform: translateY(0) rotate(-4deg) scale(1.06, 0.94); }
            75% { transform: translateY(-4px) rotate(3deg) scale(0.97, 1.03); }
          }
          @keyframes st-tear-arc-l {
            0% { transform: translate(0, 0) scale(0); opacity: 0; }
            30% { transform: translate(-8px, -4px) scale(1.15); opacity: 1; }
            70% { transform: translate(-16px, 6px) scale(0.9); opacity: 0.8; }
            100% { transform: translate(-22px, 16px) scale(0.4); opacity: 0; }
          }
          @keyframes st-tear-arc-r {
            0% { transform: translate(0, 0) scale(0); opacity: 0; }
            30% { transform: translate(8px, -4px) scale(1.15); opacity: 1; }
            70% { transform: translate(16px, 6px) scale(0.9); opacity: 0.8; }
            100% { transform: translate(22px, 16px) scale(0.4); opacity: 0; }
          }
          @keyframes st-tongue-laugh {
            0%, 100% { transform: translateY(0) scaleY(1); }
            50% { transform: translateY(-2px) scaleY(1.25); }
          }

          @keyframes st-shock-gasp {
            0%, 100% { transform: translateY(0) scale(1); }
            12% { transform: translateY(-8px) scale(0.88, 1.14); }
            25%, 45%, 65%, 85% { transform: translateY(-2px) translateX(-2.5px) scale(1); }
            35%, 55%, 75%, 95% { transform: translateY(-2px) translateX(2.5px) scale(1); }
          }
          @keyframes st-exclamation-jump {
            0%, 100% { transform: translateY(0) scale(1); }
            30% { transform: translateY(-7px) scale(1.25); }
            50% { transform: translateY(1px) scale(0.95); }
          }
          @keyframes st-sweat-fall {
            0% { transform: translateY(0) scale(0.6); opacity: 0; }
            30% { transform: translateY(2px) scale(1); opacity: 1; }
            75% { transform: translateY(12px) scale(0.9); opacity: 0.8; }
            100% { transform: translateY(18px) scale(0.4); opacity: 0; }
          }
          @keyframes st-hands-tremble {
            0%, 100% { transform: translate(0, 0); }
            25% { transform: translate(-1.5px, 1px); }
            75% { transform: translate(1.5px, -1px); }
          }

          @keyframes st-sob-heave {
            0%, 100% { transform: translateY(0) scale(1, 1); }
            30% { transform: translateY(5px) scale(1.06, 0.94); }
            60% { transform: translateY(-5px) scale(0.95, 1.05); }
            85% { transform: translateY(2px) scale(1.02, 0.98); }
          }
          @keyframes st-tear-stream {
            0% { transform: translateY(0) scaleY(0.5); opacity: 0; }
            25% { transform: translateY(4px) scaleY(1.2); opacity: 1; }
            75% { transform: translateY(16px) scaleY(1.1); opacity: 0.85; }
            100% { transform: translateY(24px) scaleY(0.5); opacity: 0; }
          }
          @keyframes st-mouth-quiver {
            0%, 100% { transform: scaleX(1) scaleY(1); }
            30% { transform: scaleX(0.9) scaleY(1.1) translateY(0.5px); }
            70% { transform: scaleX(1.1) scaleY(0.9) translateY(-0.5px); }
          }

          @keyframes st-rage-vibe {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            20% { transform: translate(-2.5px, 1.5px) rotate(-2deg); }
            40% { transform: translate(2.5px, -1.5px) rotate(2deg); }
            60% { transform: translate(-2px, -1px) rotate(-1.5deg); }
            80% { transform: translate(2px, 1px) rotate(1.5deg); }
          }
          @keyframes st-steam-jet-l {
            0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
            30% { opacity: 0.95; }
            75% { opacity: 0.65; }
            100% { transform: translate(-15px, -15px) scale(1.4); opacity: 0; }
          }
          @keyframes st-steam-jet-r {
            0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
            30% { opacity: 0.95; }
            75% { opacity: 0.65; }
            100% { transform: translate(15px, -15px) scale(1.4); opacity: 0; }
          }
          @keyframes st-anger-mark-pulse {
            0%, 100% { transform: scale(0.85) rotate(0deg); }
            50% { transform: scale(1.35) rotate(14deg); }
          }

          @keyframes st-ponder-drift {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-5px) rotate(-2.5deg); }
          }
          @keyframes st-gear-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes st-question-bob {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-3px) scale(1.2); }
          }
          @keyframes st-chin-tap {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-2px) rotate(-6deg); }
          }

          @keyframes st-applause-bop {
            0%, 100% { transform: translateY(0) scale(1, 1); }
            50% { transform: translateY(-4px) scale(1.03, 0.97); }
          }
          @keyframes st-hand-clap-l {
            0%, 100% { transform: translate(0, 0) rotate(-16deg); }
            45% { transform: translate(8px, -2px) rotate(6deg); }
          }
          @keyframes st-hand-clap-r {
            0%, 100% { transform: translate(0, 0) rotate(16deg); }
            45% { transform: translate(-8px, -2px) rotate(-6deg); }
          }
          @keyframes st-clap-spark {
            0%, 35% { transform: scale(0); opacity: 0; }
            45% { transform: scale(1.3); opacity: 1; }
            75% { transform: scale(1.6); opacity: 0; }
            100% { transform: scale(0); opacity: 0; }
          }
          @keyframes st-star-eye-twinkle {
            0%, 100% { transform: scale(1) rotate(0deg); }
            50% { transform: scale(1.2) rotate(24deg); }
          }

          @keyframes st-reverent-bow {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            38% { transform: translateY(7px) rotate(6deg); }
            62% { transform: translateY(7px) rotate(6deg); }
            88% { transform: translateY(1px) rotate(1deg); }
          }
          @keyframes st-aura-radiate {
            0%, 100% { transform: scale(0.92); opacity: 0.45; }
            50% { transform: scale(1.12); opacity: 0.9; }
          }

          @keyframes st-tease-bob {
            0%, 100% { transform: rotate(-6deg) translateY(0); }
            50% { transform: rotate(6deg) translateY(-4px); }
          }
          @keyframes st-tongue-flutter {
            0%, 100% { transform: rotate(-9deg) scaleY(1); }
            50% { transform: rotate(9deg) scaleY(1.25); }
          }
          @keyframes st-wink-burst {
            0%, 100% { transform: scale(0.7) rotate(0deg); opacity: 0.7; }
            50% { transform: scale(1.4) rotate(45deg); opacity: 1; }
          }

          @keyframes st-proud-nod {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            30% { transform: translateY(3.5px) rotate(1.5deg); }
            55% { transform: translateY(-3px) rotate(-1deg); }
            78% { transform: translateY(1px) rotate(0deg); }
          }
          @keyframes st-thumb-pump {
            0%, 100% { transform: translate(0, 0) scale(1); }
            40%, 65% { transform: translate(3px, -3px) scale(1.16); }
          }
          @keyframes st-thumb-radiance {
            0%, 100% { opacity: 0.2; transform: scale(0.85); }
            50% { opacity: 1; transform: scale(1.25); }
          }
          @keyframes st-medal-gleam {
            0%, 100% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(12deg) scale(1.15); }
          }

          @keyframes st-boxer-shuffle {
            0%, 100% { transform: translateY(0) scale(1, 1); }
            25% { transform: translateY(-7px) scale(0.95, 1.05); }
            50% { transform: translateY(0) scale(1.05, 0.95); }
            75% { transform: translateY(-4px) scale(0.98, 1.02); }
          }
          @keyframes st-punch-left {
            0%, 100% { transform: translate(0, 0); }
            25% { transform: translate(-5px, -4px) scale(1.2); }
            45% { transform: translate(0, 0); }
          }
          @keyframes st-punch-right {
            0%, 50%, 100% { transform: translate(0, 0); }
            75% { transform: translate(5px, -4px) scale(1.2); }
          }
          @keyframes st-headband-stream {
            0%, 100% { transform: rotate(0deg) skewX(0deg); }
            50% { transform: rotate(-15deg) skewX(-12deg); }
          }
          @keyframes st-swords-glow {
            0%, 100% { opacity: 0.65; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.08); }
          }

          /* --- Class mappings --- */
          .st-victory-actor { transform-origin: 50% 75%; animation: st-victory-jump 0.85s cubic-bezier(0.28, 0.84, 0.42, 1) infinite; }
          .st-crown { transform-origin: 50% 100%; animation: st-crown-sway 0.85s ease-in-out infinite; }
          .st-trophy { transform-origin: 50% 100%; animation: st-trophy-shine 0.85s ease-in-out infinite; }
          .st-sparkle-1 { transform-origin: 50% 50%; animation: st-sparkle-twinkle 1.1s ease-in-out infinite; }
          .st-sparkle-2 { transform-origin: 50% 50%; animation: st-sparkle-twinkle 1.1s ease-in-out infinite 0.55s; }

          .st-greet-body { transform-origin: 50% 80%; animation: st-greet-sway 1.2s ease-in-out infinite; }
          .st-wave-hand { transform-origin: 15% 85%; animation: st-wave-springy 0.75s ease-in-out infinite; }
          .st-wave-ring { transform-origin: 85% 35%; animation: st-wave-arc 0.75s ease-out infinite; }

          .st-laugh-body { transform-origin: 50% 65%; animation: st-laugh-belly 0.36s cubic-bezier(0.36, 0.07, 0.19, 0.97) infinite; }
          .st-tear-l { transform-origin: 25% 45%; animation: st-tear-arc-l 0.8s ease-out infinite; }
          .st-tear-r { transform-origin: 75% 45%; animation: st-tear-arc-r 0.8s ease-out infinite 0.4s; }
          .st-tongue-laugh { transform-origin: 50% 100%; animation: st-tongue-laugh 0.36s ease-in-out infinite; }

          .st-shock-body { transform-origin: 50% 55%; animation: st-shock-gasp 0.65s cubic-bezier(0.25, 1, 0.5, 1) infinite; }
          .st-exclamation { transform-origin: 50% 100%; animation: st-exclamation-jump 0.65s ease-out infinite; }
          .st-sweat-drop { animation: st-sweat-fall 0.9s ease-in infinite; }
          .st-hands-tremble { animation: st-hands-tremble 0.2s ease-in-out infinite; }

          .st-cry-body { transform-origin: 50% 80%; animation: st-sob-heave 1.2s ease-in-out infinite; }
          .st-cry-tear-l { animation: st-tear-stream 0.9s ease-in infinite; }
          .st-cry-tear-r { animation: st-tear-stream 0.9s ease-in infinite 0.45s; }
          .st-quiver-mouth { transform-origin: 50% 50%; animation: st-mouth-quiver 0.3s ease-in-out infinite; }

          .st-rage-body { transform-origin: 50% 55%; animation: st-rage-vibe 0.25s linear infinite; }
          .st-steam-l { transform-origin: 20% 35%; animation: st-steam-jet-l 0.75s ease-out infinite; }
          .st-steam-r { transform-origin: 80% 35%; animation: st-steam-jet-r 0.75s ease-out infinite 0.35s; }
          .st-anger-mark { transform-origin: 50% 50%; animation: st-anger-mark-pulse 0.5s ease-in-out infinite; }

          .st-think-body { transform-origin: 50% 75%; animation: st-ponder-drift 2s ease-in-out infinite; }
          .st-gear { transform-origin: 75% 22%; animation: st-gear-spin 3.5s linear infinite; }
          .st-question { transform-origin: 50% 50%; animation: st-question-bob 1s ease-in-out infinite; }
          .st-chin-hand { transform-origin: 50% 50%; animation: st-chin-tap 1s ease-in-out infinite; }

          .st-clap-body { transform-origin: 50% 75%; animation: st-applause-bop 0.42s ease-in-out infinite; }
          .st-clap-l { transform-origin: 30% 75%; animation: st-hand-clap-l 0.42s cubic-bezier(0.3, 0, 0.2, 1) infinite; }
          .st-clap-r { transform-origin: 70% 75%; animation: st-hand-clap-r 0.42s cubic-bezier(0.3, 0, 0.2, 1) infinite; }
          .st-clap-spark { transform-origin: 50% 70%; animation: st-clap-spark 0.42s ease-out infinite; }
          .st-star-eye { transform-origin: 50% 50%; animation: st-star-eye-twinkle 0.85s ease-in-out infinite; }

          .st-bow-body { transform-origin: 50% 85%; animation: st-reverent-bow 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
          .st-aura { transform-origin: 50% 55%; animation: st-aura-radiate 1.6s ease-in-out infinite; }

          .st-tease-body { transform-origin: 50% 70%; animation: st-tease-bob 0.5s ease-in-out infinite; }
          .st-tease-tongue { transform-origin: 50% 0%; animation: st-tongue-flutter 0.3s ease-in-out infinite; }
          .st-wink-star { transform-origin: 72% 46%; animation: st-wink-burst 0.8s ease-in-out infinite; }

          .st-gg-body { transform-origin: 50% 75%; animation: st-proud-nod 1.4s ease-in-out infinite; }
          .st-thumb { transform-origin: 65% 65%; animation: st-thumb-pump 0.7s cubic-bezier(0.2, 0.8, 0.4, 1) infinite; }
          .st-thumb-aura { transform-origin: 75% 55%; animation: st-thumb-radiance 0.7s ease-in-out infinite; }
          .st-gg-medal { transform-origin: 75% 20%; animation: st-medal-gleam 1.4s ease-in-out infinite; }

          .st-rematch-body { transform-origin: 50% 75%; animation: st-boxer-shuffle 0.65s cubic-bezier(0.25, 0.8, 0.5, 1) infinite; }
          .st-punch-l { transform-origin: 30% 65%; animation: st-punch-left 0.65s ease-in-out infinite; }
          .st-punch-r { transform-origin: 70% 65%; animation: st-punch-right 0.65s ease-in-out infinite; }
          .st-headband { transform-origin: 20% 45%; animation: st-headband-stream 0.65s ease-in-out infinite; }
          .st-swords { transform-origin: 50% 50%; animation: st-swords-glow 0.65s ease-in-out infinite; }

          /* Accessibility overrides */
          @media (prefers-reduced-motion: reduce) {
            .sticker-animated * {
              animation: none !important;
            }
          }
          .sticker-static * {
            animation: none !important;
          }
        `}</style>

        {renderStickerGraphics(id, idPrefix)}
      </svg>
    </div>
  );
});

function renderStickerGraphics(id: StickerId, p: string) {
  switch (id) {
    case 'victory':
      return (
        <g className="st-victory-actor">
          {/* Sparkles background */}
          <path
            d="M15 25 L17 31 L23 33 L17 35 L15 41 L13 35 L7 33 L13 31 Z"
            fill="#FBBF24"
            className="st-sparkle-1"
          />
          <path
            d="M85 22 L86.5 26.5 L91 28 L86.5 29.5 L85 34 L83.5 29.5 L79 28 L83.5 26.5 Z"
            fill="#FBBF24"
            className="st-sparkle-2"
          />

          {/* Main mascot body */}
          <circle cx="50" cy="56" r="34" fill={`url(#${p}-body)`} />
          <ellipse cx="40" cy="38" rx="16" ry="10" fill={`url(#${p}-highlight)`} />

          {/* Golden Crown */}
          <g className="st-crown">
            <path
              d="M32 30 L38 38 L50 24 L62 38 L68 30 L66 42 L34 42 Z"
              fill={`url(#${p}-gold)`}
              stroke="#B45309"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="32" cy="29" r="2.5" fill="#EF4444" />
            <circle cx="50" cy="23" r="3" fill="#3B82F6" />
            <circle cx="68" cy="29" r="2.5" fill="#10B981" />
          </g>

          {/* Joyful Eyes (Curved Smiling Lines) */}
          <path d="M36 54 Q42 47 48 54" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M52 54 Q58 47 64 54" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />

          {/* Rosy Cheeks */}
          <ellipse cx="33" cy="62" rx="4" ry="2.5" fill="#F472B6" opacity="0.8" />
          <ellipse cx="67" cy="62" rx="4" ry="2.5" fill="#F472B6" opacity="0.8" />

          {/* Big Cheerful Open Mouth with Tongue */}
          <path d="M42 62 Q50 74 58 62 Z" fill="#991B1B" />
          <path d="M45 66 Q50 72 55 66" fill="#F87171" />

          {/* Held Trophy Cup in Front */}
          <g transform="translate(38, 68)" className="st-trophy">
            <path d="M4 2 L20 2 L18 14 Q12 18 6 14 Z" fill={`url(#${p}-gold)`} stroke="#B45309" strokeWidth="1" />
            <path d="M10 16 L14 16 L14 20 L10 20 Z" fill={`url(#${p}-gold)`} />
            <path d="M7 20 L17 20 L18 23 L6 23 Z" fill={`url(#${p}-gold)`} stroke="#B45309" strokeWidth="0.8" />
            {/* Handles */}
            <path d="M4 4 Q-1 7 4 12" stroke="#B45309" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <path d="M20 4 Q25 7 20 12" stroke="#B45309" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <polygon points="12,5 13.5,8 17,8.5 14.5,10.5 15,14 12,12.5 9,14 9.5,10.5 7,8.5 10.5,8" fill="#FFFFFF" opacity="0.9" />
          </g>
        </g>
      );

    case 'greeting':
      return (
        <g>
          {/* Main Mascot Body */}
          <g className="st-greet-body">
            <circle cx="48" cy="54" r="34" fill={`url(#${p}-body)`} />
            <ellipse cx="38" cy="36" rx="16" ry="10" fill={`url(#${p}-highlight)`} />

            {/* Cheerful Big Eyes with Highlights */}
            <circle cx="40" cy="50" r="5" fill="#0F172A" />
            <circle cx="41.5" cy="48.5" r="2" fill="#FFFFFF" />
            <circle cx="58" cy="50" r="5" fill="#0F172A" />
            <circle cx="59.5" cy="48.5" r="2" fill="#FFFFFF" />

            {/* Blushing Cheeks */}
            <ellipse cx="32" cy="58" rx="4.5" ry="2.5" fill="#F472B6" opacity="0.8" />
            <ellipse cx="66" cy="58" rx="4.5" ry="2.5" fill="#F472B6" opacity="0.8" />

            {/* Warm Friendly Smile */}
            <path d="M44 58 Q49 66 54 58" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
          </g>

          {/* Animated Waving Hand with Springy Wrist & Wave Motion Rings */}
          <g className="st-wave-ring">
            <path d="M88 28 Q92 34 88 40" stroke="#60A5FA" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <path d="M93 24 Q99 34 93 44" stroke="#93C5FD" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </g>

          <g className="st-wave-hand">
            <g transform="translate(68, 30)">
              {/* Palm & 4 cute fingers */}
              <circle cx="12" cy="12" r="7" fill="#FDBA74" stroke="#EA580C" strokeWidth="1" />
              <circle cx="9" cy="4" r="3" fill="#FDBA74" stroke="#EA580C" strokeWidth="0.8" />
              <circle cx="15" cy="4" r="3" fill="#FDBA74" stroke="#EA580C" strokeWidth="0.8" />
              <circle cx="20" cy="7" r="3" fill="#FDBA74" stroke="#EA580C" strokeWidth="0.8" />
              <circle cx="6" cy="9" r="3" fill="#FDBA74" stroke="#EA580C" strokeWidth="0.8" />
            </g>
          </g>
        </g>
      );

    case 'laughing':
      return (
        <g>
          {/* Main Laughing Body with Belly Chuckle */}
          <g className="st-laugh-body">
            <circle cx="50" cy="54" r="34" fill={`url(#${p}-body)`} />
            <ellipse cx="40" cy="36" rx="16" ry="10" fill={`url(#${p}-highlight)`} />

            {/* Laughing Squeezed Eyes: > < */}
            <path d="M33 46 L43 51 L33 56" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M67 46 L57 51 L67 56" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />

            {/* Wide Laughing Mouth */}
            <path d="M38 58 Q50 80 62 58 Z" fill="#7F1D1D" stroke="#FFFFFF" strokeWidth="2" />
            {/* Vibrating Pink Tongue */}
            <path d="M43 67 Q50 75 57 67 Q50 63 43 67 Z" fill="#F472B6" className="st-tongue-laugh" />

            {/* Blushing Cheeks */}
            <ellipse cx="29" cy="62" rx="4" ry="2.5" fill="#F472B6" opacity="0.9" />
            <ellipse cx="71" cy="62" rx="4" ry="2.5" fill="#F472B6" opacity="0.9" />
          </g>

          {/* Dynamic Arc Tears of Joy */}
          <path d="M25 50 Q22 44 26 40 Q30 44 28 50 Z" fill="#38BDF8" className="st-tear-l" />
          <path d="M75 50 Q78 44 74 40 Q70 44 72 50 Z" fill="#38BDF8" className="st-tear-r" />
        </g>
      );

    case 'shocked':
      return (
        <g>
          {/* Exclamation marks above with bounce */}
          <g transform="translate(44, 2)" className="st-exclamation">
            <rect x="5" y="0" width="3.5" height="11" rx="1.5" fill="#EF4444" />
            <circle cx="6.75" cy="14" r="2" fill="#EF4444" />
          </g>

          {/* Main Shuddering Body */}
          <g className="st-shock-body">
            <circle cx="50" cy="55" r="34" fill={`url(#${p}-body)`} />
            <ellipse cx="40" cy="37" rx="16" ry="10" fill={`url(#${p}-highlight)`} />

            {/* Huge Wide Astonished Eyes */}
            <circle cx="37" cy="50" r="10" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
            <circle cx="37" cy="50" r="4.5" fill="#0F172A" />
            <circle cx="35.5" cy="48" r="1.5" fill="#FFFFFF" />

            <circle cx="63" cy="50" r="10" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
            <circle cx="63" cy="50" r="4.5" fill="#0F172A" />
            <circle cx="61.5" cy="48" r="1.5" fill="#FFFFFF" />

            {/* Dropped "O" Mouth */}
            <ellipse cx="50" cy="70" rx="6" ry="9" fill="#0F172A" stroke="#FFFFFF" strokeWidth="2" />

            {/* Trembling Hands Raised to Cheeks */}
            <g className="st-hands-tremble">
              <circle cx="23" cy="60" r="5" fill="#FDBA74" stroke="#EA580C" strokeWidth="1" />
              <circle cx="77" cy="60" r="5" fill="#FDBA74" stroke="#EA580C" strokeWidth="1" />
            </g>
          </g>

          {/* Shock Sweat Drop dripping down */}
          <path d="M74 36 Q71 31 75 27 Q79 31 77 36 Z" fill="#67E8F9" className="st-sweat-drop" />
        </g>
      );

    case 'crying':
      return (
        <g>
          {/* Main Sobbing Body */}
          <g className="st-cry-body">
            <circle cx="50" cy="55" r="34" fill={`url(#${p}-body)`} />
            <ellipse cx="40" cy="37" rx="16" ry="10" fill={`url(#${p}-highlight)`} />

            {/* Sad Downturned Eyebrows */}
            <path d="M30 42 Q37 45 44 41" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M70 42 Q63 45 56 41" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />

            {/* Teary Sad Eyes */}
            <path d="M33 52 Q38 46 43 52" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M57 52 Q62 46 67 52" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />

            {/* Big Tear Pools Under Eyes */}
            <ellipse cx="38" cy="58" rx="5" ry="3" fill="#67E8F9" opacity="0.85" />
            <ellipse cx="62" cy="58" rx="5" ry="3" fill="#67E8F9" opacity="0.85" />

            {/* Trembling Wavy Downturned Mouth */}
            <g className="st-quiver-mouth">
              <path d="M42 71 Q46 66 50 69 Q54 66 58 71" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
            </g>
          </g>

          {/* Rainy Tear Streams Dropping Down */}
          <path d="M38 68 Q35 62 39 57 Q43 62 41 68 Z" fill="#38BDF8" className="st-cry-tear-l" />
          <path d="M62 68 Q59 62 63 57 Q67 62 65 68 Z" fill="#38BDF8" className="st-cry-tear-r" />
        </g>
      );

    case 'frustrated':
      return (
        <g>
          {/* Jetting Hot Steam Puffs Left and Right */}
          <g className="st-steam-l">
            <ellipse cx="16" cy="38" rx="5.5" ry="4" fill="#E2E8F0" opacity="0.85" />
            <ellipse cx="11" cy="33" rx="4" ry="3" fill="#CBD5E1" opacity="0.7" />
          </g>
          <g className="st-steam-r">
            <ellipse cx="84" cy="38" rx="5.5" ry="4" fill="#E2E8F0" opacity="0.85" />
            <ellipse cx="89" cy="33" rx="4" ry="3" fill="#CBD5E1" opacity="0.7" />
          </g>

          {/* Angry Red-Tinged Shaking Body */}
          <g className="st-rage-body">
            <circle cx="50" cy="55" r="34" fill={`url(#${p}-body-red)`} />
            <ellipse cx="40" cy="37" rx="16" ry="10" fill={`url(#${p}-highlight)`} />

            {/* Sharp Furrowed Angry Eyebrows */}
            <path d="M30 40 L44 47" stroke="#1E293B" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M70 40 L56 47" stroke="#1E293B" strokeWidth="3.5" strokeLinecap="round" />

            {/* Glaring Sharp Eyes */}
            <circle cx="38" cy="51" r="4.5" fill="#FFFFFF" />
            <circle cx="39" cy="51" r="2.5" fill="#0F172A" />
            <circle cx="62" cy="51" r="4.5" fill="#FFFFFF" />
            <circle cx="61" cy="51" r="2.5" fill="#0F172A" />

            {/* Gritted Teeth Mouth */}
            <rect x="40" y="63" width="20" height="9" rx="3" fill="#FFFFFF" stroke="#1E293B" strokeWidth="1.8" />
            <line x1="40" y1="67.5" x2="60" y2="67.5" stroke="#1E293B" strokeWidth="1.2" />
            <line x1="45" y1="63" x2="45" y2="72" stroke="#1E293B" strokeWidth="1.2" />
            <line x1="50" y1="63" x2="50" y2="72" stroke="#1E293B" strokeWidth="1.2" />
            <line x1="55" y1="63" x2="55" y2="72" stroke="#1E293B" strokeWidth="1.2" />

            {/* Pulsing Comic Anger Mark on Forehead */}
            <g transform="translate(50, 20)" className="st-anger-mark">
              <path d="M-4 -3 L2 1 M2 -3 L-4 1 M-6 -1 L4 -1 M-1 -5 L-1 3" stroke="#DC2626" strokeWidth="2.2" strokeLinecap="round" />
            </g>
          </g>
        </g>
      );

    case 'thinking':
      return (
        <g>
          {/* Animated Thought Gear & Question Bubble */}
          <g className="st-gear">
            <circle cx="75" cy="22" r="8.5" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1.6" strokeDasharray="3 2" />
            <text x="75" y="26" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#3B82F6" className="st-question">?</text>
          </g>

          {/* Tiny Rising Thought Trail Bubbles */}
          <circle cx="67" cy="30" r="2" fill="#93C5FD" opacity="0.85" />
          <circle cx="63" cy="36" r="3" fill="#93C5FD" opacity="0.85" />

          {/* Thoughtful Floating Mascot Body */}
          <g className="st-think-body">
            <circle cx="50" cy="55" r="34" fill={`url(#${p}-body)`} />
            <ellipse cx="40" cy="37" rx="16" ry="10" fill={`url(#${p}-highlight)`} />

            {/* One Eyebrow Raised High, One Low */}
            <path d="M32 44 Q38 41 44 43" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M56 38 Q62 33 68 37" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" fill="none" />

            {/* Eyes Looking Up and to the Right */}
            <circle cx="39" cy="49" r="5" fill="#FFFFFF" />
            <circle cx="41" cy="47" r="3" fill="#0F172A" />
            <circle cx="63" cy="49" r="5" fill="#FFFFFF" />
            <circle cx="65" cy="47" r="3" fill="#0F172A" />

            {/* Pensive Mouth (slanted squiggle) */}
            <path d="M43 65 Q50 64 57 67" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" fill="none" />

            {/* Tapping Hand on Chin */}
            <g transform="translate(42, 66)" className="st-chin-hand">
              <ellipse cx="6" cy="4" rx="5" ry="3.5" fill="#FDBA74" stroke="#EA580C" strokeWidth="1" />
              <circle cx="3" cy="2" r="1.5" fill="#FDBA74" />
            </g>
          </g>
        </g>
      );

    case 'clapping':
      return (
        <g>
          {/* Confetti & Applause Sparkles */}
          <circle cx="28" cy="22" r="2.8" fill="#FBBF24" className="st-sparkle-1" />
          <circle cx="72" cy="22" r="2.8" fill="#38BDF8" className="st-sparkle-2" />
          <polygon points="50,14 52,18 56,19 53,22 54,26 50,24 46,26 47,22 44,19 48,18" fill="#F472B6" className="st-sparkle-1" />

          {/* Bopping Body in rhythm with applause */}
          <g className="st-clap-body">
            <circle cx="50" cy="54" r="34" fill={`url(#${p}-body)`} />
            <ellipse cx="40" cy="36" rx="16" ry="10" fill={`url(#${p}-highlight)`} />

            {/* Joyful Star-Shaped Happy Twinkling Eyes */}
            <g className="st-star-eye" transform="translate(38, 50)">
              <polygon points="0,-6 2,-2 6,-1 3,2 4,6 0,4 -4,6 -3,2 -6,-1 -2,-2" fill="#FBBF24" stroke="#B45309" strokeWidth="0.8" />
            </g>
            <g className="st-star-eye" transform="translate(62, 50)">
              <polygon points="0,-6 2,-2 6,-1 3,2 4,6 0,4 -4,6 -3,2 -6,-1 -2,-2" fill="#FBBF24" stroke="#B45309" strokeWidth="0.8" />
            </g>

            {/* Cheerful Grin */}
            <path d="M43 61 Q50 71 57 61 Z" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />

            {/* Impact Sparks on Clap */}
            <g className="st-clap-spark">
              <path d="M46 64 L42 60 M54 64 L58 60 M50 63 L50 58" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
            </g>

            {/* Left Hand Clapping */}
            <g className="st-clap-l">
              <g transform="translate(36, 68)">
                <ellipse cx="6" cy="6" rx="6" ry="4" fill="#FFFFFF" stroke="#1E293B" strokeWidth="1.2" />
                <circle cx="2" cy="4" r="2" fill="#FFFFFF" stroke="#1E293B" strokeWidth="0.8" />
              </g>
            </g>

            {/* Right Hand Clapping */}
            <g className="st-clap-r">
              <g transform="translate(52, 68)">
                <ellipse cx="6" cy="6" rx="6" ry="4" fill="#FFFFFF" stroke="#1E293B" strokeWidth="1.2" />
                <circle cx="10" cy="4" r="2" fill="#FFFFFF" stroke="#1E293B" strokeWidth="0.8" />
              </g>
            </g>
          </g>
        </g>
      );

    case 'respect':
      return (
        <g>
          {/* Gentle Halo / Warm Respect Radiating Aura */}
          <ellipse cx="50" cy="56" rx="42" ry="40" fill={`url(#${p}-aura)`} className="st-aura" />

          {/* Reverent Ceremonial Bowing Body */}
          <g className="st-bow-body">
            <circle cx="50" cy="56" r="34" fill={`url(#${p}-body)`} />
            <ellipse cx="40" cy="38" rx="16" ry="10" fill={`url(#${p}-highlight)`} />

            {/* Soft Serene Closed Eyes */}
            <path d="M35 50 Q41 55 47 50" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M53 50 Q59 55 65 50" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />

            {/* Peaceful Humble Smile */}
            <path d="M45 59 Q50 64 55 59" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />

            {/* Respect Hands Pressed Together (Namaste / Wai gesture) */}
            <g transform="translate(44, 62)">
              <path d="M6 0 L10 12 L2 12 Z" fill="#FDBA74" stroke="#EA580C" strokeWidth="1" strokeLinejoin="round" />
              <path d="M6 1 L6 11" stroke="#EA580C" strokeWidth="0.8" />
              {/* White Cuffs */}
              <rect x="1" y="11" width="10" height="3" rx="1.5" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.8" />
            </g>
          </g>
        </g>
      );

    case 'teasing':
      return (
        <g>
          {/* Mischievous Head-Tilting Body */}
          <g className="st-tease-body">
            <circle cx="50" cy="54" r="34" fill={`url(#${p}-body)`} />
            <ellipse cx="40" cy="36" rx="16" ry="10" fill={`url(#${p}-highlight)`} />

            {/* Left Eye: Open & Playful */}
            <circle cx="39" cy="48" r="5" fill="#0F172A" />
            <circle cx="40.5" cy="46.5" r="2" fill="#FFFFFF" />

            {/* Right Eye: Winking Star/Line */}
            <path d="M58 48 Q64 42 70 48" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            <polygon points="72,42 73.5,45 77,45.5 74.5,47.5 75,51 72,49.5 69,51 69.5,47.5 67,45.5 70.5,45" fill="#FDE047" className="st-wink-star" />

            {/* Rosy Cheeks */}
            <ellipse cx="32" cy="56" rx="4" ry="2.5" fill="#F472B6" opacity="0.85" />
            <ellipse cx="68" cy="56" rx="4" ry="2.5" fill="#F472B6" opacity="0.85" />

            {/* Cheeky Grin with Wagging Tongue */}
            <path d="M42 58 Q50 63 58 58" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <g transform="translate(47, 59)" className="st-tease-tongue">
              <path d="M1 0 L7 0 C7 6 1 6 1 0 Z" fill="#F472B6" stroke="#BE185D" strokeWidth="1" />
              <line x1="4" y1="0" x2="4" y2="4" stroke="#BE185D" strokeWidth="0.8" />
            </g>
          </g>
        </g>
      );

    case 'good_game':
      return (
        <g>
          {/* Confident Winner Ribbon or Gold Star */}
          <g transform="translate(70, 16)" className="st-gg-medal">
            <polygon points="12,2 15,9 22,10 17,15 18,22 12,19 6,22 7,15 2,10 9,9" fill={`url(#${p}-gold)`} stroke="#B45309" strokeWidth="1" />
            <circle cx="12" cy="12" r="3.5" fill="#FFFFFF" />
          </g>

          {/* Proud Approving Nod Body */}
          <g className="st-gg-body">
            <circle cx="48" cy="54" r="34" fill={`url(#${p}-body)`} />
            <ellipse cx="38" cy="36" rx="16" ry="10" fill={`url(#${p}-highlight)`} />

            {/* Proud Friendly Eyes */}
            <circle cx="40" cy="48" r="5" fill="#0F172A" />
            <circle cx="41.5" cy="46.5" r="2" fill="#FFFFFF" />
            <circle cx="58" cy="48" r="5" fill="#0F172A" />
            <circle cx="59.5" cy="46.5" r="2" fill="#FFFFFF" />

            {/* Confident Wide Grin */}
            <path d="M42 57 Q49 66 56 57 Z" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />

            {/* Thumbs-Up Radiance Rays */}
            <g className="st-thumb-aura">
              <path d="M76 60 L80 58 M78 65 L82 65 M76 70 L80 72" stroke="#FBBF24" strokeWidth="1.8" strokeLinecap="round" />
            </g>

            {/* Proud Pumping Thumbs-Up Hand in Front */}
            <g transform="translate(62, 54)" className="st-thumb">
              {/* Thumb */}
              <path d="M5 2 Q7 -4 10 2 L10 10 L4 10 Z" fill="#FDBA74" stroke="#EA580C" strokeWidth="1" />
              {/* Fist */}
              <rect x="2" y="8" width="10" height="9" rx="3" fill="#FDBA74" stroke="#EA580C" strokeWidth="1" />
            </g>
          </g>
        </g>
      );

    case 'rematch_invite':
      return (
        <g>
          {/* Duel Swords crossing behind with pulsing energy clash */}
          <g stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" className="st-swords">
            <line x1="20" y1="20" x2="80" y2="80" />
            <line x1="80" y1="20" x2="20" y2="80" />
          </g>

          {/* Boxer Hop Bouncing Body */}
          <g className="st-rematch-body">
            <circle cx="50" cy="54" r="34" fill={`url(#${p}-body)`} />
            <ellipse cx="40" cy="36" rx="16" ry="10" fill={`url(#${p}-highlight)`} />

            {/* Red Warrior Headband with streaming tails */}
            <path d="M16 42 Q50 34 84 42 L84 46 Q50 38 16 46 Z" fill="#EF4444" />
            <path d="M16 44 L6 36 L10 50 Z" fill="#DC2626" className="st-headband" />

            {/* Determined Fierce Eyes */}
            <path d="M34 44 L44 47" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="39" cy="50" r="4.5" fill="#0F172A" />
            <circle cx="40" cy="49" r="1.5" fill="#FFFFFF" />

            <path d="M66 44 L56 47" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="61" cy="50" r="4.5" fill="#0F172A" />
            <circle cx="60" cy="49" r="1.5" fill="#FFFFFF" />

            {/* Determined Smile */}
            <path d="M44 60 Q50 67 56 60" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />

            {/* Left Boxing Glove (Red) throwing snappy punches */}
            <g transform="translate(24, 62)" className="st-punch-l">
              <circle cx="6" cy="6" r="6.5" fill={`url(#${p}-glove-red)`} stroke="#991B1B" strokeWidth="1" />
            </g>

            {/* Right Boxing Glove (Blue) throwing snappy punches */}
            <g transform="translate(64, 62)" className="st-punch-r">
              <circle cx="6" cy="6" r="6.5" fill={`url(#${p}-glove-blue)`} stroke="#1D4ED8" strokeWidth="1" />
            </g>
          </g>
        </g>
      );

    default:
      return null;
  }
}
