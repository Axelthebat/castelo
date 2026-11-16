import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import '@fontsource-variable/space-grotesk';
import './styles/app.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Elemento #root nao encontrado no index.html.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
