import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log("%c RPG DEMONS DESPAIR - V4.2 LOADED ", "background: #10b981; color: #000; font-weight: bold; padding: 4px; border-radius: 4px;");

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
