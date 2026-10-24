import React from 'react';

interface State {
  error: Error | null;
}

// Shows a clear message instead of a blank white page when a screen crashes.
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Screen crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-slate-900">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl shadow-xs p-8 text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-slate-500 mt-2">
            This screen could not be displayed. Your saved data is safe. Reload the page to continue.
          </p>
          <pre className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-left text-[11px] text-rose-700 whitespace-pre-wrap break-words">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
