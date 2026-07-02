// App-level error boundary so a render error or a failed lazy-chunk load shows a
// recoverable message instead of a blank white screen.
import { Component, ErrorInfo, ReactNode } from 'react';

interface State { error: Error | null }

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('UI error boundary caught:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-screen w-screen flex items-center justify-center p-6"
        style={{ background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
        <div className="max-w-md text-center rounded-2xl p-8"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-lg font-bold mb-1">Something went wrong</h1>
          <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
            {this.state.error.message || 'An unexpected error occurred.'}
          </p>
          <button onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
