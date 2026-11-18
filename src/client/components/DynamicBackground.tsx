import { memo, useEffect, useRef } from 'react';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/**
 * Dynamic ambient cyber background with interactive cursor spotlight tracking
 * on desktop devices and pure hardware-accelerated CSS drift animations.
 * Completely pointer-events-none.
 */
export const DynamicBackground = memo(function DynamicBackground() {
  const spotlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion() || typeof window === 'undefined') return;

    // Only enable mouse spotlight on pointer devices that support hover (non-touch)
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) {
      return;
    }

    const spotlight = spotlightRef.current;
    if (!spotlight) return;

    let isVisible = false;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;

      if (!isVisible) {
        isVisible = true;
        // Snap instantly to the cursor on first appearance without flying across from offscreen
        spotlight.style.transition = 'none';
        spotlight.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
        void spotlight.offsetHeight; // Force reflow before applying smooth transitions
        spotlight.style.transition = 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease-out';
        spotlight.style.opacity = '1';
        return;
      }

      spotlight.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    };

    const handlePointerLeave = () => {
      isVisible = false;
      spotlight.style.opacity = '0';
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('mouseleave', handlePointerLeave, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('mouseleave', handlePointerLeave);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none [contain:strict] [content-visibility:auto]"
      style={{ transform: 'translate3d(0, 0, 0)' }}
      aria-hidden="true"
    >
      {/* Ambient static radial background glow (isolated from body scrolling) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-90"
        style={{
          backgroundImage:
            'radial-gradient(46rem 32rem at 85% -5%, rgb(var(--app-accent-rgb) / 0.14), transparent 70%), radial-gradient(40rem 32rem at 10% 105%, rgb(var(--app-accent-rgb) / 0.1), transparent 75%), radial-gradient(28rem 28rem at 50% 50%, rgb(var(--app-accent-rgb) / 0.04), transparent 80%)',
        }}
      />

      {/* Ambient tactical cyber grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.035] dark:opacity-[0.065]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(var(--app-accent-rgb) / 0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--app-accent-rgb) / 0.8) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          maskImage: 'radial-gradient(ellipse 90% 80% at 50% 40%, black 40%, transparent 95%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 50% 40%, black 40%, transparent 95%)',
        }}
      />

      {/* Interactive cursor spotlight (desktop mouse tracking glow) */}
      <div
        ref={spotlightRef}
        className="pointer-events-none absolute -top-48 -left-48 h-96 w-96 rounded-full opacity-0 will-change-[transform,opacity] blur-[85px]"
        style={{
          background:
            'radial-gradient(circle, rgb(var(--app-accent-rgb) / 0.22) 0%, rgba(59, 130, 246, 0.12) 40%, transparent 70%)',
          transform: 'translate3d(-9999px, -9999px, 0)',
          transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease-out',
        }}
      />

      {/* Top right cyan/indigo energy orb */}
      <div
        className="absolute -top-[12%] -right-[10%] h-[380px] w-[380px] rounded-full opacity-40 dark:opacity-50 blur-[90px] animate-ambient-drift-1"
        style={{
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.5) 0%, rgba(59, 130, 246, 0.25) 50%, transparent 75%)',
          willChange: 'transform',
          transform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
        }}
      />

      {/* Bottom left indigo/violet atmospheric orb */}
      <div
        className="absolute -bottom-[15%] -left-[12%] h-[420px] w-[420px] rounded-full opacity-35 dark:opacity-45 blur-[100px] animate-ambient-drift-2"
        style={{
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.45) 0%, rgba(139, 92, 246, 0.25) 55%, transparent 75%)',
          willChange: 'transform',
          transform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
        }}
      />

      {/* Center-right warm coral/magenta accent pulse */}
      <div
        className="absolute top-[45%] right-[5%] h-[280px] w-[280px] rounded-full opacity-20 dark:opacity-30 blur-[85px] animate-ambient-drift-3"
        style={{
          background: 'radial-gradient(circle, rgba(244, 63, 94, 0.35) 0%, rgba(236, 72, 153, 0.2) 50%, transparent 75%)',
          willChange: 'transform, opacity',
          transform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
        }}
      />
    </div>
  );
});
