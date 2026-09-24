import React from 'react';
import { createRoot } from 'react-dom/client';
const application = new URLSearchParams(window.location.search).get('prototype') === 'journeys'
  ? import('./journey-prototype/App.jsx')
  : import('./App.jsx');

application.then(({ App }) => createRoot(document.getElementById('root')).render(<App/>));
