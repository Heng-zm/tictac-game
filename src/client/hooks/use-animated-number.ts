import { useEffect, useRef, useState } from 'react';

export interface AnimatedNumberOptions {
  durationMs?: number;
  initial?: number;
  animateOnMount?: boolean;
}

const DEFAULT_DURATION_MS = 900;
const MAX_DECIMALS = 3;

function resolveDuration(optionsOrDuration?: number | AnimatedNumberOptions): number {
  const rawDuration =
    typeof optionsOrDuration === 'number'
      ? optionsOrDuration
      : optionsOrDuration?.durationMs ?? DEFAULT_DURATION_MS;
  if (!Number.isFinite(rawDuration)) return DEFAULT_DURATION_MS;
  return Math.max(1, rawDuration);
}

/** Decimal places needed to render `value`, so decimal targets do not snap at the end. */
function decimalsOf(value: number): number {
  if (!Number.isFinite(value) || Number.isInteger(value)) return 0;
  const fraction = Math.abs(value).toString().split('.')[1] ?? '';
  return Math.min(fraction.length, MAX_DECIMALS);
}

function roundTo(value: number, decimals: number): number {
  if (decimals === 0) return Math.round(value);
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Smoothly animates a numeric value to a target value using quartic ease-out.
 * Automatically respects prefers-reduced-motion.
 */
export function useAnimatedNumber(
  target: number,
  optionsOrDuration?: number | AnimatedNumberOptions,
): number {
  const safeTarget = Number.isFinite(target) ? target : 0;
  const durationMs = resolveDuration(optionsOrDuration);
  const animateOnMount =
    typeof optionsOrDuration === 'object' && optionsOrDuration.animateOnMount !== undefined
      ? optionsOrDuration.animateOnMount
      : false;
  const initial =
    typeof optionsOrDuration === 'object' && optionsOrDuration.initial !== undefined
      ? optionsOrDuration.initial
      : animateOnMount
        ? 0
        : safeTarget;

  const [displayValue, setDisplayValue] = useState(initial);
  const currentValueRef = useRef(initial);
  const startValueRef = useRef(initial);
  const targetRef = useRef(safeTarget);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      currentValueRef.current = safeTarget;
      setDisplayValue(safeTarget);
      targetRef.current = safeTarget;
      return;
    }

    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (!animateOnMount && currentValueRef.current === safeTarget) {
        return;
      }
    } else if (currentValueRef.current === safeTarget) {
      return;
    }

    startValueRef.current = currentValueRef.current;
    targetRef.current = safeTarget;
    startTimeRef.current = null;

    if (startValueRef.current === safeTarget) {
      return;
    }

    // Keep the animation on the same precision as the values it moves between, so a
    // decimal target (e.g. a 63.6% win rate) does not flicker between integers and snap.
    const decimals = Math.max(decimalsOf(startValueRef.current), decimalsOf(safeTarget));

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(1, elapsed / durationMs);
      // Quartic ease out: 1 - (1 - progress)^4
      const ease = 1 - Math.pow(1 - progress, 4);
      const interpolated = startValueRef.current + (targetRef.current - startValueRef.current) * ease;
      const current = roundTo(interpolated, decimals);

      currentValueRef.current = current;
      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        currentValueRef.current = targetRef.current;
        setDisplayValue(targetRef.current);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [safeTarget, durationMs, animateOnMount]);

  return displayValue;
}
