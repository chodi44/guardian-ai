import { appState } from '../state.js';

let elapsedInterval = null;

export function init() {
  const btnOpenCritical = document.getElementById('btn-open-critical-case');
  
  function updateDashboard() {
    // 1. Look for escalated emergency case first (highest priority)
    const criticalCase = 
      (appState.cases || []).find(c => c.rawStatus === 'ESCALATED_POLICE') ||
      (appState.cases || []).find(c => c.status === 'Incoming' && c.rawStatus !== 'RESOLVED') ||
      (appState.cases || []).find(c => c.severity === 'Critical' && c.rawStatus !== 'RESOLVED') ||
      (appState.cases || [])[0];
    
    if (criticalCase) {
      const caseIdDisplay = document.getElementById('dashboard-critical-id');
      const caseNameDisplay = document.getElementById('dashboard-critical-name');
      const btnCaseIdDisplay = document.getElementById('dashboard-btn-case-id');
      const locDisplay = document.getElementById('dashboard-critical-loc');
      const scoreDisplay = document.getElementById('dashboard-critical-score');
      const reasonDisplay = document.getElementById('dashboard-escalation-reason');
      
      if (caseIdDisplay) caseIdDisplay.textContent = `CASE #${criticalCase.id}`;
      if (caseNameDisplay) caseNameDisplay.textContent = criticalCase.name;
      if (btnCaseIdDisplay) btnCaseIdDisplay.textContent = criticalCase.id;
      if (locDisplay && criticalCase.location) locDisplay.textContent = criticalCase.location;
      if (scoreDisplay) scoreDisplay.textContent = `${criticalCase.score || 89} / 100 — CRITICAL`;
      if (reasonDisplay) {
        reasonDisplay.innerHTML = `<strong>Escalation Reason:</strong> ${criticalCase.escalationReason || 'Guardian did not respond within 5-minute (300s) response window.'}<br/>Autonomous municipal emergency protocol triggered. Live EOC dispatch desk alert active.`;
      }

      if (btnOpenCritical) {
        btnOpenCritical.onclick = () => {
          if (window.router) window.router.navigate('/incoming');
        };
      }

      // Elapsed stopwatch
      clearInterval(elapsedInterval);
      const elapsedEl = document.getElementById('dashboard-critical-elapsed');
      const startMs = criticalCase.escalatedAt ? new Date(criticalCase.escalatedAt).getTime() : Date.now() - 25000;
      
      function updateElapsed() {
        if (!elapsedEl) return;
        const diffSec = Math.floor(Math.max(0, (Date.now() - startMs) / 1000));
        const mins = Math.floor(diffSec / 60);
        const secs = diffSec % 60;
        elapsedEl.textContent = `${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
      }
      updateElapsed();
      elapsedInterval = setInterval(updateElapsed, 1000);
    }

    // 2. Update Stats Counter
    const activeCount = (appState.cases || []).filter(c => c.rawStatus !== 'RESOLVED').length;
    const critCount = (appState.cases || []).filter(c => (c.severity === 'Critical' || c.rawStatus === 'ESCALATED_POLICE') && c.rawStatus !== 'RESOLVED').length;

    const statActive = document.getElementById('stat-active-cases');
    const statCrit = document.getElementById('stat-critical-cases');
    const queueCountEl = document.getElementById('dashboard-queue-count');

    if (statActive) statActive.textContent = activeCount.toString().padStart(2, '0');
    if (statCrit) statCrit.textContent = critCount.toString().padStart(2, '0');
    if (queueCountEl) queueCountEl.textContent = `${activeCount} Live`;

    // 3. Render Dynamic Queue Cards
    renderQueueCards(appState.cases || []);
  }

  function renderQueueCards(cases) {
    const container = document.getElementById('dashboard-queue-list');
    if (!container) return;

    if (!cases || cases.length === 0) {
      container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-secondary);">No active emergency cases in queue.</div>';
      return;
    }

    container.innerHTML = cases.map(c => {
      const isEscalated = c.rawStatus === 'ESCALATED_POLICE';
      const isCritical = c.severity === 'Critical' || isEscalated;
      const isDispatched = c.rawStatus === 'DISPATCHED' || c.status === 'In Transit';
      const isAcknowledged = c.rawStatus === 'POLICE_ACKNOWLEDGED' || c.status === 'Active';
      const isResolved = c.rawStatus === 'RESOLVED';

      const cardClass = isEscalated ? 'queue-card critical' : (isCritical ? 'queue-card critical' : 'queue-card');
      const dotColor = isEscalated || isCritical ? '#EF4444' : (isDispatched ? '#3B82F6' : '#10B981');
      
      let badgeHtml = '<span class="badge badge-error-solid">CRITICAL PRIORITY</span>';
      if (isEscalated) {
        badgeHtml = '<span class="badge badge-error-solid" style="background: #ef4444; color: #fff; animation: pulse 1.5s infinite;">🚨 1-MIN TIMEOUT ESCALATED</span>';
      } else if (isDispatched) {
        badgeHtml = '<span class="badge badge-blue-solid">UNIT DISPATCHED</span>';
      } else if (isAcknowledged) {
        badgeHtml = '<span class="badge badge-primary-solid">POLICE ACKNOWLEDGED</span>';
      } else if (isResolved) {
        badgeHtml = '<span class="badge badge-success-solid">RESOLVED</span>';
      }

      let statusLine = '';
      if (isEscalated) {
        statusLine = `
          <div class="guardian-status" style="background: rgba(239,68,68,0.1); border-left: 3px solid #ef4444; padding: 6px 10px; border-radius: 4px; display: flex; align-items: center; gap: 6px; margin: 8px 0;">
            <i data-lucide="alert-circle" class="text-error" style="width: 14px; height: 14px;"></i>
            <span class="text-error font-semibold text-xs">Guardian unresponsive: Autonomous failover engaged</span>
          </div>`;
      } else if (isDispatched) {
        statusLine = `
          <div class="guardian-status" style="background: rgba(59,130,246,0.1); border-left: 3px solid #3b82f6; padding: 6px 10px; border-radius: 4px; display: flex; align-items: center; gap: 6px; margin: 8px 0;">
            <i data-lucide="truck" class="text-primary" style="width: 14px; height: 14px;"></i>
            <span class="text-primary font-semibold text-xs">${c.assignedUnit || 'Unit 01'} en route (ETA: 2m 10s)</span>
          </div>`;
      } else if (isAcknowledged) {
        statusLine = `
          <div class="guardian-status" style="background: rgba(16,185,129,0.1); border-left: 3px solid #10b981; padding: 6px 10px; border-radius: 4px; display: flex; align-items: center; gap: 6px; margin: 8px 0;">
            <i data-lucide="check" class="text-success" style="width: 14px; height: 14px;"></i>
            <span class="text-success font-semibold text-xs">Officer Acknowledged • Case Active on Console</span>
          </div>`;
      }

      return `
        <div class="${cardClass}" style="${isEscalated ? 'border: 2px solid #ef4444; box-shadow: 0 0 15px rgba(239,68,68,0.2);' : ''}">
          <div class="queue-card-header">
            <div class="case-id">
              <div class="dot" style="background-color: ${dotColor};"></div>
              <span class="font-semibold">#${c.id}</span>
              ${badgeHtml}
            </div>
            <div class="threat-matrix">
              <div class="threat-label">AI RISK MATRIX</div>
              <div class="threat-score text-error">${c.score || 89} <span class="score-total">/ 100</span></div>
            </div>
          </div>

          ${statusLine}

          <div class="subject-details">
            <div class="subject-col">
              <div class="detail-label">PROTECTED PERSON</div>
              <div class="font-semibold">${c.name} <span class="badge-gray-outline">Ward</span></div>
              <div class="detail-sub text-secondary">Contact: ${c.userPhone || '+91 98765 43210'}</div>
            </div>
            <div class="subject-col">
              <div class="detail-label">INCIDENT REASON</div>
              <div class="font-semibold text-error" style="font-size: 13px;">${c.reason || 'SOS Distress'}</div>
              <div class="detail-sub text-secondary flex items-center gap-1">
                <i data-lucide="map-pin" style="width: 12px; height: 12px;"></i> ${c.location || 'Sector 4 Metro, Main Rd'}
              </div>
            </div>
          </div>

          <div class="telemetry-badges">
            <div class="telemetry-badge error">
              <i data-lucide="activity" class="text-error" style="width: 14px; height: 14px;"></i> 
              <div class="flex-col"><span class="label">Heart Rhythm</span><span class="value">${c.bpm || 148} BPM</span></div>
            </div>
            <div class="telemetry-badge">
              <i data-lucide="clock" class="text-secondary" style="width: 14px; height: 14px;"></i> 
              <div class="flex-col"><span class="label">Time Reported</span><span class="value">${c.time || 'Live'}</span></div>
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-light, #e2e8f0); flex-wrap: wrap;">
            ${!isDispatched && !isResolved ? `
              <button class="btn-queue-action" data-action="dispatch" data-case="${c.id}" style="background: #ef4444; color: #fff; border: none; padding: 7px 14px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                <i data-lucide="siren" style="width: 13px; height: 13px;"></i> Dispatch Unit 01
              </button>
            ` : ''}
            ${!isAcknowledged && !isDispatched && !isResolved ? `
              <button class="btn-queue-action" data-action="ack" data-case="${c.id}" style="background: #0284c7; color: #fff; border: none; padding: 7px 14px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                <i data-lucide="check" style="width: 13px; height: 13px;"></i> Acknowledge
              </button>
            ` : ''}
            <button class="btn-queue-action" data-action="open" data-case="${c.id}" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 7px 14px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 5px; margin-left: auto;">
              <i data-lucide="external-link" style="width: 13px; height: 13px;"></i> View Ingress Dossier
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    // Attach click listeners to card buttons
    container.querySelectorAll('.btn-queue-action').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const cid = btn.getAttribute('data-case');

        if (action === 'dispatch') {
          btn.disabled = true;
          btn.textContent = 'Dispatching...';
          await appState.dispatchUnit(cid, 'Unit 01 (Intercept Patrol)');
          if (window.router) window.router.navigate('/response');
        } else if (action === 'ack') {
          btn.disabled = true;
          btn.textContent = 'Acknowledging...';
          await appState.acknowledgeCase(cid);
        } else if (action === 'open') {
          if (window.router) window.router.navigate('/incoming');
        }
      };
    });
  }

  appState.subscribe(updateDashboard);
  updateDashboard();
}
