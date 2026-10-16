import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({ immediate: true });
  } catch (err) {
    console.warn("PWA SW registration skipped:", err);
  }
}

console.log("%c RPG DEMONS DESPAIR - V5.0 (v1.14.20) LOADED ", "background: #10b981; color: #000; font-weight: bold; padding: 4px; border-radius: 4px;");

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
