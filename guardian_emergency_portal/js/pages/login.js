import { authenticateOperator } from '../auth.js';

let intervalId;

export function init() {
  const syncSecondsEl = document.getElementById('auth-sync-seconds');
  const loginBtn = document.getElementById('auth-login-btn');
  
  if (syncSecondsEl) {
    let seconds = 15;
    intervalId = setInterval(() => {
      seconds = seconds > 0 ? seconds - 1 : 30;
      if (syncSecondsEl) {
        syncSecondsEl.textContent = seconds;
      } else {
        clearInterval(intervalId); // Cleanup if element is gone
      }
    }, 1000);
  }

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const terminalId = document.getElementById('auth-terminal-id').value;
      const accessPhrase = document.getElementById('auth-access-phrase').value;
      
      const totpInputs = document.querySelectorAll('#auth-totp-inputs input');
      const totp = Array.from(totpInputs).map(i => i.value).join('');

      const result = await authenticateOperator(terminalId, accessPhrase, totp);
      if (result.success) {
        clearInterval(intervalId);
        window.router.navigate('/dashboard');
      } else {
        window.showToast('Error', result.error || 'Authentication failed', 'error');
      }
    });
  }
}
