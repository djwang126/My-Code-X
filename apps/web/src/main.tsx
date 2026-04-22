import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './app';
import { registerPwaServiceWorker } from './pwa/register-service-worker';

registerPwaServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
