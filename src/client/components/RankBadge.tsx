import { Award, Crown, Gem, Medal, Shield, ShieldCheck, Sprout, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';
import { rankForRating, type RankTier } from '../lib/ranks';

const rankIcons: Record<RankTier, LucideIcon> = {
  rookie: Sprout,
  bronze: Shield,
  silver: Medal,
  gold: Award,
  platinum: ShieldCheck,
  diamond: Gem,
  master: Crown,
};

const badgeStyles: Record<RankTier, string> = {
  rookie: 'border-line bg-elevated/70 text-muted',
  bronze: 'border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-300',
  silver: 'border-slate-400/35 bg-slate-400/10 text-slate-600 dark:text-slate-300',
  gold: 'border-yellow-500/35 bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 shadow-glow-gold/10',
  platinum: 'border-cyan-500/35 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 shadow-glow/10',
  diamond: 'border-indigo-500/35 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 shadow-glow/15',
  master: 'border-rose-500/35 bg-rose-500/15 text-rose-600 dark:text-rose-300 shadow-glow-danger/15',
};

const textStyles: Record<RankTier, string> = {
  rookie: 'text-muted',
  bronze: 'text-amber-600 dark:text-amber-300',
  silver: 'text-slate-600 dark:text-slate-300',
  gold: 'text-yellow-700 dark:text-yellow-300',
  platinum: 'text-cyan-700 dark:text-cyan-300',
  diamond: 'text-indigo-600 dark:text-indigo-300',
  master: 'text-rose-600 dark:text-rose-300',
};

const barStyles: Record<RankTier, string> = {
  rookie: 'bg-muted',
  bronze: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]',
  silver: 'bg-slate-300 dark:bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.4)]',
  gold: 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]',
  platinum: 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]',
  diamond: 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]',
  master: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]',
};

export function RankBadge({ rating, className }: { rating: number; className?: string }) {
  const rank = rankForRating(rating);
  const Icon = rankIcons[rank.tier];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide backdrop-blur-xs',
        badgeStyles[rank.tier],
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {rank.name}
    </span>
  );
}

export function RankLabel({ rating, className }: { rating: number; className?: string }) {
  const rank = rankForRating(rating);

  return <span className={cn('font-semibold', textStyles[rank.tier], className)}>{rank.name}</span>;
}

export function RankProgress({ rating, className }: { rating: number; className?: string }) {
  const rank = rankForRating(rating);
  const percent = Math.round(rank.progress * 100);
  const label = rank.nextRank
    ? `${rank.pointsToNext} ${rank.pointsToNext === 1 ? 'pt' : 'pts'} to ${rank.nextRank.name}`
    : 'Top rank reached';

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="font-medium text-muted">{label}</span>
        <span className="tabular-nums font-semibold text-ink">{percent}%</span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-elevated/80 p-0.5 border border-line/40"
        role="progressbar"
        aria-label={`${rank.name} rank progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={
          rank.nextRank
            ? `${rank.name}: ${label}`
            : `${rank.name}: top rank reached`
        }
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500 ease-out', barStyles[rank.tier])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
