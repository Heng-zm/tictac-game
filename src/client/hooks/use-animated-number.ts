import { useEffect, useRef, useState } from 'react';

/**
 * Smoothly animates a numeric value to a target value using quartic ease-out.
 * Automatically respects prefers-reduced-motion.
 */
export function useAnimatedNumber(target: number, durationMs = 900): number {
  const safeTarget = Number.isFinite(target) ? target : 0;
  const [displayValue, setDisplayValue] = useState(safeTarget);
  const currentValueRef = useRef(safeTarget);
  const startValueRef = useRef(safeTarget);
  const targetRef = useRef(safeTarget);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

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
  }, [safeTarget, durationMs]);

  return displayValue;
}
