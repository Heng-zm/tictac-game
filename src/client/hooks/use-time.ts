import { useEffect, useMemo, useState } from 'react';

export function useCountdown(
  target: string | null | undefined,
  nowMs?: number,
  offsetMs = 0,
): number | null {
  const targetMs = useMemo(() => {
    if (!target) return null;
    const time = new Date(target).getTime();
    return Number.isFinite(time) ? time : null;
  }, [target]);
  const [tick, setTick] = useState(() => nowMs ?? Date.now());

  useEffect(() => {
    if (targetMs === null) return;
    const current = nowMs ?? Date.now();
    setTick(current);
    // Stop ticking once the target is reached. A countdown that stays mounted
    // after expiry must not keep scheduling renders every 500ms.
    if (nowMs !== undefined || current + offsetMs >= targetMs) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setTick(now);
      if (now + offsetMs >= targetMs) window.clearInterval(timer);
    }, 500);
    return () => window.clearInterval(timer);
  }, [nowMs, targetMs, offsetMs]);

  if (targetMs === null) return null;
  // Derive the value from the current target instead of keeping a separate
  // remaining state. That way replacing an expired target with a fresh one
  // never reports zero for a render.
  return Math.max(0, targetMs - ((nowMs ?? tick) + offsetMs));
}

export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '--:--';
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatLongDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '--';
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  if (totalMinutes < 1) return '<1m';
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function useElapsed(startedAt: number | null): number {
  const [elapsed, setElapsed] = useState(() => (startedAt ? Date.now() - startedAt : 0));
  useEffect(() => {
    if (startedAt === null) {
      setElapsed(0);
      return;
    }
    setElapsed(Date.now() - startedAt);
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return elapsed;
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatClock(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  return new Date(then).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
