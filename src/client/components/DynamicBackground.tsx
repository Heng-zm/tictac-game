import { memo, useEffect, useRef } from 'react';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/**
 * Dynamic ambient cyber background with 3D gyroscope parallax tilt on mobile
 * devices, smooth physics interpolation (lerp), automatic resting sleep, and
 * desktop cursor parallax fallback.
 */
export const DynamicBackground = memo(function DynamicBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridLayerRef = useRef<HTMLDivElement>(null);
  const orb1LayerRef = useRef<HTMLDivElement>(null);
  const orb2LayerRef = useRef<HTMLDivElement>(null);
  const orb3LayerRef = useRef<HTMLDivElement>(null);

  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);
  const hasGyroRef = useRef(false);
  const baselineBetaRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion() || typeof window === 'undefined') return;

    let isRunning = false;

    const tick = () => {
      const target = targetRef.current;
      const current = currentRef.current;

      // Smooth linear interpolation (lerp)
      current.x += (target.x - current.x) * 0.08;
      current.y += (target.y - current.y) * 0.08;

      const dist = Math.hypot(target.x - current.x, target.y - current.y);

      // Subtle 3D perspective rotation on the main scene
      if (containerRef.current) {
        containerRef.current.style.transform = `perspective(1000px) rotateX(${
          current.y * -3
        }deg) rotateY(${current.x * 3}deg) translate3d(0, 0, 0)`;
      }

      // Parallax depths for each visual layer
      if (gridLayerRef.current) {
        gridLayerRef.current.style.transform = `translate3d(${current.x * 6}px, ${
          current.y * 6
        }px, 0)`;
      }
      if (orb1LayerRef.current) {
        orb1LayerRef.current.style.transform = `translate3d(${current.x * 16}px, ${
          current.y * 16
        }px, 0)`;
      }
      if (orb2LayerRef.current) {
        orb2LayerRef.current.style.transform = `translate3d(${-current.x * 20}px, ${
          -current.y * 20
        }px, 0)`;
      }
      if (orb3LayerRef.current) {
        orb3LayerRef.current.style.transform = `translate3d(${current.x * 26}px, ${
          current.y * 26
        }px, 0)`;
      }

      // If motion has settled close to target, suspend the RAF loop to save battery
      if (dist > 0.001) {
        rafIdRef.current = requestAnimationFrame(tick);
      } else {
        isRunning = false;
        rafIdRef.current = null;
      }
    };

    const startLoop = () => {
      if (!isRunning) {
        isRunning = true;
        rafIdRef.current = requestAnimationFrame(tick);
      }
    };

    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;
      hasGyroRef.current = true;

      // Auto-calibrate baseline beta (phone holding posture) on first reading
      if (baselineBetaRef.current === null) {
        baselineBetaRef.current = event.beta;
      }

      // Gamma: left/right tilt [-25, 25] deg mapped to [-1, 1]
      const rawX = clamp(event.gamma / 25, -1, 1);
      // Beta: forward/back tilt relative to user's holding angle
      const rawY = clamp((event.beta - baselineBetaRef.current) / 25, -1, 1);

      targetRef.current = { x: rawX, y: rawY };
      startLoop();
    };

    const handlePointerMove = (event: PointerEvent) => {
      // Gyroscope takes precedence when active on mobile devices
      if (hasGyroRef.current) return;
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      targetRef.current = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
      startLoop();
    };

    window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
      window.removeEventListener('pointermove', handlePointerMove);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none [contain:strict] [content-visibility:auto]"
      style={{ transform: 'perspective(1000px) translate3d(0, 0, 0)', transformStyle: 'preserve-3d' }}
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

      {/* Ambient tactical cyber grid pattern (Parallax Layer 1: Depth 6px) */}
      <div ref={gridLayerRef} className="absolute inset-0 will-change-transform">
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
      </div>

      {/* Top right cyan/indigo energy orb (Parallax Layer 2: Depth 16px) */}
      <div ref={orb1LayerRef} className="absolute inset-0 will-change-transform">
        <div
          className="absolute -top-[12%] -right-[10%] h-[380px] w-[380px] rounded-full opacity-40 dark:opacity-50 blur-[90px] animate-ambient-drift-1"
          style={{
            background:
              'radial-gradient(circle, rgba(6, 182, 212, 0.5) 0%, rgba(59, 130, 246, 0.25) 50%, transparent 75%)',
            willChange: 'transform',
            transform: 'translate3d(0, 0, 0)',
            backfaceVisibility: 'hidden',
          }}
        />
      </div>

      {/* Bottom left indigo/violet atmospheric orb (Parallax Layer 3: Counter-depth -20px) */}
      <div ref={orb2LayerRef} className="absolute inset-0 will-change-transform">
        <div
          className="absolute -bottom-[15%] -left-[12%] h-[420px] w-[420px] rounded-full opacity-35 dark:opacity-45 blur-[100px] animate-ambient-drift-2"
          style={{
            background:
              'radial-gradient(circle, rgba(99, 102, 241, 0.45) 0%, rgba(139, 92, 246, 0.25) 55%, transparent 75%)',
            willChange: 'transform',
            transform: 'translate3d(0, 0, 0)',
            backfaceVisibility: 'hidden',
          }}
        />
      </div>

      {/* Center-right warm coral/magenta accent pulse (Parallax Layer 4: Depth 26px) */}
      <div ref={orb3LayerRef} className="absolute inset-0 will-change-transform">
        <div
          className="absolute top-[45%] right-[5%] h-[280px] w-[280px] rounded-full opacity-20 dark:opacity-30 blur-[85px] animate-ambient-drift-3"
          style={{
            background:
              'radial-gradient(circle, rgba(244, 63, 94, 0.35) 0%, rgba(236, 72, 153, 0.2) 50%, transparent 75%)',
            willChange: 'transform, opacity',
            transform: 'translate3d(0, 0, 0)',
            backfaceVisibility: 'hidden',
          }}
        />
      </div>
    </div>
  );
});
