import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './index.css';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CLERK_KEY) {
  const root = document.getElementById('root');
  root.innerHTML = '<div style="padding: 2rem; font-family: sans-serif;"><p><strong>Missing env:</strong> Add <code>VITE_CLERK_PUBLISHABLE_KEY</code> to your <code>.env</code> (same value as <code>CLERK_PUBLISHABLE_KEY</code>).</p><p>Then restart the dev server (<code>npm run dev</code>).</p></div>';
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <ClerkProvider publishableKey={CLERK_KEY}>
      <App />
    </ClerkProvider>
  );
}
