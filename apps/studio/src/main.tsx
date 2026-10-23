import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StudioApp } from './StudioApp.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('Missing root element');
createRoot(root).render(
  <StrictMode>
    <StudioApp />
  </StrictMode>,
);
