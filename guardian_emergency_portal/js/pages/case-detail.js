import { appState } from '../state.js';

export function init(params) {
  const caseId = params?.id || 'GA-1024';
  
  function renderCaseDetails() {
    const c = appState.getCaseById(caseId) || {
      id: caseId,
      name: 'Emily Johnson',
      reason: 'Impact Detection (High Velocity)',
      escalationReason: 'Guardian did not respond within 5-minute (300s) response window. Autonomous municipal failover engaged.',
      location: 'Rajahmundry Main Rd (±8m GPS accuracy)',
      severity: 'Critical',
      score: 87,
      bpm: 154,
      userPhone: '+91 98765 43210',
      guardianName: 'David Johnson (Father)'
    };

    const titleEl = document.getElementById('cd-title');
    if (titleEl) titleEl.textContent = `CASE #${c.id} — ${(c.name || 'WARD').toUpperCase()}`;

    document.querySelectorAll('.profile-name').forEach(el => el.textContent = c.name || 'Emily Johnson');
    document.querySelectorAll('.case-description').forEach(el => el.textContent = c.escalationReason || c.reason);
    
    const guardianNameEl = document.querySelector('.guardian-name');
    if (guardianNameEl) guardianNameEl.textContent = `${c.guardianName || 'David Johnson (Father)'}`;

    const btnAck = document.getElementById('cd-btn-ack');
    if (btnAck) {
      if (c.rawStatus === 'POLICE_ACKNOWLEDGED' || c.rawStatus === 'DISPATCHED') {
        btnAck.innerHTML = '<i data-lucide="check" style="width: 16px; height: 16px;"></i> ACKNOWLEDGED';
        btnAck.style.background = '#059669';
        btnAck.style.color = '#ffffff';
      }
    }

    if (window.lucide) window.lucide.createIcons();
  }

  appState.subscribe(renderCaseDetails);
  renderCaseDetails();

  const btnAck = document.getElementById('cd-btn-ack');
  const btnDispatch = document.getElementById('cd-btn-dispatch');
  const btnResolve = document.getElementById('cd-btn-resolve');

  const btnTacAck = document.getElementById('cd-tactical-ack');
  const btnTacDispatch = document.getElementById('cd-tactical-dispatch');
  const btnTacResolve = document.getElementById('cd-tactical-resolve');

  const handleAcknowledge = async () => {
    await appState.acknowledgeCase(caseId);
  };

  const handleDispatch = async () => {
    await appState.dispatchUnit(caseId, 'Unit 01 (Intercept Patrol)');
    if (window.router) window.router.navigate('/response');
  };

  const handleResolve = async () => {
    await appState.resolveCase(caseId);
    if (window.router) window.router.navigate('/dashboard');
  };

  if(btnAck) btnAck.addEventListener('click', handleAcknowledge);
  if(btnTacAck) btnTacAck.addEventListener('click', handleAcknowledge);
  
  if(btnDispatch) btnDispatch.addEventListener('click', handleDispatch);
  if(btnTacDispatch) btnTacDispatch.addEventListener('click', handleDispatch);

  if(btnResolve) btnResolve.addEventListener('click', handleResolve);
  if(btnTacResolve) btnTacResolve.addEventListener('click', handleResolve);
}
