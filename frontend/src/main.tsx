import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/components.css';
import '@/styles/layout.css';
import App from '@/App';

async function loadPolyfills() {
  if (typeof Temporal === 'undefined') {
    await import('temporal-polyfill/global');
  }
  if (!Object.hasOwn(HTMLElement.prototype, 'popover')) {
    await import('@oddbird/popover-polyfill');
  }
}

loadPolyfills().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
