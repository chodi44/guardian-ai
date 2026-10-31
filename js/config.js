/**
 * 🛡️ Guardian AI — Dynamic Frontend API & Socket.IO Environment Config
 * Resolves API & Socket URLs dynamically for independent site deployments.
 */
(function () {
  const envApiUrl = window.GUARDIAN_API_URL || (typeof process !== 'undefined' && process.env && process.env.VITE_API_URL) || '';
  const currentOrigin = window.location.origin;

  // Fallback: If deployed on standalone static host, read GUARDIAN_API_URL or default to window.location.origin
  const apiBase = envApiUrl || (currentOrigin.includes('localhost') ? 'http://localhost:8000' : currentOrigin);

  window.GUARDIAN_CONFIG = {
    API_BASE_URL: apiBase.replace(/\/$/, ''),
    SOCKET_URL: apiBase.replace(/\/$/, ''),
    getApiUrl: function (path) {
      const cleanPath = path.startsWith('/') ? path : '/' + path;
      return this.API_BASE_URL + cleanPath;
    }
  };

  console.log('🛡️ [Guardian Config] Active API Base URL:', window.GUARDIAN_CONFIG.API_BASE_URL);
})();
