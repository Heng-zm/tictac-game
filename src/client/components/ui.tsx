import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Info,
  Loader2,
  Minus,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/cn';
import type { ToastMessage } from '../hooks/use-game-client';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/30 border border-white/10',
  secondary:
    'border border-line/80 bg-surface/85 text-ink hover:bg-elevated hover:border-line backdrop-blur-sm shadow-sm',
  ghost: 'text-muted hover:bg-elevated hover:text-ink',
  danger:
    'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-md shadow-danger/20 hover:shadow-lg hover:shadow-danger/30 border border-white/10',
  success:
    'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 border border-white/10',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-9 rounded-xl px-3 text-xs font-semibold',
  md: 'h-10 rounded-xl px-4 text-sm font-semibold',
  lg: 'h-12 rounded-2xl px-5 text-sm font-bold tracking-wide',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 font-semibold transition duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-app',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {children}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  tone?: 'default' | 'danger';
}

export function IconButton({ label, children, className, tone = 'default', type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'group inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line/80 bg-surface/85 backdrop-blur-sm transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 shadow-sm [&>svg]:transition-transform [&>svg]:duration-200 group-hover:[&>svg]:scale-115 group-active:[&>svg]:scale-90',
        tone === 'danger'
          ? 'text-danger hover:bg-danger/10 hover:border-danger/30'
          : 'text-muted hover:bg-elevated hover:text-ink hover:border-line',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ className, interactive, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'panel rounded-2xl transition-[transform,opacity,border-color,background-color,box-shadow] duration-200',
        interactive && 'hover:border-accent/40 hover:shadow-soft active:scale-[0.99] cursor-pointer',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col space-y-1.5 p-4 sm:p-5', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-base sm:text-lg font-bold leading-none tracking-tight text-ink', className)} {...rest}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-xs sm:text-sm text-muted leading-relaxed', className)} {...rest}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-4 pt-0 sm:p-5 sm:pt-0', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center p-4 pt-0 sm:p-5 sm:pt-0', className)} {...rest}>
      {children}
    </div>
  );
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'solid' | 'subtle' | 'outline' | 'dot';
  tone?: 'default' | 'accent' | 'success' | 'danger' | 'warning' | 'purple';
  size?: 'sm' | 'md';
  children: ReactNode;
}

export function Badge({
  variant = 'subtle',
  tone = 'default',
  size = 'md',
  className,
  children,
  ...rest
}: BadgeProps) {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  }[size];

  const toneStyles: Record<NonNullable<BadgeProps['tone']>, Record<NonNullable<BadgeProps['variant']>, string>> = {
    default: {
      solid: 'bg-elevated text-ink border-line',
      subtle: 'bg-elevated/70 text-ink/80 border-line/60',
      outline: 'bg-transparent text-ink border-line',
      dot: 'bg-elevated/70 text-ink/80 border-line/60',
    },
    accent: {
      solid: 'bg-accent text-accent-ink border-transparent shadow-sm shadow-accent/25',
      subtle: 'bg-accent/10 text-accent border-accent/25',
      outline: 'bg-transparent text-accent border-accent/40',
      dot: 'bg-accent/10 text-accent border-accent/25',
    },
    success: {
      solid: 'bg-success text-white border-transparent shadow-sm shadow-success/25',
      subtle: 'bg-success/10 text-success border-success/25',
      outline: 'bg-transparent text-success border-success/40',
      dot: 'bg-success/10 text-success border-success/25',
    },
    danger: {
      solid: 'bg-danger text-white border-transparent shadow-sm shadow-danger/25',
      subtle: 'bg-danger/10 text-danger border-danger/25',
      outline: 'bg-transparent text-danger border-danger/40',
      dot: 'bg-danger/10 text-danger border-danger/25',
    },
    warning: {
      solid: 'bg-amber-500 text-white border-transparent shadow-sm shadow-amber-500/25',
      subtle: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
      outline: 'bg-transparent text-amber-600 dark:text-amber-400 border-amber-500/40',
      dot: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
    },
    purple: {
      solid: 'bg-purple-600 text-white border-transparent shadow-sm shadow-purple-600/25',
      subtle: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25',
      outline: 'bg-transparent text-purple-600 dark:text-purple-400 border-purple-500/40',
      dot: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25',
    },
  };

  const dotColor: Record<NonNullable<BadgeProps['tone']>, string> = {
    default: 'bg-muted',
    accent: 'bg-accent',
    success: 'bg-success',
    danger: 'bg-danger',
    warning: 'bg-amber-500',
    purple: 'bg-purple-500',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full border font-semibold select-none backdrop-blur-xs transition-colors',
        sizeStyles,
        toneStyles[tone][variant],
        className,
      )}
      {...rest}
    >
      {variant === 'dot' ? (
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColor[tone])} aria-hidden />
      ) : null}
      {children}
    </span>
  );
}

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'purple';
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
}

