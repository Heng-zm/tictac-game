import { useId, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { normalizeLanguage, type SupportedLanguage } from '../lib/language';

export type FlagSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface CircularFlagProps extends HTMLAttributes<HTMLSpanElement> {
  code?: string | null;
  size?: FlagSize | number;
  ring?: boolean;
  bordered?: boolean;
  alt?: string;
}

const SIZE_MAP: Record<FlagSize, { px: number; className: string }> = {
  xs: { px: 18, className: 'h-[18px] w-[18px]' },
  sm: { px: 24, className: 'h-6 w-6' },
  md: { px: 30, className: 'h-[30px] w-[30px]' },
  lg: { px: 36, className: 'h-9 w-9' },
  xl: { px: 44, className: 'h-11 w-11' },
};

export function CircularFlag({
  code,
  size = 'md',
  ring = true,
  bordered = true,
  alt,
  className,
  ...props
}: CircularFlagProps) {
  const lang: SupportedLanguage = normalizeLanguage(code);
  const clipId = useId();
  const glossId = useId();
  const towerId = useId();

  const sizeInfo = typeof size === 'number' ? null : SIZE_MAP[size];
  const dimension = typeof size === 'number' ? size : sizeInfo?.px ?? 30;
  const sizeClass = sizeInfo?.className ?? '';

  const defaultAlt = lang === 'km' ? 'Cambodia flag (Khmer)' : 'United Kingdom flag (English)';

  return (
    <span
      role="img"
      aria-label={alt ?? defaultAlt}
      style={typeof size === 'number' ? { width: dimension, height: dimension } : undefined}
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center rounded-full overflow-hidden shadow-xs transition-transform duration-200',
        ring && 'ring-1 ring-black/10 dark:ring-white/20',
        bordered && 'border border-black/5 dark:border-white/10',
        sizeClass,
        className,
      )}
      {...props}
    >
      <svg
        viewBox="0 0 512 512"
        width="100%"
        height="100%"
        className="block h-full w-full rounded-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx="256" cy="256" r="256" />
          </clipPath>
          <linearGradient id={glossId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.25" />
            <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
          </linearGradient>

          {/* Angkor Wat Flanking Tower (Reused & Mirrored for Official 3-Tower Flag) */}
          <g id={towerId}>
            <path d="M99 664.2v-20.4c-.7-2.6-3-5-4.6-5.4v-18l3.7 2 4.3 18.9v23z" />
            <path d="M99 664.3v-20.5c-.7-2.6-3-5-4.6-5.4v-19.2c2.5 0 3.7 3.2 3.7 3.2l4.3 18.9v22.9z" />
            <path d="M96.3 669.5c1.7-.7 4.2-2.9 4.2-5v-25.6l-1.2-2H143l-1.7 2v25.6a6 6 0 0 0 3.4 5z" />
            <path d="M135.8 669.5c-1.7-.7-4.2-2.9-4.2-5v-24.3l3.6-3.4h-29.6l3.6 3.4v24.3c0 2.1-2.5 4.3-4.2 5z" />
            <path d="M131.7 669.5c-1.7-.7-4.3-2.9-4.3-5v-22l2.4-3.3H111l2.4 3.3v22c0 2.1-2.5 4.3-4.3 5z" />
            <path d="M116 639.2h8.9v30.4h-9z" />
            <path strokeLinejoin="bevel" d="M103.7 647.6h3.6v16.5h-3.6zm30.8 0h3.5v16.5h-3.6zm-33.9-27.8h4.4v17h-4.4zm0-3.2h4.3v3.2h-4.3zm35.6 6.9h6.1v13h-6.1z" />
            <path d="M104.9 636.6v-29c1.2 0 1.4 4.3 4.2 4.3 1.5 0 1.4-1.8.5-3.2-.7-1.3-1.6-3-.4-6.3.9 2.5 3.1 3.3 2.7 1.8-.7-2.7-2.8-3.2-1.2-7.3.5 3.4 2.7 3.3 2.2 1.3-.6-2.3-1.9-3.3-.3-6.5.9 3.7 2 3.5 2 1.2 0-3.4 0-7 4.2-8.3 0 0 .3-3 1.9-3s1.8 3 1.8 3c4.3 1.3 4.2 5 4.2 8.3 0 2.3 1.1 2.5 2-1.2 1.6 3.2.3 4.2-.3 6.5-.5 2 1.7 2.1 2.2-1.3 1.6 4.1-.5 4.6-1.2 7.3-.4 1.5 1.8.7 2.7-1.8 1.2 3.3.3 5-.4 6.3-.8 1.4-1 3.2.5 3.2 2.8 0 3-4.2 4.2-4.2v28.9zM98 614.7v22.1h2.5v-22.1q-1.3-.7-2.5 0z" />
            <path d="M98.2 629c3.1 1.6 6.2 3.5 7 7.8h-7zm43.2-6.6v14.4h2v-14.4q-1-.5-2 0z" />
            <path d="M143.4 629c-3.1 1.5-6.2 3.3-7 7.7h7zm-20.6-33.7 1.8-1.5v-2q-.8 0-1.5 1a5 5 0 0 0-2.5-3 5 5 0 0 0-2.6 2.9q-.6-.9-1.5-1v2l1.8 1.6z" />
            <path d="m123.8 600.2.8-1.9v-2.5q-.8 0-1.5 1a5 5 0 0 0-2.5-3 5 5 0 0 0-2.6 2.9q-.6-.9-1.5-.9v2.5l.8 1.9z" />
            <path d="m124 606.8 2.6-3.3v-3.2q-1.3 0-2.2 1.6c-.7-2.3-2-2.7-3.8-3.8-1.9 1-3.2 1.5-3.8 3.7-.8-1.1-1.3-1.4-2.3-1.5v3.2l2.7 3.3z" />
            <path d="M124.7 613.3s3.2-2.7 3.3-4.2v-3.5c-1.2.1-2.3.4-3.2 1.9-.8-2.9-2-3.7-4.2-5-2.3 1.3-3.5 2.1-4.2 5-1-1.5-2-1.8-3.3-2v3.6a15 15 0 0 0 3.3 4.2z" />
            <path d="M126 625.3s4.4-4.7 4.5-6.6v-5.4q-2.5.2-4.4 3.6-1.3-6.6-5.5-9.8c-3 2.2-4.6 5.3-5.6 9.8q-1.9-3.4-4.3-3.6v5.4c.3 1.9 4.4 6.6 4.4 6.6z" />
            <path d="M126 632.4s3.7-3.7 4.5-5.3v-5.4q-2.5.3-4.4 3.5a14 14 0 0 0-5.5-9.2c-3 2.2-4.6 4.7-5.6 9.2q-1.9-3.2-4.3-3.5v5.4c1 1.6 4.4 5.3 4.4 5.3z" />
            <path d="M127.5 636.6c-1-4.7-2-8.2-7.1-11.7-5.2 3.5-6.1 7-7.2 11.7z" />
            <path d="M130.2 639.2v-6.8c-2.4 1-4.5 2.3-5.3 3.8-.8-3.8-2.5-5.4-4.6-7.7-2.1 2.3-3.5 4-4.4 7.7-.8-1.5-2.9-2.9-5.2-3.8v6.8z" />
          </g>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          {lang === 'km' ? (
            /* Cambodia Flag (Official 3-Tower Angkor Wat National Flag) */
            <g>
              {/* Top & Bottom Blue Stripes */}
              <path fill="#032ea1" d="M0 0h512v512H0z" />
              {/* Center Red Stripe */}
              <path fill="#e00025" d="M0 128h512v256H0z" />

              {/* Angkor Wat National Emblem */}
              <g fill="#fff" stroke="#000" strokeWidth="1" transform="translate(6 -556.7)scale(1.28)">
                <g strokeLinejoin="bevel">
                  <path d="M139 623.5h113.8v43.8H139z" />
                  <path d="M247 647.6h3.5v16.5H247zm-108-8.1h113.8v5H139zm0-7h113.8v4.6H139z" />
                  <path strokeWidth=".9" d="M139 625.7h113.8v4.3H139z" />
                  <path d="M169 647.6h3.6v16.5H169zm49 0h3.6v16.5H218zm-78 0h3.5v16.5H140zm7 0h3.5v16.5H147zm7.5 0h3.5v16.5h-3.5zm7.5 0h3.5v16.5H162zm62.8 0h3.6v16.5h-3.6zm7.5 0h3.6v16.5h-3.6zm7.5 0h3.6v16.5h-3.6z" />
                  <path strokeLinejoin="miter" d="M94.5 669.5a9 9 0 0 0 4.4-5.3H292a9 9 0 0 0 4.4 5.3z" />
                </g>
                {/* Central Tower */}
                <path d="M193 556.8s-.1-4.1 2.3-4.2c2.3 0 2.2 4.2 2.2 4.2zm-12.5 54.5v-5.5c0-2.8-2.8-3-2.8-5 0 0-.4-3 .4-4.4 1.1 4 3 3.3 3 1.6 0-1.4-1-2.8-3.3-6.3-.8-1.1-.3-4.6.7-5.9q.4 4.5 2.2 4.5 1.3.1 1.4-2c0-2-1.3-3-2-4.8a5 5 0 0 1 1.1-5.3c.5 3 .4 4.2 1.7 4.2 2.7-.9 0-4.8-.6-5.8-.6-1.1 1-3.4 1-3.4.8 2.7 1 2.9 2 2.6 1.2-.3 1-2-.4-3.4q-1.3-1.6.2-3.3c1 1.9 2.2 1.8 2.3.6l-.8-4.4H204l-.9 4.3c-.2 1.2 1.4 1.5 2.4-.5 1 1 1.1 2.4.2 3.3-1.4 1.4-1.6 3.1-.4 3.4 1 .3 1.2 0 2-2.6 0 0 1.5 1.5 1 3.4-.6 1-3.3 5-.6 5.8 1.3 0 1.2-1.2 1.7-4.2a5 5 0 0 1 1 5.3c-.6 1.8-2 2.8-2 4.8q.2 2.1 1.5 2 1.8 0 2.2-4.5c1 1.3 1.5 4.8.7 6-2.3 3.4-3.4 4.8-3.4 6.2 0 1.7 2 2.4 3-1.6.9 1.4.5 4.4.5 4.4 0 2-2.7 2.2-2.8 5v5.5zm7.2-46-.4-3.1h15.9l-.4 3.1zm1-3.2-.2-2.5H202l-.3 2.5zm2.3-2.6-.3-2.6h9l-.1 2.6zm33 110c-2-.7-5-2.9-5-5v-24.3l2.6-3.4H169l2.5 3.4v24.3c0 2.1-2 4.3-4 5z" />
                <path strokeLinejoin="bevel" d="M178.2 647.6h3.6v16.5h-3.6zm30.4 0h3.6v16.5h-3.6z" />
                <path d="M168 609.2v27.6h54v-27.6a4 4 0 0 0-2.6 2.8v11.8h-48.7V612s-.6-2-2.8-2.8z" />
                <path d="M214.6 669.5c-1.8-.7-5.6-2.9-5.6-5v-27.2c.4-1.5 2.4-2.4 3.7-3.4H177c1.7 1 3.6 1.7 4.3 3.4v27.2c0 2.1-3 4.3-4.8 5z" />
                <path d="M219.4 634.2v-19.6h-4.9v-1.9h-38.8v2h-5v19.5zM207 669.5c-1.8-.7-4.3-2.9-4.3-5v-23.2l1.4-2.1h-17.7l1.5 2v23.3c0 2.1-2.6 4.3-4.3 5z" />
                <path d="M190.7 639.2h9v30.3h-9z" />
                <path strokeLinejoin="bevel" d="M204.4 632.5c0-2 5.8-2.1 8.8-3.8h-36c3 1.7 8.7 1.8 8.7 3.8l1.2 3.9 15 .6z" />
                <path d="M211.4 611.3c0-4.9.2-6.7 1.7-6.7V620c-3.7 1.4-6.3 6-6.3 6h-23.2s-2.6-4.6-6.3-6v-15.5c1.8 0 1.8 2 1.8 6.7zm1.7-2c0-5.6 4.9-6.2 4.9-6.2v5c-1.9-.1-2.8 1.6-2.8 4 0 2.5 1.5 2.5 1.5 2.5v14.2h-3.6z" />
                <path d="M177.3 609.3c0-5.6-4.9-6.2-4.9-6.2v5c1.9-.1 2.8 1.6 2.8 4 0 2.5-1.5 2.5-1.5 2.5v14.2h3.6z" />
                <g fill="none" strokeWidth=".8">
                  <path d="M186.8 570.6H204m-19.2 5.4h21m-23 6.5h24.9m-27 7.9h29.5m-30.2 9h30.4" />
                  <path strokeWidth="1" d="M170.8 629h48.6m-33.2 0h18v6.6h-18z" />
                </g>
                <path d="M184 614.2c3 3.6 2.6 9.7 2.6 13.3H204c0-3.6-.4-9.7 2.6-13.3zm9.7-41-2.4-1.3v-3.5c1 .3 2 .4 2.2 2 .3-2.3 1-2.1 1.9-3 1 .9 1.5.7 1.9 3 0-1.6 1.2-1.7 2.1-2v3.5l-2.3 1.2z" />
                <path d="m193.5 578.9-4-2.8V573c1.5.3 3 .5 3.2 2.2.4-2.5 1.3-3.7 2.7-4.7 1.3 1 2.2 2.2 2.7 4.7.1-1.7 1.7-1.9 3-2.2v3.2l-3.9 2.7z" />
                <path d="m193.2 587.8-4.5-4v-4.7c1.6.4 3.4.6 3.6 3.1.5-3.5 1.5-5.4 3-6.8 1.6 1.4 2.6 3.3 3.2 6.8.2-2.5 2-2.7 3.6-3.1v4.7l-4.6 4zm8.4 5.3-4 5.7h-4.7l-4.1-5.7zm-15.2 9.5q2.9 1.5 3 7.6H201q.1-6.1 3-7.6z" />
                <path strokeLinejoin="bevel" d="M204.2 593v-5.6a5 5 0 0 0-3.8 3.3c0-2-2.5-6.3-5.2-8.5-2.7 2.4-5.3 6.4-5.2 8.4q-.8-2.4-3.8-3.2v5.7z" />
                <path strokeLinejoin="bevel" d="M205 602.6V597q-3.2.9-4.1 3.3c0-2-2.7-6.3-5.7-8.5-3 2.5-5.8 6.4-5.7 8.5q-.8-2.3-4.1-3.3v5.7z" />
                <path strokeLinejoin="bevel" d="M207.4 614.3v-6.6a10 10 0 0 0-5.1 3.8c0-3.5-4-9-7.1-10.7-3.2 1.8-7.1 7.4-7.1 10.7a10 10 0 0 0-5.2-3.8v6.6z" />
                <path strokeLinejoin="bevel" d="M206 629v-6.8c-2.4.9-3 3.1-3.8 4.7.3-6.9-3.8-14.2-7-16.1-3.2 1.9-7.4 9.4-7 16-.8-1.4-1.5-3.7-3.8-4.6v6.7z" />
                <path d="M204.4 639.2v-6.8c-2.5.6-2.6 1.5-3.4 3 .3-4.1-2.6-8.8-5.8-10.6-3.2 1.8-6 6.5-5.8 10.6-.8-1.5-.9-2.4-3.4-3v6.8z" />

                {/* Left Flanking Tower */}
                <use href={`#${towerId}`} width="100%" height="100%" />
                {/* Right Flanking Tower (Symmetric Mirror) */}
                <use href={`#${towerId}`} width="100%" height="100%" transform="matrix(-1 0 0 1 390.7 0)" />

                {/* Stepped Galleries & Colonnades */}
                <path d="M72.7 694.3H318v12.5H72.7zm-6.5 12.5h258.3v12.5H66.2zm19.4-31.3H305v8.1H85.6z" />
                <path d="M79.2 683.6h232.4v10.6H79.2zm10.2-14.3h212v6.2h-212z" />
                <path d="M112.4 669.3h16v50h-16z" />
                <path d="M116 669.3h8.9v50h-9zm71 0h16v50h-16z" />
                <path d="M190.7 669.3h9v50h-9zm71.5 0h16v50h-16z" />
                <path d="M265.7 669.3h9v50h-9z" />
                <path fill="none" d="M99 664.2h193M115.8 713h9.2m-9.2-6.3h9.2m-9.2-6.2h9.2m-9.2-6.3h9.2m-9.2-6.2h9.2m-9.2-6.3h9.2m-9.2-6.2h9.2m65.8 37.5h8.6m-8.6-6.3h8.6m-8.6-6.2h8.6m-8.6-6.3h8.6m-8.6-6.2h8.6m-8.6-6.3h8.6m-8.6-6.2h8.6m66.2 37.5h9.2m-9.2-6.3h9.2m-9.2-6.2h9.2m-9.2-6.3h9.2m-9.2-6.2h9.2m-9.2-6.3h9.2m-9.2-6.2h9.2" />
              </g>
            </g>
          ) : (
            /* United Kingdom Flag (Union Jack Circular) */
            <g>
              {/* Blue Field */}
              <path fill="#012169" d="M0 0h512v512H0z" />
              {/* White Saltire Diagonals */}
              <path fill="#FFF" d="M512 0v64L322 256l190 187v69h-67L254 324 68 512H0v-68l186-187L0 74V0h62l192 188L440 0z" />
              {/* Red Saltire (St. Patrick) */}
              <path fill="#C8102E" d="m184 324 11 34L42 512H0v-3zm124-12 54 8 150 147v45zM512 0 320 196l-4-44L466 0zM0 1l193 189-59-8L0 49z" />
              {/* White Cross */}
              <path fill="#FFF" d="M176 0v512h160V0zM0 176v160h512V176z" />
              {/* Red Cross (St. George) */}
              <path fill="#C8102E" d="M0 208v96h512v-96zM208 0v512h96V0z" />
            </g>
          )}

          {/* Glossy Overlay Highlight */}
          <rect x="0" y="0" width="512" height="512" fill={`url(#${glossId})`} pointerEvents="none" />

          {/* Inner Coin Border */}
          <circle
            cx="256"
            cy="256"
            r="248"
            fill="none"
            stroke="rgba(255, 255, 255, 0.28)"
            strokeWidth="8"
            pointerEvents="none"
          />
        </g>
      </svg>
    </span>
  );
}
