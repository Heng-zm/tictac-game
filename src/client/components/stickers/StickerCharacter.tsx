import { memo } from 'react';
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
          <radialGradient id="ticti-body" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="45%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </radialGradient>
          <radialGradient id="ticti-highlight" cx="30%" cy="25%" r="35%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ticti-body-red" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#F87171" />
            <stop offset="45%" stopColor="#EF4444" />
            <stop offset="100%" stopColor="#B91C1C" />
          </radialGradient>
          <radialGradient id="gold-grad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="60%" stopColor="#EAB308" />
            <stop offset="100%" stopColor="#CA8A04" />
          </radialGradient>
          <radialGradient id="aura-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FCD34D" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </radialGradient>
        </defs>

        <style>{`
          @keyframes st-bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-7px) scale(1.04, 0.96); }
          }
          @keyframes st-wave {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(-24deg); }
            75% { transform: rotate(18deg); }
          }
          @keyframes st-laugh {
            0%, 100% { transform: rotate(-4deg) translateY(0); }
            50% { transform: rotate(4deg) translateY(-4px); }
          }
          @keyframes st-tear {
            0% { transform: translateY(0) scale(0.6); opacity: 0; }
            40% { opacity: 0.9; }
            100% { transform: translateY(16px) scale(1.1); opacity: 0; }
          }
          @keyframes st-steam {
            0% { transform: scale(0.5) translate(0, 0); opacity: 0; }
            50% { opacity: 0.8; }
            100% { transform: scale(1.2) translate(var(--steam-dir, 8px), -12px); opacity: 0; }
          }
          @keyframes st-spin-slow {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes st-clap {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.15) rotate(6deg); }
          }
          @keyframes st-bow {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(5px) rotate(4deg); }
          }
          @keyframes st-shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-3px); }
            40% { transform: translateX(3px); }
            60% { transform: translateX(-2px); }
            80% { transform: translateX(2px); }
          }
          @keyframes st-wink {
            0%, 85%, 100% { transform: scaleY(1); }
            92% { transform: scaleY(0.1); }
          }
          @keyframes st-pulse {
            0%, 100% { transform: scale(1); opacity: 0.85; }
            50% { transform: scale(1.08); opacity: 1; }
          }

          .st-victory { transform-origin: 50% 75%; animation: st-bounce 0.8s ease-in-out infinite; }
          .st-wave-hand { transform-origin: 75% 55%; animation: st-wave 0.7s ease-in-out infinite; }
          .st-laugh-body { transform-origin: 50% 65%; animation: st-laugh 0.35s ease-in-out infinite; }
          .st-tear-l { animation: st-tear 0.9s ease-in infinite; }
          .st-tear-r { animation: st-tear 0.9s ease-in infinite 0.45s; }
          .st-steam-l { --steam-dir: -8px; transform-origin: 20% 30%; animation: st-steam 0.8s ease-out infinite; }
          .st-steam-r { --steam-dir: 8px; transform-origin: 80% 30%; animation: st-steam 0.8s ease-out infinite 0.3s; }
          .st-gear { transform-origin: 75% 20%; animation: st-spin-slow 4s linear infinite; }
          .st-clap-hands { transform-origin: 50% 75%; animation: st-clap 0.45s ease-in-out infinite; }
          .st-bow-body { transform-origin: 50% 80%; animation: st-bow 1.4s ease-in-out infinite; }
          .st-shock-body { transform-origin: 50% 50%; animation: st-shake 0.35s ease-in-out infinite; }
          .st-sparkle { transform-origin: 50% 50%; animation: st-pulse 1s ease-in-out infinite; }

          @media (prefers-reduced-motion: reduce) {
            .st-victory, .st-wave-hand, .st-laugh-body, .st-tear-l, .st-tear-r,
            .st-steam-l, .st-steam-r, .st-gear, .st-clap-hands, .st-bow-body,
            .st-shock-body, .st-sparkle {
              animation: none !important;
            }
          }
        `}</style>

        {renderStickerGraphics(id)}
      </svg>
    </div>
  );
});

