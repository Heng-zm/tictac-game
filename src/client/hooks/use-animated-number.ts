import { useEffect, useRef, useState } from 'react';

/**
 * Smoothly animates a numeric value to a target value using quartic ease-out.
 * Automatically respects prefers-reduced-motion.
 */
export function useAnimatedNumber(target: number, durationMs = 900): number {
  const [displayValue, setDisplayValue] = useState(target);
  const currentValueRef = useRef(target);
  const startValueRef = useRef(target);
  const targetRef = useRef(target);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      currentValueRef.current = target;
      setDisplayValue(target);
      targetRef.current = target;
      return;
    }

    startValueRef.current = currentValueRef.current;
    targetRef.current = target;
    startTimeRef.current = null;

    if (startValueRef.current === target) {
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
  }, [target, durationMs]);

  return displayValue;
}
