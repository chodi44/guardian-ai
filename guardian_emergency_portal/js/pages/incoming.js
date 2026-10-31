import { appState } from '../state.js';

export function init() {
  function renderIncoming() {
    const currentCase = 
      (appState.cases || []).find(c => c.rawStatus === 'ESCALATED_POLICE') ||
      (appState.cases || []).find(c => c.status === 'Incoming' && c.rawStatus !== 'RESOLVED') ||
      (appState.cases || []).find(c => c.severity === 'Critical' && c.rawStatus !== 'RESOLVED') ||
      (appState.cases || [])[0] || 
      { id: 'GA-1024', name: 'Emily Johnson' };

    const caseId = currentCase.id || 'GA-1024';

    const titleEl = document.getElementById('inc-case-title') || document.querySelector('.case-title');
    if (titleEl) {
      titleEl.textContent = `NEW EMERGENCY CASE: #${caseId} — ${(currentCase.name || 'WARD').toUpperCase()}`;
    }

    const badgeEl = document.getElementById('inc-threat-badge');
    if (badgeEl) {
      badgeEl.innerHTML = `<span class="dot dot-error mr-1"></span> CRITICAL (${currentCase.score || 89}/100)`;
    }

    const wardNameEl = document.getElementById('inc-ward-name');
    if (wardNameEl) {
      wardNameEl.innerHTML = `${currentCase.name || 'Protected Ward'} <span class="font-normal text-secondary text-sm">Ward</span>`;
    }

    const wardMetaEl = document.getElementById('inc-ward-meta');
    if (wardMetaEl) {
      wardMetaEl.textContent = `Emergency Contact: ${currentCase.userPhone || '+91 98765 43210'} • GPS Live Tracking Active`;
    }

    const guardianNameEl = document.getElementById('inc-guardian-name');
    if (guardianNameEl) {
      guardianNameEl.innerHTML = `<i data-lucide="phone-off" style="width: 16px; height: 16px;"></i> Primary Guardian: ${currentCase.guardianName || 'UNRESPONSIVE'} (5-Min Window Expired)`;
    }

    const guardianInfoEl = document.getElementById('inc-guardian-info');
    if (guardianInfoEl) {
      guardianInfoEl.innerHTML = `Guardian did not respond within 5-minute (300s) timeout. Autonomous municipal failover engaged at ${currentCase.time || 'now'}.`;
    }

    const heartRateEl = document.getElementById('inc-heart-rate');
    if (heartRateEl) {
      heartRateEl.innerHTML = `${currentCase.bpm || 148} <span class="stat-unit">BPM</span>`;
    }

    const threatScoreEl = document.getElementById('inc-threat-score');
    if (threatScoreEl) {
      threatScoreEl.textContent = `${currentCase.score || 89} / 100 — CRITICAL LIFE SAFETY`;
    }

    const locAddrEl = document.getElementById('inc-location-address');
    if (locAddrEl && currentCase.location) {
      locAddrEl.textContent = currentCase.location;
    }

    const locCoordsEl = document.getElementById('inc-location-coords');
    if (locCoordsEl && currentCase.coords) {
      locCoordsEl.innerHTML = `Coordinates: ${currentCase.coords.lat?.toFixed(4) || '17.3850'}° N, ${currentCase.coords.lng?.toFixed(4) || '78.4866'}° E &nbsp; GPS Accuracy: <span class="text-secondary font-semibold">±8m</span>`;
    }

    const justTextEl = document.getElementById('inc-justification-text');
    if (justTextEl) {
      justTextEl.innerHTML = `"Guardian did not acknowledge, dismiss, or respond to emergency request within the configured 5-minute (300s) response window. Telemetry confirmed sustained distress (${currentCase.score || 89}/100); Guardian AI automatically escalated incident #${caseId} to Police Emergency Operations Command."`;
    }

    const btnAck = document.getElementById('btn-ack-incoming');
    const btnDispatch = document.getElementById('btn-dispatch') || document.querySelector('.btn-primary-solid');
    const btnOpenFull = document.getElementById('btn-open-full-case') || document.querySelector('.header-actions button:nth-child(2)');

    if (btnAck) {
      if (currentCase.rawStatus === 'POLICE_ACKNOWLEDGED' || currentCase.rawStatus === 'DISPATCHED') {
        btnAck.innerHTML = '<i data-lucide="check" style="width: 16px; height: 16px;"></i> CASE ACKNOWLEDGED (ACTIVE)';
        btnAck.style.background = '#059669';
      } else {
        btnAck.onclick = async () => {
          btnAck.disabled = true;
          btnAck.innerHTML = '<i data-lucide="loader" style="width: 16px; height: 16px;"></i> ACKNOWLEDGING...';
          if (window.lucide) window.lucide.createIcons();

          await appState.acknowledgeCase(caseId);

          btnAck.innerHTML = '<i data-lucide="check" style="width: 16px; height: 16px;"></i> CASE ACKNOWLEDGED (ACTIVE)';
          btnAck.style.background = '#059669';
          if (window.lucide) window.lucide.createIcons();
        };
      }
    }

    if (btnOpenFull) {
      btnOpenFull.onclick = () => {
        if (window.router) window.router.navigate(`/case/${caseId}`);
      };
    }

    if (btnDispatch) {
      btnDispatch.onclick = async () => {
        btnDispatch.disabled = true;
        btnDispatch.textContent = 'DISPATCHING UNIT 01...';
        await appState.dispatchUnit(caseId, 'Unit 01 (Intercept Patrol)');
        if (window.router) window.router.navigate('/response');
      };
    }

    if (window.lucide) window.lucide.createIcons();
  }

  appState.subscribe(renderIncoming);
  renderIncoming();
}