export function Progress({
  value,
  max = 100,
  tone = 'accent',
  size = 'sm',
  showLabel = false,
  className,
  ...rest
}: ProgressProps) {
  const percent = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  const sizeStyles = {
    xs: 'h-1',
    sm: 'h-2',
    md: 'h-3',
  }[size];

  const toneGradients = {
    accent: 'bg-gradient-to-r from-blue-600 to-indigo-500 shadow-[0_0_10px_rgba(37,99,235,0.4)]',
    success: 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]',
    warning: 'bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_10px_rgba(245,158,11,0.4)]',
    danger: 'bg-gradient-to-r from-red-500 to-rose-400 shadow-[0_0_10px_rgba(239,68,68,0.4)]',
    purple: 'bg-gradient-to-r from-purple-600 to-pink-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]',
  }[tone];

  return (
    <div className={cn('w-full', className)} {...rest}>
      {showLabel ? (
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-muted">
          <span>Progress</span>
          <span className="tabular-nums text-ink">{percent}%</span>
        </div>
      ) : null}
      <div
        className={cn(
          'w-full overflow-hidden rounded-full border border-line/40 bg-elevated/80 p-0.5',
          sizeStyles,
        )}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-300 ease-out', toneGradients)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  clearable?: boolean;
  onClear?: () => void;
}

export function Input({
  label,
  error,
  hint,
  icon: Icon,
  action,
  clearable = false,
  onClear,
  value,
  id,
  className,
  disabled,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hasValue = value !== undefined && value !== '' && String(value).length > 0;

  return (
    <div className="w-full text-left">
      {label ? (
        <label htmlFor={inputId} className="mb-1.5 block text-xs font-semibold text-ink">
          {label}
        </label>
      ) : null}
      <div className="relative flex items-center">
        {Icon ? (
          <span className="pointer-events-none absolute left-3.5 flex items-center text-muted">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
        <input
          id={inputId}
          value={value}
          disabled={disabled}
          className={cn(
            'w-full rounded-xl border bg-elevated/60 px-3.5 py-2.5 text-sm text-ink placeholder:text-muted backdrop-blur-xs transition duration-150 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
            Icon && 'pl-10',
            (clearable && hasValue) || action ? 'pr-11' : '',
            error
              ? 'border-danger/60 focus:border-danger focus:ring-danger/20'
              : 'border-line/80 hover:border-line focus:border-accent focus:ring-accent/20',
            className,
          )}
          {...rest}
        />
        <div className="absolute right-2.5 flex items-center gap-1">
          {clearable && hasValue && onClear && !disabled ? (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear input"
              className="flex h-6 w-6 items-center justify-center rounded-lg text-muted transition hover:bg-elevated hover:text-ink active:scale-95"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
          {action}
        </div>
      </div>
      {error ? (
        <p className="mt-1 text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Avatar({
  name,
  photoUrl,
  size = 'md',
  className,
  ring = false,
  status,
}: {
  name: string;
  photoUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  ring?: boolean;
  status?: 'online' | 'offline' | 'busy' | 'away';
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photoUrl]);
  const dimensions = {
    xs: 'h-7 w-7 text-[10px]',
    sm: 'h-9 w-9 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-14 w-14 text-lg',
    xl: 'h-20 w-20 text-2xl',
  }[size];
  const initial = (name.trim()[0] ?? '?').toUpperCase();

  const statusDotSize = {
    xs: 'h-2 w-2 ring-1',
    sm: 'h-2.5 w-2.5 ring-1.5',
    md: 'h-3 w-3 ring-2',
    lg: 'h-3.5 w-3.5 ring-2',
    xl: 'h-4 w-4 ring-2',
  }[size];

  const statusColors = {
    online: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]',
    offline: 'bg-muted shadow-none',
    busy: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]',
    away: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]',
  };

  const avatarContent = (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-accent/15 to-accent/5 font-bold text-accent shadow-inner',
        dimensions,
        ring && 'ring-2 ring-accent/40 ring-offset-2 ring-offset-app shadow-glow-sm',
        className,
      )}
      aria-hidden={photoUrl ? undefined : true}
    >
      {photoUrl && !failed ? (
        <img
          src={photoUrl}
          alt=""
          className="h-full w-full object-cover select-none"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </span>
  );

  if (!status) return avatarContent;

  return (
    <span className="relative inline-flex shrink-0">
      {avatarContent}
      <span
        className={cn(
          'absolute bottom-0 right-0 rounded-full ring-surface transition-transform duration-200',
          statusDotSize,
          statusColors[status],
        )}
        aria-label={`Status: ${status}`}
        title={`Status: ${status}`}
      />
    </span>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % options.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + options.length) % options.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = options.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      const nextOption = options[nextIndex];
      if (nextOption) {
        onChange(nextOption.value);
        window.requestAnimationFrame(() => {
          const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
          buttons?.[nextIndex]?.focus();
        });
      }
    }
  };

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('grid gap-1 rounded-2xl border border-line/80 bg-elevated/70 p-1 backdrop-blur-sm', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'rounded-xl px-2.5 py-2 text-center text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
              selected
                ? 'bg-surface text-ink shadow-sm ring-1 ring-line font-bold'
                : 'text-muted hover:text-ink hover:bg-surface/40',
            )}
          >
            <span className="block">{option.label}</span>
            {option.hint ? (
              <span className={cn('mt-0.5 block text-[10px] font-medium', selected ? 'opacity-90 text-accent font-semibold' : 'opacity-60')}>
                {option.hint}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-10 shrink-0 rounded-full border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:opacity-50',
        checked ? 'border-accent bg-accent shadow-[0_0_12px_rgba(37,99,235,0.35)]' : 'border-line bg-elevated',
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200',
          checked ? 'left-[21px]' : 'left-[3px]',
        )}
      />
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-accent', className)} aria-label="Loading" />;
}

