import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
      <div className="flex min-h-[var(--app-vh)] flex-col items-center justify-center px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-danger/20 bg-danger/5 text-danger">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-ink">The board hit a snag</h1>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
          Something unexpected happened while drawing the interface. Your games are stored on the server.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Reload the app
        </button>
      </div>
    );
  }
}
