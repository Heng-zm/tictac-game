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
  gold: 'border-yellow-500/35 bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 shadow-[0_0_12px_-2px_rgba(234,179,8,0.25)]',
  platinum: 'border-cyan-500/35 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 shadow-[0_0_12px_-2px_rgba(6,182,212,0.25)]',
  diamond: 'border-indigo-500/35 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 shadow-[0_0_12px_-2px_rgba(99,102,241,0.25)]',
  master: 'border-rose-500/35 bg-rose-500/15 text-rose-600 dark:text-rose-300 shadow-[0_0_12px_-2px_rgba(244,63,94,0.25)]',
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

export function RankIcon({
  rating,
  tier,
  size = 'md',
  variant = 'badge',
  className,
}: {
  rating?: number;
  tier?: RankTier;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'badge' | 'solid' | 'ghost';
  className?: string;
}) {
  const resolvedTier: RankTier = tier ?? (rating !== undefined ? rankForRating(rating).tier : 'rookie');
  const Icon = rankIcons[resolvedTier];

  const sizeStyles = {
    xs: 'h-4 w-4 p-0.5 rounded',
    sm: 'h-6 w-6 p-1 rounded-lg text-xs',
    md: 'h-8 w-8 p-1.5 rounded-xl text-sm',
    lg: 'h-10 w-10 p-2 rounded-2xl text-base',
    xl: 'h-12 w-12 p-2.5 rounded-2xl text-lg',
  };

  const iconSizes = {
    xs: 'h-3 w-3',
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
    xl: 'h-6 w-6',
  };

  const variantStyles = {
    badge: badgeStyles[resolvedTier],
    solid: barStyles[resolvedTier] + ' text-white',
    ghost: textStyles[resolvedTier] + ' bg-transparent border-transparent',
  };

  return (
    <span
      className={cn(
        'group inline-flex shrink-0 items-center justify-center border font-bold shadow-xs select-none transition-transform duration-200 hover:scale-105 active:scale-95',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      aria-label={`${resolvedTier} rank icon`}
      title={`${resolvedTier} rank`}
    >
      <Icon className={cn(iconSizes[size], 'transition-transform duration-200 group-hover:scale-110', (resolvedTier === 'master' || resolvedTier === 'diamond') && 'animate-pulse-subtle')} aria-hidden />
    </span>
  );
}

export function RankBadge({ rating, className }: { rating: number; className?: string }) {
  const rank = rankForRating(rating);
  const Icon = rankIcons[rank.tier];

  return (
    <span
      className={cn(
        'group relative inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-[10px] font-bold tracking-wide backdrop-blur-sm transition-transform duration-200 hover:scale-105 active:scale-95 select-none shadow-xs',
        badgeStyles[rank.tier],
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0 transition-transform duration-200 group-hover:rotate-12" aria-hidden />
      <span>{rank.name}</span>
    </span>
  );
}

export function RankLabel({
  rating,
  withIcon = false,
  className,
}: {
  rating: number;
  withIcon?: boolean;
  className?: string;
}) {
  const rank = rankForRating(rating);
  const Icon = rankIcons[rank.tier];

  return (
    <span className={cn('inline-flex items-center gap-1 font-semibold', textStyles[rank.tier], className)}>
      {withIcon ? <Icon className="h-3 w-3 shrink-0" aria-hidden /> : null}
      <span>{rank.name}</span>
    </span>
  );
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
          className={cn('relative h-full overflow-hidden rounded-full transition-[width] duration-700 ease-out', barStyles[rank.tier])}
          style={{ width: `${percent}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer-sweep pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
