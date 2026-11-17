import { memo, useId } from 'react';
import type { StickerId } from '../../../shared/stickers';
import './stickers.css';

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
        {renderDefs(id, idPrefix)}

        {renderStickerGraphics(id, idPrefix)}
      </svg>
    </div>
  );
});

function renderDefs(id: StickerId, p: string) {
  const needsBody = id !== 'frustrated';
  const needsHighlight = true;
  const needsBodyRed = id === 'frustrated';
  const needsGold = id === 'victory' || id === 'good_game';
  const needsAura = id === 'respect';
  const needsGloves = id === 'rematch_invite';
  const needsHeartRed = id === 'heart_love';
  const needsCutePink = id === 'heart_love';
  const needsSleepyCap = id === 'sleepy_yawn';

  return (
    <defs>
      {needsBody && (
        <radialGradient id={`${p}-body`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="45%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </radialGradient>
      )}
      {needsHighlight && (
        <radialGradient id={`${p}-highlight`} cx="30%" cy="25%" r="35%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      )}
      {needsBodyRed && (
        <radialGradient id={`${p}-body-red`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#F87171" />
          <stop offset="45%" stopColor="#EF4444" />
          <stop offset="100%" stopColor="#B91C1C" />
        </radialGradient>
      )}
      {needsGold && (
        <radialGradient id={`${p}-gold`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="60%" stopColor="#EAB308" />
          <stop offset="100%" stopColor="#CA8A04" />
        </radialGradient>
      )}
      {needsAura && (
        <radialGradient id={`${p}-aura`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FCD34D" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </radialGradient>
      )}
      {needsGloves && (
        <>
          <radialGradient id={`${p}-glove-red`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#F87171" />
            <stop offset="50%" stopColor="#EF4444" />
            <stop offset="100%" stopColor="#991B1B" />
          </radialGradient>
          <radialGradient id={`${p}-glove-blue`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="50%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </radialGradient>
        </>
      )}
      {needsHeartRed && (
        <radialGradient id={`${p}-heart-red`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="50%" stopColor="#E11D48" />
          <stop offset="100%" stopColor="#9F1239" />
        </radialGradient>
      )}
      {needsCutePink && (
        <radialGradient id={`${p}-cute-pink`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#F472B6" />
          <stop offset="50%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#BE185D" />
        </radialGradient>
      )}
      {needsSleepyCap && (
        <radialGradient id={`${p}-sleepy-cap`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#4338CA" />
        </radialGradient>
      )}
    </defs>
  );
}

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
          <g transform="translate(38, 68)">
            <g className="st-trophy">
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
          <g transform="translate(44, 2)">
            <g className="st-exclamation">
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
            <g transform="translate(50, 20)">
              <g className="st-anger-mark">
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
            <g transform="translate(42, 66)">
              <g className="st-chin-hand">
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
            <g transform="translate(38, 50)">
              <g className="st-star-eye">
                <polygon points="0,-6 2,-2 6,-1 3,2 4,6 0,4 -4,6 -3,2 -6,-1 -2,-2" fill="#FBBF24" stroke="#B45309" strokeWidth="0.8" />
              </g>
            </g>
            <g transform="translate(62, 50)">
              <g className="st-star-eye">
                <polygon points="0,-6 2,-2 6,-1 3,2 4,6 0,4 -4,6 -3,2 -6,-1 -2,-2" fill="#FBBF24" stroke="#B45309" strokeWidth="0.8" />
              </g>
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
            <g transform="translate(47, 59)">
              <g className="st-tease-tongue">
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
          <g transform="translate(70, 16)">
            <g className="st-gg-medal">
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
            <g transform="translate(62, 54)">
              <g className="st-thumb">
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
            <g transform="translate(24, 62)">
              <g className="st-punch-l">
                <circle cx="6" cy="6" r="6.5" fill={`url(#${p}-glove-red)`} stroke="#991B1B" strokeWidth="1" />
              </g>
            </g>

            {/* Right Boxing Glove (Blue) throwing snappy punches */}
            <g transform="translate(64, 62)">
              <g className="st-punch-r">
                <circle cx="6" cy="6" r="6.5" fill={`url(#${p}-glove-blue)`} stroke="#1D4ED8" strokeWidth="1" />
              </g>
            </g>
          </g>
        </g>
      );

    case 'mocking':
      return (
        <g>
          {/* Playful Mocking Body with Dance Sway */}
          <g className="st-mock-dance">
            {/* Left ear hand wagging */}
            <g transform="translate(14, 38)">
              <g className="st-mock-hand-l">
              <path d="M6 10 C0 8 0 2 6 2 C8 2 10 4 10 8 Z" fill="#60A5FA" stroke="#1D4ED8" strokeWidth="1" />
              <circle cx="8" cy="8" r="4" fill="#93C5FD" />
            </g>

            {/* Right ear hand wagging */}
            <g transform="translate(76, 38)">
              <g className="st-mock-hand-r">
              <path d="M4 10 C10 8 10 2 4 2 C2 2 0 4 0 8 Z" fill="#60A5FA" stroke="#1D4ED8" strokeWidth="1" />
              <circle cx="2" cy="8" r="4" fill="#93C5FD" />
            </g>

            {/* Round Character Body */}
            <circle cx="50" cy="54" r="34" fill={`url(#${p}-body)`} />
            <ellipse cx="40" cy="36" rx="16" ry="10" fill={`url(#${p}-highlight)`} />

            {/* Teasing Brows */}
            <path d="M32 40 Q39 36 44 42" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M68 40 Q61 36 56 42" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />

            {/* Cheeky Squint Eyes: > < */}
            <path d="M33 46 L41 50 L33 54" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M67 46 L59 50 L67 54" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />

            {/* Rosy Cheek Blush */}
            <ellipse cx="30" cy="56" rx="4.5" ry="3" fill="#F472B6" opacity="0.85" />
            <ellipse cx="70" cy="56" rx="4.5" ry="3" fill="#F472B6" opacity="0.85" />

            {/* Laughing Mouth with Wagging Tongue */}
            <path d="M39 58 Q50 68 61 58 Z" fill="#0F172A" />
            <g transform="translate(46, 59)">
              <g className="st-mock-tongue">
              <path d="M0 0 L8 0 C8 9 0 9 0 0 Z" fill="#FB7185" stroke="#BE123C" strokeWidth="1" />
              <line x1="4" y1="0" x2="4" y2="6" stroke="#BE123C" strokeWidth="0.8" />
            </g>
          </g>
        </g>
      );

    case 'smug_tease':
      return (
        <g>
          {/* Confident Head Tilt Body */}
          <g className="st-smug-head">
            <circle cx="50" cy="54" r="34" fill={`url(#${p}-body)`} />
            <ellipse cx="40" cy="36" rx="16" ry="10" fill={`url(#${p}-highlight)`} />

            {/* Left Brow: Arched High */}
            <path d="M30 38 Q38 32 46 38" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" fill="none" />
            {/* Right Brow: Relaxed Sassy */}
            <path d="M56 43 Q62 40 68 44" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" fill="none" />

            {/* Left Eye: Half-lidded with confident sideways glance */}
            <path d="M32 46 Q40 42 46 47" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <ellipse cx="39" cy="49" rx="4" ry="3" fill="#0F172A" />
            <circle cx="40.5" cy="48" r="1.5" fill="#FFFFFF" />

            {/* Right Eye: Smug Wink Star */}
            <path d="M57 49 Q63 46 69 49" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
            <polygon points="72,42 73.5,45 77,45.5 74.5,47.5 75,51 72,49.5 69,51 69.5,47.5 67,45.5 70.5,45" fill="#FDE047" className="st-smug-sparkle" />

            {/* Smug Diagonal Smile */}
            <path d="M40 62 Q52 64 63 56" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
            <circle cx="64" cy="55" r="1.5" fill="#FFFFFF" opacity="0.8" />

            {/* Index Finger Wagging "No no no" */}
            <g transform="translate(66, 64)">
              <g className="st-finger-wag">
              {/* Hand Fist */}
              <circle cx="0" cy="0" r="5" fill="#60A5FA" stroke="#1D4ED8" strokeWidth="1" />
              {/* Pointing Index Finger */}
              <path d="M-2 -1 L-2 -12 Q-1 -15 1 -15 Q3 -15 3 -12 L2 -1 Z" fill="#93C5FD" stroke="#1D4ED8" strokeWidth="1" />
            </g>
          </g>
        </g>
      );

    case 'heart_love':
      return (
        <g>
          {/* Floating mini hearts */}
          <g transform="translate(26, 32)">
            <g className="st-float-heart-1">
            <path
              d="M0 -3 C-2 -6 -6 -6 -6 -2.5 C-6 1.2 -1.5 4 0 6 C1.5 4 6 1.2 6 -2.5 C6 -6 2 -6 0 -3 Z"
              fill={`url(#${p}-heart-red)`}
            />
          </g>
          <g transform="translate(74, 28)">
            <g className="st-float-heart-2">
            <path
              d="M0 -3.5 C-2.5 -7 -7 -7 -7 -3 C-7 1.5 -2 5 0 7 C2 5 7 1.5 7 -3 C7 -7 2.5 -7 0 -3.5 Z"
              fill={`url(#${p}-heart-red)`}
            />
          </g>
          <g transform="translate(50, 18)">
            <g className="st-float-heart-3">
            <path
              d="M0 -2.5 C-1.8 -5 -5 -5 -5 -2 C-5 1 -1 3.5 0 5 C1 3.5 5 1 5 -2 C5 -5 1.8 -5 0 -2.5 Z"
              fill={`url(#${p}-cute-pink)`}
            />
          </g>

          {/* Main mascot body with loving sway */}
          <g className="st-heart-love-body">
            <circle cx="50" cy="54" r="34" fill={`url(#${p}-body)`} />
            <ellipse cx="40" cy="36" rx="16" ry="10" fill={`url(#${p}-highlight)`} />

            {/* Glowing Heart Eyes */}
            <g transform="translate(39, 49)">
              <g className="st-heart-eye-l">
              <path
                d="M0 -4 C-2.5 -8 -8 -8 -8 -3.5 C-8 1.5 -2 5 0 8 C2 5 8 1.5 8 -3.5 C8 -8 2.5 -8 0 -4 Z"
                fill={`url(#${p}-heart-red)`}
                stroke="#BE123C"
                strokeWidth="1"
              />
              <ellipse cx="-2.5" cy="-3.5" rx="1.8" ry="1.2" fill="#FFFFFF" opacity="0.85" />
            </g>
            <g transform="translate(61, 49)">
              <g className="st-heart-eye-r">
              <path
                d="M0 -4 C-2.5 -8 -8 -8 -8 -3.5 C-8 1.5 -2 5 0 8 C2 5 8 1.5 8 -3.5 C8 -8 2.5 -8 0 -4 Z"
                fill={`url(#${p}-heart-red)`}
                stroke="#BE123C"
                strokeWidth="1"
              />
              <ellipse cx="-2.5" cy="-3.5" rx="1.8" ry="1.2" fill="#FFFFFF" opacity="0.85" />
            </g>

            {/* Radiant Rosy Blushing Cheeks */}
            <ellipse cx="30" cy="58" rx="5" ry="3" fill="#FB7185" opacity="0.85" />
            <ellipse cx="70" cy="58" rx="5" ry="3" fill="#FB7185" opacity="0.85" />

            {/* Joyful open smile with cute pink tongue */}
            <path d="M42 60 Q50 72 58 60 Z" fill="#0F172A" />
            <path d="M45 64 Q50 71 55 64" fill="#F472B6" />
          </g>
        </g>
      );

    case 'shy_peek':
      return (
        <g>
          {/* Sparkle specks */}
          <polygon
            points="76,40 77.5,43 81,43.5 78.5,45.5 79,49 76,47.5 73,49 73.5,45.5 71,43.5 74.5,43"
            fill="#FDE047"
            className="st-shy-sparkle"
          />

          <g className="st-shy-body">
            <circle cx="50" cy="54" r="34" fill={`url(#${p}-body)`} />
            <ellipse cx="40" cy="36" rx="16" ry="10" fill={`url(#${p}-highlight)`} />

            {/* Big glistening anime eyes */}
            <circle cx="38" cy="48" r="6.5" fill="#0F172A" />
            <circle cx="36" cy="45.5" r="2.8" fill="#FFFFFF" />
            <circle cx="41" cy="51" r="1.4" fill="#FFFFFF" />
            <circle cx="62" cy="48" r="6.5" fill="#0F172A" />
            <circle cx="60" cy="45.5" r="2.8" fill="#FFFFFF" />
            <circle cx="65" cy="51" r="1.4" fill="#FFFFFF" />

            {/* Blushing cheeks with diagonal blush lines */}
            <g className="st-blush-glow">
              <ellipse cx="30" cy="57" rx="6" ry="3.5" fill="#FB7185" />
              <path d="M27 55 L31 59 M30 55 L34 59" stroke="#9F1239" strokeWidth="1" strokeLinecap="round" />
              <ellipse cx="70" cy="57" rx="6" ry="3.5" fill="#FB7185" />
              <path d="M67 55 L71 59 M70 55 L74 59" stroke="#9F1239" strokeWidth="1" strokeLinecap="round" />
            </g>

            {/* Cute shy wavy smile */}
            <path d="M46 62 Q48 64 50 62 Q52 64 54 62" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" fill="none" />

            {/* Bashful paws peeking up over cheeks */}
            <g className="st-shy-hands">
              {/* Left paw */}
              <circle cx="38" cy="65" r="5.5" fill="#FDBA74" stroke="#EA580C" strokeWidth="1" />
              <circle cx="35" cy="61" r="2" fill="#FDBA74" stroke="#EA580C" strokeWidth="0.8" />
              <circle cx="38.5" cy="60" r="2" fill="#FDBA74" stroke="#EA580C" strokeWidth="0.8" />
              <circle cx="42" cy="61" r="2" fill="#FDBA74" stroke="#EA580C" strokeWidth="0.8" />
              {/* Right paw */}
              <circle cx="62" cy="65" r="5.5" fill="#FDBA74" stroke="#EA580C" strokeWidth="1" />
              <circle cx="58" cy="61" r="2" fill="#FDBA74" stroke="#EA580C" strokeWidth="0.8" />
              <circle cx="61.5" cy="60" r="2" fill="#FDBA74" stroke="#EA580C" strokeWidth="0.8" />
              <circle cx="65" cy="61" r="2" fill="#FDBA74" stroke="#EA580C" strokeWidth="0.8" />
            </g>
          </g>
        </g>
      );

    case 'cute_pout':
      return (
        <g>
          {/* Cartoon puff of steam */}
          <g className="st-pout-cloud">
            <path
              d="M20 46 Q16 42 20 38 Q24 34 28 38 Q32 38 32 43 Q33 48 27 48 Q22 50 20 46 Z"
              fill="#FFFFFF"
              opacity="0.9"
            />
          </g>

          <g className="st-pout-body">
            {/* Puffed body with chubby side cheeks */}
            <circle cx="50" cy="54" r="34" fill={`url(#${p}-body)`} />
            <circle cx="30" cy="58" r="9" fill={`url(#${p}-body)`} />
            <circle cx="70" cy="58" r="9" fill={`url(#${p}-body)`} />
            <ellipse cx="40" cy="36" rx="16" ry="10" fill={`url(#${p}-highlight)`} />

            {/* Pouty flushed cheeks */}
            <ellipse cx="28" cy="59" rx="5" ry="3" fill="#F43F5E" opacity="0.85" />
            <ellipse cx="72" cy="59" rx="5" ry="3" fill="#F43F5E" opacity="0.85" />

            {/* Indignant, petulant eyebrows */}
            <path d="M35 41 L47 43" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M65 43 L53 41" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />

            {/* Side-eye pouty glances */}
            <circle cx="42" cy="48" r="5.5" fill="#0F172A" />
            <circle cx="44.5" cy="46" r="2.2" fill="#FFFFFF" />
            <circle cx="60" cy="48" r="5.5" fill="#0F172A" />
            <circle cx="62.5" cy="46" r="2.2" fill="#FFFFFF" />

            {/* Cute downward pouty beak '3' */}
            <path
              d="M48 58 Q52 55 53 59 Q54 63 49 62 Q47 61 48 58 Z"
              fill="#F87171"
              stroke="#E11D48"
              strokeWidth="1"
            />
          </g>
        </g>
      );

    case 'cat_cheer':
      return (
        <g>
          {/* Sparkles */}
          <polygon
            points="14,24 15.5,27 19,27.5 16.5,29.5 17,33 14,31.5 11,33 11.5,29.5 9,27.5 12.5,27"
            fill="#FDE047"
            className="st-sparkle-1"
          />
          <polygon
            points="86,22 87.5,25 91,25.5 88.5,27.5 89,31 86,29.5 83,31 83.5,27.5 81,25.5 84.5,25"
            fill="#FDE047"
            className="st-sparkle-2"
          />

          <g className="st-cat-body">
            {/* Left Cat Ear */}
            <g className="st-cat-ear-l">
              <polygon points="26,35 18,14 40,26" fill={`url(#${p}-body)`} stroke="#1D4ED8" strokeWidth="1" strokeLinejoin="round" />
              <polygon points="27,32 22,18 36,26" fill="#F472B6" />
            </g>
            {/* Right Cat Ear */}
            <g className="st-cat-ear-r">
              <polygon points="74,35 82,14 60,26" fill={`url(#${p}-body)`} stroke="#1D4ED8" strokeWidth="1" strokeLinejoin="round" />
              <polygon points="73,32 78,18 64,26" fill="#F472B6" />
            </g>

            {/* Round Mascot Body */}
            <circle cx="50" cy="54" r="34" fill={`url(#${p}-body)`} />
            <ellipse cx="40" cy="36" rx="16" ry="10" fill={`url(#${p}-highlight)`} />

            {/* Cheerful curved smiling anime eyes */}
            <path d="M35 48 Q41 42 47 48" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            <path d="M53 48 Q59 42 65 48" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" fill="none" />

            {/* Rosy Cheeks */}
            <ellipse cx="32" cy="56" rx="4" ry="2.5" fill="#F472B6" opacity="0.85" />
            <ellipse cx="68" cy="56" rx="4" ry="2.5" fill="#F472B6" opacity="0.85" />

            {/* Cute Kitty Whiskers */}
            <path d="M22 53 L10 51 M22 57 L11 58" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M78 53 L90 51 M78 57 L89 58" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />

            {/* Anime Kitty Mouth 'w' with tongue */}
            <path d="M43 57 Q46.5 61 50 57 Q53.5 61 57 57" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M48 60 Q50 63 52 60 Z" fill="#F87171" />

            {/* Cheering Paws */}
            <g transform="translate(30, 68)">
              <g className="st-cat-paw-l">
              <circle cx="0" cy="0" r="6" fill="#FDBA74" stroke="#EA580C" strokeWidth="1" />
              <circle cx="0" cy="0" r="2.8" fill="#F472B6" />
              <circle cx="-2.5" cy="-3.5" r="1.1" fill="#F472B6" />
              <circle cx="0" cy="-4.2" r="1.1" fill="#F472B6" />
              <circle cx="2.5" cy="-3.5" r="1.1" fill="#F472B6" />
            </g>
            <g transform="translate(70, 68)">
              <g className="st-cat-paw-r">
              <circle cx="0" cy="0" r="6" fill="#FDBA74" stroke="#EA580C" strokeWidth="1" />
              <circle cx="0" cy="0" r="2.8" fill="#F472B6" />
              <circle cx="-2.5" cy="-3.5" r="1.1" fill="#F472B6" />
              <circle cx="0" cy="-4.2" r="1.1" fill="#F472B6" />
              <circle cx="2.5" cy="-3.5" r="1.1" fill="#F472B6" />
            </g>
          </g>
        </g>
      );

    case 'sleepy_yawn':
      return (
        <g>
          {/* Floating Z letters drawn cleanly with SVG paths */}
          <path
            d="M18 20 L26 20 L18 28 L26 28"
            stroke="#818CF8"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            className="st-zzz-1"
          />
          <path
            d="M12 12 L17 12 L12 17 L17 17"
            stroke="#A5B4FC"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            className="st-zzz-2"
          />
          <path
            d="M6 6 L9 6 L6 9 L9 9"
            stroke="#C7D2FE"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            className="st-zzz-3"
          />

          <g className="st-sleepy-body">
            {/* Round Mascot Body */}
            <circle cx="50" cy="54" r="34" fill={`url(#${p}-body)`} />
            <ellipse cx="40" cy="36" rx="16" ry="10" fill={`url(#${p}-highlight)`} />

            {/* Cozy Nightcap */}
            <path
              d="M26 38 C 26 18, 56 12, 70 20 C 82 27, 88 42, 86 52 L 80 52 C 78 40, 72 30, 62 26 C 50 20, 34 26, 32 38 Z"
              fill={`url(#${p}-sleepy-cap)`}
              stroke="#3730A3"
              strokeWidth="1"
            />
            {/* Cap Brim */}
            <path d="M24 38 Q 48 30 72 38" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" fill="none" />
            {/* Swinging Pompom at tip */}
            <g className="st-pompom">
              <circle cx="86" cy="53" r="5" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.8" />
            </g>

            {/* Peaceful closed curved eyelids */}
            <path d="M36 53 Q41 58 46 53" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M54 53 Q59 58 64 53" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />

            {/* Soft pink cheeks */}
            <ellipse cx="32" cy="60" rx="4" ry="2.5" fill="#F472B6" opacity="0.65" />
            <ellipse cx="68" cy="60" rx="4" ry="2.5" fill="#F472B6" opacity="0.65" />

            {/* Small sleepy mouth */}
            <ellipse cx="50" cy="62" rx="2.5" ry="1.8" fill="#1E293B" />

            {/* Translucent snore bubble */}
            <g className="st-snore-bubble">
              <circle cx="53" cy="59" r="6.5" fill="#67E8F9" opacity="0.65" stroke="#06B6D4" strokeWidth="0.8" />
              <ellipse cx="51.5" cy="57" rx="1.8" ry="1" fill="#FFFFFF" opacity="0.8" />
            </g>
          </g>
        </g>
      );

    default:
      return null;
  }
}
