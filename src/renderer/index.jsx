import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';  // 🔄 Se till att 'App.jsx' finns i samma mapp

import './styles/globals.css';

const container = document.getElementById('root');

if (!container) {
  console.error("❌ Root-elementet kunde inte hittas! Kontrollera 'index.html'");
} else {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

