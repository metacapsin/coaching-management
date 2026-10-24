import React from 'react';
import { GraduationCap, Loader2, WifiOff } from 'lucide-react';

interface ConnectionScreenProps {
  // Shown when the server could not be reached
  error?: string | null;
  onRetry?: () => void;
  message?: string;
}

// Full-page screen while the app connects to the server (or when it cannot)
export const ConnectionScreen: React.FC<ConnectionScreenProps> = ({ error, onRetry, message = 'Connecting to the server...' }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-slate-900 font-sans antialiased">
    <div className="max-w-sm w-full text-center">
      <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-sm">
        <GraduationCap className="w-7 h-7" />
      </div>

      {error ? (
        <>
          <div className="mt-6 flex items-center justify-center gap-2 text-rose-600">
            <WifiOff className="w-5 h-5" />
            <h1 className="text-lg font-semibold">Cannot reach the server</h1>
          </div>
          <p className="text-sm text-slate-500 mt-2">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-5 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Try again
            </button>
          )}
        </>
      ) : (
        <p className="mt-6 text-sm text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {message}
        </p>
      )}
    </div>
  </div>
);
