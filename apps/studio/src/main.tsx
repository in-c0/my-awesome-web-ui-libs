import '@in-c0/paper-ui/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DeviceLab } from './DeviceLab.tsx';
import { StudioApp } from './StudioApp.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('Missing root element');

const isDeviceLab = new URLSearchParams(window.location.search).has('device-lab');
createRoot(root).render(
  <StrictMode>
    {isDeviceLab ? <DeviceLab /> : <StudioApp />}
  </StrictMode>,
);
