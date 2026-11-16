import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // The app has no client-side telemetry by design; keep diagnostics local.
    console.error('Unhandled render error', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-[var(--app-vh)] items-center justify-center p-4 text-center sm:p-6">
        <div className="w-full max-w-md rounded-3xl border border-line/80 bg-surface/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8 animate-fade-up">
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-danger/30 bg-danger/10 text-danger shadow-[0_0_20px_rgba(239,68,68,0.25)]">
            <span className="pointer-events-none absolute -inset-1.5 rounded-2xl border border-danger/30 animate-pulse-ring" aria-hidden />
            <AlertTriangle className="h-8 w-8 animate-bounce-subtle" aria-hidden />
          </div>

          <h1 className="mt-5 text-xl font-bold tracking-tight text-ink sm:text-2xl">The board hit a snag</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">
            Something unexpected happened while drawing the interface. Your games are stored on the server.
          </p>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 text-sm font-bold text-white shadow-md shadow-accent/25 transition-all duration-150 hover:from-blue-500 hover:to-indigo-500 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
            >
              <RefreshCw className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180" aria-hidden />
              Reload the app
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#/';
                window.location.reload();
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-elevated/70 px-4 text-sm font-semibold text-ink transition-all duration-150 hover:bg-elevated active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <Home className="h-4 w-4 text-muted" aria-hidden />
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
