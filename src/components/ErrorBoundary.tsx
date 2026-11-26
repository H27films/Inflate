import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let displayMessage = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(displayMessage) as { error?: string; operationType?: string };
      if (parsed && typeof parsed.error === 'string') {
        displayMessage = parsed.operationType
          ? `Sync error (${parsed.operationType}): ${parsed.error}`
          : parsed.error;
      }
    } catch {
      // Non-JSON error message
    }
    return { hasError: true, message: displayMessage };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh bg-[#F3F4F2] text-[#111315] flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white rounded-3xl border border-black/8 p-6 shadow-[0_8px_30px_rgba(17,19,21,0.06)] space-y-4">
            <div className="space-y-1">
              <p className="font-brand text-xs tracking-[0.35em] uppercase text-[#5E646A]">
                INFLATE
              </p>
              <h1 className="font-display text-xl font-semibold text-[#111315]">
                Something went wrong
              </h1>
            </div>
            <p className="text-xs text-[#5E646A] leading-relaxed break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full h-11 rounded-2xl bg-[#111315] text-white text-xs font-semibold hover:bg-black/85 transition-colors cursor-pointer"
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
