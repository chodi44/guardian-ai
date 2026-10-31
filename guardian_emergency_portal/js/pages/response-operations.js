import { appState } from '../state.js';

export function init() {
  const activeCase = (appState.cases || []).find(c => c.rawStatus === 'DISPATCHED' || c.rawStatus === 'ESCALATED_POLICE' || c.rawStatus === 'POLICE_ACKNOWLEDGED') || (appState.cases || [])[0];
  const targetId = activeCase ? activeCase.id : 'GA-1024';

  const btnResolve = document.getElementById('btn-ro-resolve');
  if (btnResolve) {
    btnResolve.addEventListener('click', async () => {
      btnResolve.disabled = true;
      btnResolve.textContent = 'RESOLVING...';
      await appState.resolveCase(targetId);
      if (window.router) window.router.navigate('/dashboard');
    });
  }
}
