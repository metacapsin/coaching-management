import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/layout/ErrorBoundary';
import './index.css';

try {
  localStorage.removeItem('academiaos.lang'); // the Hindi / English choice of an earlier version
} catch {
  /* no storage: nothing to forget */
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
