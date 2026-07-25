import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// 注册轻量 Service Worker（离线应用外壳）。仅在生产构建下生效，
// 避免开发服务器的 HMR 资源被缓存导致更新不生效。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* 离线支持为可选增强，注册失败不影响正常使用 */
    });
  });
}
