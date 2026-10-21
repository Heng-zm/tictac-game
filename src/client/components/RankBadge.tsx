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
  rookie: 'border-line bg-elevated text-muted',
  bronze: 'border-amber-600/25 bg-amber-600/10 text-amber-700 dark:text-amber-300',
  silver: 'border-slate-400/30 bg-slate-400/10 text-slate-600 dark:text-slate-300',
  gold: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
  platinum: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  diamond: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
  master: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300',
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
  bronze: 'bg-amber-500',
  silver: 'bg-slate-400',
  gold: 'bg-yellow-500',
  platinum: 'bg-cyan-500',
  diamond: 'bg-indigo-500',
  master: 'bg-rose-500',
};

export function RankBadge({ rating, className }: { rating: number; className?: string }) {
  const rank = rankForRating(rating);
  const Icon = rankIcons[rank.tier];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide',
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
        <span className="tabular-nums text-muted">{percent}%</span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevated"
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
