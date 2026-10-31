import { ApiService } from './api.js';
import { showToast } from './notifications.js';

let sirenInterval = null;
let sirenMuted = false;
let dismissedAlertIds = new Set();
let activeModalCaseId = null;
let knownCaseIds = new Set();
let hasInitialized = false;

// Synthesize police alarm siren using Web Audio API
function playPoliceSirenTone() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth';
    const now = ctx.currentTime;
    
    // Urgent dual-tone warbling police siren effect
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.linearRampToValueAtTime(1050, now + 0.35);
    osc.frequency.linearRampToValueAtTime(650, now + 0.7);
    osc.frequency.linearRampToValueAtTime(1050, now + 1.05);
    osc.frequency.linearRampToValueAtTime(650, now + 1.4);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 1.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.5);
  } catch (e) {
    // AudioContext requires user interaction on first visit
  }
}

function startPoliceSirenLoop() {
  if (sirenMuted) return;
  stopPoliceSirenLoop();
  playPoliceSirenTone();
  sirenInterval = setInterval(() => {
    if (!sirenMuted) playPoliceSirenTone();
  }, 1600);
}

function stopPoliceSirenLoop() {
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }
}

export function showPoliceEmergencyModal(c) {
  const modalEl = document.getElementById('police-emergency-alert-modal');
  if (!modalEl || !c) return;

  activeModalCaseId = c.id;
  modalEl.style.display = 'flex';

  const caseIdEl = document.getElementById('pam-case-id');
  const wardNameEl = document.getElementById('pam-ward-name');
  const reasonEl = document.getElementById('pam-reason');
  const locEl = document.getElementById('pam-location');
  const bioEl = document.getElementById('pam-biometrics');
  const phoneEl = document.getElementById('pam-phone');

  if (caseIdEl) caseIdEl.textContent = `CASE #${c.id}`;
  if (wardNameEl) wardNameEl.textContent = `${c.name || 'Protected Ward'} (Ward in Distress)`;
  if (reasonEl) reasonEl.textContent = c.escalationReason || 'Guardian did not respond within 5-minute response window (300s timeout). Autonomous municipal emergency protocol triggered.';
  if (locEl) locEl.textContent = c.location || 'Sector 4 Metro, Main Rd (±8m GPS accuracy)';
  if (bioEl) bioEl.textContent = `${c.bpm || 148} BPM — High Risk (${c.score || 89}/100)`;
  if (phoneEl) phoneEl.textContent = c.userPhone || '+91 98765 43210';

  if (window.lucide) window.lucide.createIcons();

  // Wire action buttons
  const btnDispatch = document.getElementById('pam-btn-dispatch');
  const btnAck = document.getElementById('pam-btn-ack');
  const btnMute = document.getElementById('pam-btn-mute');
  const btnDismiss = document.getElementById('pam-btn-dismiss');

  if (btnDispatch) {
    btnDispatch.onclick = async () => {
      btnDispatch.disabled = true;
      btnDispatch.textContent = 'DISPATCHING UNIT 01...';
      await appState.dispatchUnit(c.id, 'Unit 01 (Intercept Patrol)');
      closePoliceEmergencyModal();
      if (window.router) window.router.navigate('/response');
    };
  }

  if (btnAck) {
    btnAck.onclick = async () => {
      btnAck.disabled = true;
      btnAck.textContent = 'ACKNOWLEDGING...';
      await appState.acknowledgeCase(c.id);
      closePoliceEmergencyModal();
      if (window.router) window.router.navigate('/incoming');
    };
  }

  if (btnMute) {
    btnMute.onclick = () => {
      sirenMuted = true;
      stopPoliceSirenLoop();
      btnMute.innerHTML = '<i data-lucide="volume-2" style="width:14px;height:14px;vertical-align:middle;"></i> Siren Muted';
      if (window.lucide) window.lucide.createIcons();
    };
  }

  if (btnDismiss) {
    btnDismiss.onclick = () => {
      dismissedAlertIds.add(c.id);
      closePoliceEmergencyModal();
    };
  }

  startPoliceSirenLoop();
}

export function closePoliceEmergencyModal() {
  const modalEl = document.getElementById('police-emergency-alert-modal');
  if (modalEl) modalEl.style.display = 'none';
  stopPoliceSirenLoop();
}

