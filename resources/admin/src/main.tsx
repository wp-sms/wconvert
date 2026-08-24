import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const mount = document.getElementById('wconvert-admin');

// The bundle is enqueued only on WConvert's own screen, so a missing mount node
// means the screen changed and this was left behind. Do nothing rather than
// throw into a wp-admin page that is otherwise fine.
if (mount) {
  createRoot(mount).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
