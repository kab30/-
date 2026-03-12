import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for PWA and automatic updates
registerSW({
  onNeedRefresh() {
    if (confirm('يتوفر تحديث جديد للموقع، هل تريد التحديث الآن؟')) {
      window.location.reload();
    }
  },
  onOfflineReady() {
    console.log('الموقع جاهز للعمل بدون إنترنت');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