export const appState = {
  cases: [],
  units: [],
  loading: true,
  listeners: [],
  
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  },
  
  notify() {
    this.listeners.forEach(cb => {
      try { cb(); } catch (e) { console.error('Listener callback error:', e); }
    });
  },

  async refreshData(silent = false) {
    try {
      if (!silent) {
        this.loading = true;
        this.notify();
      }
      
      const [fetchedCases, fetchedUnits] = await Promise.all([
        ApiService.getActiveCases(),
        ApiService.getUnits()
      ]);

      this.cases = fetchedCases || [];
      this.units = fetchedUnits || [];

      // Check for urgent escalated emergency requiring police attention
      const escalatedCase = (this.cases || []).find(c => 
        (c.rawStatus === 'ESCALATED_POLICE' || (c.status === 'Incoming' && c.rawStatus !== 'RESOLVED' && c.rawStatus !== 'GUARDIAN_RESPONDED')) &&
        !dismissedAlertIds.has(c.id)
      );

      if (escalatedCase) {
        showPoliceEmergencyModal(escalatedCase);
        if (!knownCaseIds.has(escalatedCase.id)) {
          showToast(
            '🚨 NEW EMERGENCY ESCALATION',
            `Case #${escalatedCase.id} (${escalatedCase.name}) - Guardian 5-min timeout expired! Municipal protocol active.`,
            'error'
          );
        }
      } else {
        // If current active modal case is resolved or acknowledged, close it
        if (activeModalCaseId) {
          const mCase = (this.cases || []).find(c => c.id === activeModalCaseId);
          if (!mCase || mCase.rawStatus === 'RESOLVED' || mCase.rawStatus === 'DISPATCHED' || mCase.rawStatus === 'POLICE_ACKNOWLEDGED') {
            closePoliceEmergencyModal();
            activeModalCaseId = null;
          }
        }
      }

      // Update known case IDs
      this.cases.forEach(c => knownCaseIds.add(c.id));
      hasInitialized = true;
    } catch (error) {
      if (!silent) showToast('Error', 'Failed to fetch emergency data', 'error');
    } finally {
      this.loading = false;
      this.notify();
    }
  },

  async acknowledgeCase(id) {
    try {
      await ApiService.acknowledgeCase(id);
      showToast('Case Acknowledged', `Case ${id} is now active on EOC desk.`, 'success');
      await this.refreshData(true);
    } catch (error) {
      showToast('Error', 'Failed to acknowledge case.', 'error');
    }
  },

  async dispatchUnit(caseId, unitId) {
    try {
      await ApiService.dispatchUnit(caseId, unitId);
      showToast('Unit Dispatched', `${unitId} dispatched to incident ${caseId}. Sirens engaged.`, 'success');
      await this.refreshData(true);
    } catch (error) {
      showToast('Error', 'Failed to dispatch unit.', 'error');
    }
  },

  async resolveCase(id) {
    try {
      await ApiService.resolveCase(id);
      showToast('Case Resolved', `Case ${id} has been resolved and logged in archive.`, 'success');
      await this.refreshData(true);
    } catch (error) {
      showToast('Error', 'Failed to resolve case.', 'error');
    }
  },

  getCaseById(id) {
    return this.cases.find(c => c.id === id || c.caseId === id);
  }
};

// Socket.IO Real-Time Event Listener
try {
  if (typeof window.io !== 'undefined' || typeof io !== 'undefined') {
    const socketFunc = window.io || io;
    const socket = socketFunc();
    socket.on('emergency:new', () => appState.refreshData(true));
    socket.on('emergency:update', () => appState.refreshData(true));
    socket.on('telemetry:update', () => appState.refreshData(true));
  }
} catch (e) {}

// Fast auto-refresh interval (1.5 seconds) for real-time live synchronization
setInterval(() => {
  appState.refreshData(true);
}, 1500);

// Cross-tab real-time event listener
try {
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('guardian_ai_sync');
    channel.onmessage = (evt) => {
      const { type } = evt.data || {};
      if (['SOS_TRIGGERED', 'SOS_ESCALATED_POLICE', 'SOS_GUARDIAN_RESPONDED', 'POLICE_ACKNOWLEDGED', 'POLICE_DISPATCHED', 'POLICE_RESOLVED'].includes(type)) {
        appState.refreshData(true);
      }
    };
  }
} catch (e) {}

window.addEventListener('storage', (e) => {
  if (e.key === 'guardian_ai_event') {
    appState.refreshData(true);
  }
});

window.appState = appState;
window.showPoliceEmergencyModal = showPoliceEmergencyModal;
window.closePoliceEmergencyModal = closePoliceEmergencyModal;
