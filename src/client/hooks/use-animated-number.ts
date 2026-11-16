import { useEffect, useRef, useState } from 'react';

export interface AnimatedNumberOptions {
  durationMs?: number;
  initial?: number;
  animateOnMount?: boolean;
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
  const durationMs =
    typeof optionsOrDuration === 'number'
      ? optionsOrDuration
      : optionsOrDuration?.durationMs ?? 900;
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

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(1, elapsed / durationMs);
      // Quartic ease out: 1 - (1 - progress)^4
      const ease = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(startValueRef.current + (targetRef.current - startValueRef.current) * ease);

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
