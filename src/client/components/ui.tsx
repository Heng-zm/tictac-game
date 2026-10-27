import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Info,
  Loader2,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/cn';
import type { ToastMessage } from '../hooks/use-game-client';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:opacity-90',
  secondary: 'border border-line bg-surface text-ink hover:bg-elevated',
  ghost: 'text-muted hover:bg-elevated hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90',
  success: 'bg-success text-[#04140b] hover:opacity-90',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-9 rounded-xl px-3 text-sm',
  md: 'h-10 rounded-xl px-4 text-sm',
  lg: 'h-11 rounded-xl px-5 text-[15px]',
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
        'inline-flex select-none items-center justify-center gap-2 font-semibold transition duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-app',
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
        'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70',
        tone === 'danger'
          ? 'text-danger hover:bg-danger/5'
          : 'text-muted hover:bg-elevated hover:text-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('panel rounded-2xl', className)} {...rest}>
      {children}
    </div>
  );
}

export function Avatar({
  name,
  photoUrl,
  size = 'md',
  className,
  ring = false,
}: {
  name: string;
  photoUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  ring?: boolean;
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

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/10 font-semibold text-accent',
        dimensions,
        ring && 'ring-2 ring-accent/30 ring-offset-2 ring-offset-app',
        className,
      )}
      aria-hidden={photoUrl ? undefined : true}
    >
      {photoUrl && !failed ? (
        <img
          src={photoUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initial}</span>
      )}
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
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('grid gap-1 rounded-xl border border-line bg-elevated p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-lg px-2 py-2 text-center text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
              selected ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink',
            )}
          >
            <span className="block">{option.label}</span>
            {option.hint ? (
              <span className={cn('mt-0.5 block text-[10px] font-medium', selected ? 'opacity-80' : 'opacity-60')}>
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
        'relative h-6 w-10 shrink-0 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:opacity-50',
        checked ? 'border-accent bg-accent' : 'border-line bg-elevated',
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition-all',
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

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="presentation">
        <div
          className="absolute inset-0 animate-fade-in bg-black/55 backdrop-blur-[2px]"
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
            'relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 shadow-soft animate-fade-up sm:max-w-lg sm:rounded-3xl sm:p-6',
            'pb-[calc(env(safe-area-inset-bottom)+20px)] sm:pb-6',
            className,
          )}
        >
          {dismissible && showClose ? (
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
          ) : null}
          {dismissible && showClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 rounded-full p-2 text-muted transition hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
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
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        accent ? 'border-accent/20 bg-accent/5' : 'border-line bg-elevated/60',
      )}
    >
      <div className="flex items-center gap-1.5 text-muted">
        {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">{label}</span>
      </div>
      <p className={cn('mt-1 text-lg font-bold tabular-nums sm:text-xl', accent ? 'text-accent' : 'text-ink')}>{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-muted">{hint}</p> : null}
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
    neutral: 'border-line bg-elevated text-muted',
    accent: 'border-accent/30 bg-accent/10 text-accent',
    success: 'border-success/30 bg-success/10 text-success',
    danger: 'border-danger/30 bg-danger/10 text-danger',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide',
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
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-elevated text-muted">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-line/60', className)} />;
}
