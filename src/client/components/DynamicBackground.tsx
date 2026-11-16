import { memo } from 'react';

/**
 * Dynamic ambient cyber background orbs that pulse and drift softly behind the UI.
 * Pure hardware-accelerated CSS animations, completely pointer-events-none.
 */
export const DynamicBackground = memo(function DynamicBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
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

      {/* Top right cyan/indigo energy orb */}
      <div
        className="absolute -top-[12%] -right-[10%] h-[380px] w-[380px] rounded-full opacity-40 dark:opacity-50 blur-[90px] animate-ambient-drift-1"
        style={{
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.5) 0%, rgba(59, 130, 246, 0.25) 50%, transparent 75%)',
          willChange: 'transform',
        }}
      />

      {/* Bottom left indigo/violet atmospheric orb */}
      <div
        className="absolute -bottom-[15%] -left-[12%] h-[420px] w-[420px] rounded-full opacity-35 dark:opacity-45 blur-[100px] animate-ambient-drift-2"
        style={{
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.45) 0%, rgba(139, 92, 246, 0.25) 55%, transparent 75%)',
          willChange: 'transform',
        }}
      />

      {/* Center-right warm coral/magenta accent pulse */}
      <div
        className="absolute top-[45%] right-[5%] h-[280px] w-[280px] rounded-full opacity-20 dark:opacity-30 blur-[85px] animate-ambient-drift-3"
        style={{
          background: 'radial-gradient(circle, rgba(244, 63, 94, 0.35) 0%, rgba(236, 72, 153, 0.2) 50%, transparent 75%)',
          willChange: 'transform, opacity',
        }}
      />
    </div>
  );
});
