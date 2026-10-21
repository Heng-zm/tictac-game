import { useEffect, useMemo, useState } from 'react';

export function useCountdown(target: string | null | undefined, nowMs?: number): number | null {
  const targetMs = useMemo(() => (target ? new Date(target).getTime() : null), [target]);
  const [remaining, setRemaining] = useState<number | null>(() =>
    targetMs === null ? null : Math.max(0, targetMs - (nowMs ?? Date.now())),
  );

  useEffect(() => {
    if (targetMs === null) {
      setRemaining(null);
      return;
    }
    const update = () => setRemaining(Math.max(0, targetMs - Date.now()));
    update();
    const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, [targetMs]);

  return remaining;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return '--:--';
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatLongDuration(ms: number | null): string {
  if (ms === null) return '--';
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
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
