import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/layout/ErrorBoundary';
import './index.css';
import {LangProvider} from './i18n/LangContext';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <LangProvider>
      <App />
    </LangProvider>
  </ErrorBoundary>
);