function renderStickerGraphics(id: StickerId) {
  switch (id) {
    case 'victory':
      return (
        <g className="st-victory">
          {/* Sparkles background */}
          <path d="M15 25 L17 31 L23 33 L17 35 L15 41 L13 35 L7 33 L13 31 Z" fill="#FBBF24" className="st-sparkle" />
          <path d="M85 22 L86.5 26.5 L91 28 L86.5 29.5 L85 34 L83.5 29.5 L79 28 L83.5 26.5 Z" fill="#FBBF24" className="st-sparkle" />

          {/* Body */}
          <circle cx="50" cy="56" r="34" fill="url(#ticti-body)" />
          <ellipse cx="40" cy="38" rx="16" ry="10" fill="url(#ticti-highlight)" />

          {/* Golden Crown */}
          <path
            d="M32 30 L38 38 L50 24 L62 38 L68 30 L66 42 L34 42 Z"
            fill="url(#gold-grad)"
            stroke="#B45309"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="29" r="2.5" fill="#EF4444" />
          <circle cx="50" cy="23" r="3" fill="#3B82F6" />
          <circle cx="68" cy="29" r="2.5" fill="#10B981" />

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
          <g transform="translate(38, 68)">
            <path d="M4 2 L20 2 L18 14 Q12 18 6 14 Z" fill="url(#gold-grad)" stroke="#B45309" strokeWidth="1" />
            <path d="M10 16 L14 16 L14 20 L10 20 Z" fill="url(#gold-grad)" />
            <path d="M7 20 L17 20 L18 23 L6 23 Z" fill="url(#gold-grad)" stroke="#B45309" strokeWidth="0.8" />
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
          {/* Main Body */}
          <circle cx="48" cy="54" r="34" fill="url(#ticti-body)" />
          <ellipse cx="38" cy="36" rx="16" ry="10" fill="url(#ticti-highlight)" />

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

          {/* Animated Waving Hand */}
          <g className="st-wave-hand">
            <g transform="translate(68, 30)">
              {/* Palm & 4 cute fingers */}
              <circle cx="12" cy="12" r="7" fill="#FDBA74" stroke="#EA580C" strokeWidth="1" />
              <circle cx="9" cy="4" r="3" fill="#FDBA74" stroke="#EA580C" strokeWidth="0.8" />
              <circle cx="15" cy="4" r="3" fill="#FDBA74" stroke="#EA580C" strokeWidth="0.8" />
              <circle cx="20" cy="7" r="3" fill="#FDBA74" stroke="#EA580C" strokeWidth="0.8" />
              <circle cx="6" cy="9" r="3" fill="#FDBA74" stroke="#EA580C" strokeWidth="0.8" />
            </g>
            {/* Wave Motion Lines */}
            <path d="M88 28 Q92 34 88 40" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M92 24 Q98 34 92 44" stroke="#93C5FD" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </g>
        </g>
      );

    case 'laughing':
      return (
        <g className="st-laugh-body">
          {/* Main Body */}
          <circle cx="50" cy="54" r="34" fill="url(#ticti-body)" />
          <ellipse cx="40" cy="36" rx="16" ry="10" fill="url(#ticti-highlight)" />

          {/* Laughing Squeezed Eyes: > < */}
          <path d="M33 46 L43 51 L33 56" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M67 46 L57 51 L67 56" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />

          {/* Tears of Joy Popping Out */}
          <path d="M25 50 Q22 44 26 40 Q30 44 28 50 Z" fill="#38BDF8" className="st-tear-l" />
          <path d="M75 50 Q78 44 74 40 Q70 44 72 50 Z" fill="#38BDF8" className="st-tear-r" />

          {/* Wide Laughing Mouth */}
          <path d="M38 58 Q50 80 62 58 Z" fill="#7F1D1D" stroke="#FFFFFF" strokeWidth="2" />
          {/* Vibrating Pink Tongue */}
          <path d="M43 67 Q50 75 57 67 Q50 63 43 67 Z" fill="#F472B6" />

          {/* Blushing Cheeks */}
          <ellipse cx="29" cy="62" rx="4" ry="2.5" fill="#F472B6" opacity="0.9" />
          <ellipse cx="71" cy="62" rx="4" ry="2.5" fill="#F472B6" opacity="0.9" />
        </g>
      );

    case 'shocked':
      return (
        <g className="st-shock-body">
          {/* Exclamation marks above */}
          <g transform="translate(44, 2)">
            <rect x="5" y="0" width="3.5" height="11" rx="1.5" fill="#EF4444" />
            <circle cx="6.75" cy="14" r="2" fill="#EF4444" />
          </g>

          {/* Main Body */}
          <circle cx="50" cy="55" r="34" fill="url(#ticti-body)" />
          <ellipse cx="40" cy="37" rx="16" ry="10" fill="url(#ticti-highlight)" />

          {/* Huge Wide Astonished Eyes */}
          <circle cx="37" cy="50" r="10" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
          <circle cx="37" cy="50" r="4.5" fill="#0F172A" />
          <circle cx="35.5" cy="48" r="1.5" fill="#FFFFFF" />

          <circle cx="63" cy="50" r="10" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
          <circle cx="63" cy="50" r="4.5" fill="#0F172A" />
          <circle cx="61.5" cy="48" r="1.5" fill="#FFFFFF" />

          {/* Hands Raised to Cheeks */}
          <circle cx="23" cy="60" r="5" fill="#FDBA74" stroke="#EA580C" strokeWidth="1" />
          <circle cx="77" cy="60" r="5" fill="#FDBA74" stroke="#EA580C" strokeWidth="1" />

          {/* Dropped "O" Mouth */}
          <ellipse cx="50" cy="70" rx="6" ry="9" fill="#0F172A" stroke="#FFFFFF" strokeWidth="2" />

          {/* Shock Sweat Drop */}
          <path d="M74 36 Q71 31 75 27 Q79 31 77 36 Z" fill="#67E8F9" />
        </g>
      );

    case 'crying':
      return (
        <g>
          {/* Rainy Tear Drops Dropping Down */}
          <path d="M38 68 Q35 62 39 57 Q43 62 41 68 Z" fill="#38BDF8" className="st-tear-l" />
          <path d="M62 68 Q59 62 63 57 Q67 62 65 68 Z" fill="#38BDF8" className="st-tear-r" />

          {/* Main Body */}
          <circle cx="50" cy="55" r="34" fill="url(#ticti-body)" />
          <ellipse cx="40" cy="37" rx="16" ry="10" fill="url(#ticti-highlight)" />

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
          <path d="M42 71 Q46 66 50 69 Q54 66 58 71" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
        </g>
      );

    case 'frustrated':
      return (
        <g>
          {/* Steam Puffs Blowing Out Left and Right */}
          <g className="st-steam-l">
            <ellipse cx="16" cy="38" rx="5" ry="3.5" fill="#E2E8F0" opacity="0.8" />
            <ellipse cx="11" cy="33" rx="3.5" ry="2.5" fill="#E2E8F0" opacity="0.6" />
          </g>
          <g className="st-steam-r">
            <ellipse cx="84" cy="38" rx="5" ry="3.5" fill="#E2E8F0" opacity="0.8" />
            <ellipse cx="89" cy="33" rx="3.5" ry="2.5" fill="#E2E8F0" opacity="0.6" />
          </g>

          {/* Angry Red-Tinged Body */}
          <circle cx="50" cy="55" r="34" fill="url(#ticti-body-red)" />
          <ellipse cx="40" cy="37" rx="16" ry="10" fill="url(#ticti-highlight)" />

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

          {/* Anger Mark symbol above head */}
          <path d="M47 18 L53 22 M53 18 L47 22 M45 20 L55 20 M50 16 L50 24" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
        </g>
      );

    case 'thinking':
      return (
        <g>
          {/* Animated Rotating Thought Gear & Question Bubble */}
          <g className="st-gear">
            <circle cx="75" cy="22" r="8" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="3 2" />
            <text x="75" y="26" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#3B82F6">?</text>
          </g>

          {/* Tiny Thought Trail Bubbles */}
          <circle cx="67" cy="30" r="2" fill="#93C5FD" opacity="0.8" />
          <circle cx="63" cy="36" r="3" fill="#93C5FD" opacity="0.8" />

          {/* Main Body */}
          <circle cx="50" cy="55" r="34" fill="url(#ticti-body)" />
          <ellipse cx="40" cy="37" rx="16" ry="10" fill="url(#ticti-highlight)" />

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

          {/* Cute Little Hand on Chin */}
          <g transform="translate(42, 66)">
            <ellipse cx="6" cy="4" rx="5" ry="3.5" fill="#FDBA74" stroke="#EA580C" strokeWidth="1" />
            <circle cx="3" cy="2" r="1.5" fill="#FDBA74" />
          </g>
        </g>
      );

    case 'clapping':
      return (
        <g>
          {/* Confetti / Applause Sparkles */}
          <circle cx="28" cy="22" r="2.5" fill="#FBBF24" className="st-sparkle" />
          <circle cx="72" cy="22" r="2.5" fill="#38BDF8" className="st-sparkle" />
          <polygon points="50,14 52,18 56,19 53,22 54,26 50,24 46,26 47,22 44,19 48,18" fill="#F472B6" className="st-sparkle" />

          {/* Main Body */}
          <circle cx="50" cy="54" r="34" fill="url(#ticti-body)" />
          <ellipse cx="40" cy="36" rx="16" ry="10" fill="url(#ticti-highlight)" />

          {/* Joyful Star-Shaped Happy Eyes */}
          <polygon points="38,44 40,48 44,49 41,52 42,56 38,54 34,56 35,52 32,49 36,48" fill="#FBBF24" stroke="#B45309" strokeWidth="0.8" />
          <polygon points="62,44 64,48 68,49 65,52 66,56 62,54 58,56 59,52 56,49 60,48" fill="#FBBF24" stroke="#B45309" strokeWidth="0.8" />

          {/* Cheerful Grin */}
          <path d="M43 61 Q50 71 57 61 Z" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />

          {/* Animated Clapping Hands */}
          <g className="st-clap-hands">
            {/* Left Hand */}
            <g transform="translate(36, 68) rotate(-15)">
              <ellipse cx="6" cy="6" rx="6" ry="4" fill="#FFFFFF" stroke="#1E293B" strokeWidth="1.2" />
              <circle cx="2" cy="4" r="2" fill="#FFFFFF" stroke="#1E293B" strokeWidth="0.8" />
            </g>
            {/* Right Hand */}
            <g transform="translate(52, 68) rotate(15)">
              <ellipse cx="6" cy="6" rx="6" ry="4" fill="#FFFFFF" stroke="#1E293B" strokeWidth="1.2" />
              <circle cx="10" cy="4" r="2" fill="#FFFFFF" stroke="#1E293B" strokeWidth="0.8" />
            </g>
            {/* Clap Impact Marks */}
            <path d="M48 64 L46 60 M52 64 L54 60" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
      );

    case 'respect':
      return (
        <g className="st-bow-body">
          {/* Gentle Halo / Warm Respect Aura */}
          <ellipse cx="50" cy="56" rx="42" ry="40" fill="url(#aura-grad)" />

          {/* Main Body */}
          <circle cx="50" cy="56" r="34" fill="url(#ticti-body)" />
          <ellipse cx="40" cy="38" rx="16" ry="10" fill="url(#ticti-highlight)" />

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
      );

    case 'teasing':
      return (
        <g>
          {/* Main Body */}
          <circle cx="50" cy="54" r="34" fill="url(#ticti-body)" />
          <ellipse cx="40" cy="36" rx="16" ry="10" fill="url(#ticti-highlight)" />

          {/* Left Eye: Open & Playful */}
          <circle cx="39" cy="48" r="5" fill="#0F172A" />
          <circle cx="40.5" cy="46.5" r="2" fill="#FFFFFF" />

          {/* Right Eye: Winking Star/Line */}
          <path d="M58 48 Q64 42 70 48" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <polygon points="72,42 73.5,45 77,45.5 74.5,47.5 75,51 72,49.5 69,51 69.5,47.5 67,45.5 70.5,45" fill="#FDE047" className="st-sparkle" />

          {/* Rosy Cheeks */}
          <ellipse cx="32" cy="56" rx="4" ry="2.5" fill="#F472B6" opacity="0.85" />
          <ellipse cx="68" cy="56" rx="4" ry="2.5" fill="#F472B6" opacity="0.85" />

          {/* Cheeky Grin with Sticking Out Tongue */}
          <path d="M42 58 Q50 63 58 58" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* Cute Pink Tongue */}
          <g transform="translate(47, 59)">
            <path d="M1 0 L7 0 C7 6 1 6 1 0 Z" fill="#F472B6" stroke="#BE185D" strokeWidth="1" />
            <line x1="4" y1="0" x2="4" y2="4" stroke="#BE185D" strokeWidth="0.8" />
          </g>
        </g>
      );

    case 'good_game':
      return (
        <g>
          {/* Confident Winner Ribbon or Gold Star */}
          <g transform="translate(70, 16)">
            <polygon points="12,2 15,9 22,10 17,15 18,22 12,19 6,22 7,15 2,10 9,9" fill="url(#gold-grad)" stroke="#B45309" strokeWidth="1" />
            <circle cx="12" cy="12" r="3.5" fill="#FFFFFF" />
          </g>

          {/* Main Body */}
          <circle cx="48" cy="54" r="34" fill="url(#ticti-body)" />
          <ellipse cx="38" cy="36" rx="16" ry="10" fill="url(#ticti-highlight)" />

          {/* Proud Friendly Eyes */}
          <circle cx="40" cy="48" r="5" fill="#0F172A" />
          <circle cx="41.5" cy="46.5" r="2" fill="#FFFFFF" />
          <circle cx="58" cy="48" r="5" fill="#0F172A" />
          <circle cx="59.5" cy="46.5" r="2" fill="#FFFFFF" />

          {/* Confident Wide Grin */}
          <path d="M42 57 Q49 66 56 57 Z" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />

          {/* Proud Thumbs-Up Hand in Front */}
          <g transform="translate(62, 54)">
            {/* Thumb */}
            <path d="M5 2 Q7 -4 10 2 L10 10 L4 10 Z" fill="#FDBA74" stroke="#EA580C" strokeWidth="1" />
            {/* Fist */}
            <rect x="2" y="8" width="10" height="9" rx="3" fill="#FDBA74" stroke="#EA580C" strokeWidth="1" />
            <path d="M14 6 L18 4 M16 11 L20 11 M14 16 L18 18" stroke="#FBBF24" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        </g>
      );

    case 'rematch_invite':
      return (
        <g className="st-victory">
          {/* Duel Swords / Arrows crossing behind */}
          <g stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round">
            <line x1="20" y1="20" x2="80" y2="80" />
            <line x1="80" y1="20" x2="20" y2="80" />
          </g>

          {/* Main Body with Energetic Duel Headband */}
          <circle cx="50" cy="54" r="34" fill="url(#ticti-body)" />
          <ellipse cx="40" cy="36" rx="16" ry="10" fill="url(#ticti-highlight)" />

          {/* Red Warrior Headband with streaming tails */}
          <path d="M16 42 Q50 34 84 42 L84 46 Q50 38 16 46 Z" fill="#EF4444" />
          <path d="M16 44 L6 36 L10 50 Z" fill="#DC2626" />

          {/* Determined Fierce Eyes */}
          <path d="M34 44 L44 47" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="39" cy="50" r="4.5" fill="#0F172A" />
          <circle cx="40" cy="49" r="1.5" fill="#FFFFFF" />

          <path d="M66 44 L56 47" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="61" cy="50" r="4.5" fill="#0F172A" />
          <circle cx="60" cy="49" r="1.5" fill="#FFFFFF" />

          {/* Determined Smile */}
          <path d="M44 60 Q50 67 56 60" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />

          {/* Dual Boxing Gloves / Controllers */}
          <g transform="translate(24, 62)">
            <circle cx="6" cy="6" r="6" fill="#EF4444" stroke="#991B1B" strokeWidth="1" />
          </g>
          <g transform="translate(64, 62)">
            <circle cx="6" cy="6" r="6" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="1" />
          </g>
        </g>
      );

    default:
      return null;
  }
}