export function Logo({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const box = {
    sm: 'h-8 w-8 rounded-lg',
    md: 'h-11 w-11 rounded-xl',
    lg: 'h-16 w-16 rounded-2xl shadow-lg',
  }[size];

  return (
    <img
      src="/icons/icon-192.png"
      alt="Tic Tac Toe Logo"
      width={size === 'lg' ? 64 : size === 'sm' ? 32 : 44}
      height={size === 'lg' ? 64 : size === 'sm' ? 32 : 44}
      className={cn(
        'shrink-0 object-cover shadow-sm ring-1 ring-white/10 transition-transform duration-200 hover:scale-105 active:scale-95 select-none',
        box,
        className,
      )}
    />
  );
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  action,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="flex items-start justify-between gap-3 pb-4 pt-1 sm:pb-5">
      <div className="flex min-w-0 items-center gap-3">
        {onBack ? (
          <IconButton label="Go back" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </IconButton>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{eyebrow}</p>
          ) : null}
          <h1 className="truncate text-2xl font-bold tracking-tight text-ink">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm leading-snug text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

const toastStyles = {
  info: { icon: Info, className: 'text-accent' },
  success: { icon: CheckCircle2, className: 'text-success' },
  warning: { icon: AlertTriangle, className: 'text-amber-500' },
  error: { icon: XCircle, className: 'text-danger' },
} as const;

export function ToastViewport({
  toasts,
  onDismiss,
  raised = false,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
  raised?: boolean;
}) {
  if (toasts.length === 0) return null;
  return createPortal(
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 px-3',
        raised
          ? 'pb-[calc(env(safe-area-inset-bottom)+164px)]'
          : 'pb-[calc(env(safe-area-inset-bottom)+88px)]',
      )}
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => {
        const style = toastStyles[toast.type];
        const Icon = style.icon;
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-line bg-surface/95 p-3.5 text-left shadow-soft backdrop-blur-md animate-fade-up"
          >
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', style.className)} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{toast.title}</p>
              {toast.message ? <p className="mt-0.5 text-xs leading-relaxed text-muted">{toast.message}</p> : null}
            </div>
            <button
              type="button"
              className="rounded-full p-2 text-muted transition hover:bg-app hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              onClick={() => onDismiss(toast.id)}
              aria-label={`Dismiss ${toast.title}`}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}

export function Modal({
  open,
  onClose,
  title,
  ariaLabel,
  children,
  dismissible = true,
  showClose = true,
  className,
}: {
  open: boolean;
  onClose?: () => void;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
  dismissible?: boolean;
  showClose?: boolean;
  className?: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const previous = previousFocusRef.current;
      if (previous && previous !== document.body && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
      previousFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, dismissible]);

  if (!open) return null;

  const hasCustomOverflow = className?.includes('overflow-');
  const hasCustomPadding = className?.includes('p-0');

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="presentation">
        <div
          className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm"
          onClick={dismissible ? onClose : undefined}
          aria-hidden
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-label={!title ? ariaLabel : undefined}
          className={cn(
            'relative max-h-[90dvh] w-full max-w-md rounded-t-3xl border border-line/80 bg-surface shadow-2xl backdrop-blur-2xl animate-fade-up sm:max-w-lg sm:rounded-3xl',
            !hasCustomOverflow && 'overflow-y-auto no-scrollbar',
            !hasCustomPadding && 'p-5 sm:p-6 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:pb-6',
            className,
          )}
        >
          {dismissible && showClose ? (
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line/80 sm:hidden" aria-hidden />
          ) : null}
          {dismissible && showClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3.5 top-3.5 rounded-full p-2 text-muted transition hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          {title ? (
            <h2 id={titleId} className="pr-8 text-lg font-bold tracking-tight text-ink sm:text-xl">
              {title}
            </h2>
          ) : null}
          {children}
        </div>
      </div>,
    document.body,
  );
}

export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  accent = false,
  trend,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  accent?: boolean;
  trend?: { value: string | number; direction: 'up' | 'down' | 'neutral' };
}) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border p-3.5 transition-all duration-200',
        accent
          ? 'border-accent/35 bg-accent/5 shadow-sm hover:border-accent/50'
          : 'border-line/80 bg-elevated/50 hover:bg-elevated/70 hover:border-line',
      )}
    >
      <div className="flex items-center justify-between gap-1 text-muted">
        <div className="flex items-center gap-1.5 min-w-0">
          {Icon ? (
            <Icon
              className={cn(
                'h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:scale-110',
                accent ? 'text-accent' : 'group-hover:text-ink',
              )}
              aria-hidden
            />
          ) : null}
          <span className="truncate text-[10px] font-bold uppercase tracking-[0.08em]">{label}</span>
        </div>
        {trend ? (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.2 text-[9px] font-bold',
              trend.direction === 'up'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : trend.direction === 'down'
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  : 'bg-elevated text-muted',
            )}
          >
            {trend.direction === 'up' ? (
              <ArrowUpRight className="h-2.5 w-2.5" aria-hidden />
            ) : trend.direction === 'down' ? (
              <ArrowDownRight className="h-2.5 w-2.5" aria-hidden />
            ) : (
              <Minus className="h-2.5 w-2.5" aria-hidden />
            )}
            {trend.value}
          </span>
        ) : null}
      </div>
      <p className={cn('mt-1.5 text-xl font-extrabold tabular-nums tracking-tight sm:text-2xl', accent ? 'text-accent' : 'text-ink')}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[10px] font-medium text-muted">{hint}</p> : null}
    </div>
  );
}

export function Pill({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'warning';
  className?: string;
}) {
  const tones = {
    neutral: 'border-line/80 bg-elevated/80 text-muted',
    accent: 'border-accent/30 bg-accent/10 text-accent font-semibold',
    success: 'border-success/30 bg-success/10 text-success font-semibold',
    danger: 'border-danger/30 bg-danger/10 text-danger font-semibold',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide backdrop-blur-xs transition-colors',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-5 py-8 text-center sm:px-6 sm:py-10">
      <span className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl border border-line/80 bg-elevated/70 text-muted shadow-sm transition-transform duration-200 hover:scale-105">
        <Icon className="h-6 w-6 text-muted" aria-hidden />
      </span>
      <p className="text-sm font-bold text-ink">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-line/60', className)} />;
}
