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
      {/* Top right cyan/indigo energy orb */}
      <div
        className="absolute -top-[12%] -right-[10%] h-[380px] w-[380px] rounded-full opacity-35 dark:opacity-45 blur-[90px] animate-ambient-drift-1"
        style={{
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.45) 0%, rgba(59, 130, 246, 0.2) 50%, transparent 75%)',
        }}
      />

      {/* Bottom left indigo/violet atmospheric orb */}
      <div
        className="absolute -bottom-[15%] -left-[12%] h-[420px] w-[420px] rounded-full opacity-30 dark:opacity-40 blur-[100px] animate-ambient-drift-2"
        style={{
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, rgba(139, 92, 246, 0.2) 55%, transparent 75%)',
        }}
      />

      {/* Center-right subtle warm coral/magenta accent orb */}
      <div
        className="absolute top-[45%] right-[5%] h-[280px] w-[280px] rounded-full opacity-20 dark:opacity-25 blur-[85px] animate-ambient-drift-3"
        style={{
          background: 'radial-gradient(circle, rgba(244, 63, 94, 0.3) 0%, rgba(236, 72, 153, 0.15) 50%, transparent 75%)',
        }}
      />
    </div>
  );
});
