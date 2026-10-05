import React from 'react';
import { createRoot } from 'react-dom/client';
const prototype = new URLSearchParams(window.location.search).get('prototype');
const application = prototype === 'recommendations'
  ? import('./recommendations-prototype/App.jsx')
  : prototype === 'flow'
  ? import('./flow-prototype/App.jsx')
  : prototype === 'journeys'
  ? import('./journey-prototype/App.jsx')
  : import('./App.jsx');

application.then(({ App }) => createRoot(document.getElementById('root')).render(<App/>));
