/**
 * GUARDIAN AI — COMMON GLOBAL CONTROLLER
 * Handles shared UI elements, Toast Notifications, Modal Drawers, and Map Configs.
 */

// Shared Leaflet Map Tile Constants
const mapTileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const mapAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const centerLat = 17.0005;
const centerLng = 81.8040;

// Global Toast Engine
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  if (type === 'danger') toast.style.background = '#dc2626';

  const icon = type === 'danger' 
    ? '<i class="fa-solid fa-triangle-exclamation"></i>' 
    : '<i class="fa-solid fa-circle-info text-primary"></i>';
  toast.innerHTML = `${icon} <span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Global ECG Canvas Drawer Helper
function drawECG(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width = canvas.width = canvas.parentElement.clientWidth || 300;
  let height = canvas.height = canvas.parentElement.clientHeight || 40;

  let x = 0;
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;

  function animate() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, 0, width, height);

    ctx.beginPath();
    ctx.moveTo(x, height / 2);
    
    let nextY = height / 2;
    let step = (x % 60);

    if (step > 25 && step < 30) nextY = height / 2 - 15;
    else if (step >= 30 && step < 35) nextY = height / 2 + 18;
    else if (step >= 35 && step < 40) nextY = height / 2 - 8;

    ctx.lineTo(x + 2, nextY);
    ctx.stroke();

    x = (x + 2) % width;
    requestAnimationFrame(animate);
  }

  animate();
}

document.addEventListener('DOMContentLoaded', () => {

  // --- 1. DYNAMIC MOBILE NAVIGATION & ACTIVE STATES ---
  const currentPath = window.location.pathname.toLowerCase();
  
  function initMobileNavigation() {
    // Only inject if it's a dashboard page (has a sidebar)
    if (!document.getElementById('main-sidebar')) return;

    // Create Bottom Nav
    const bottomNav = document.createElement('nav');
    bottomNav.className = 'mobile-bottom-nav';
    bottomNav.setAttribute('aria-label', 'Mobile navigation');
    bottomNav.innerHTML = `
      <a href="home.html" class="mobile-nav-item" data-view="home">
        <i class="fa-solid fa-house"></i><span>Home</span>
      </a>
      <a href="location.html" class="mobile-nav-item" data-view="live-location">
        <i class="fa-solid fa-location-arrow"></i><span>Location</span>
      </a>
      <a href="journeys.html" class="mobile-nav-item" data-view="journeys">
        <i class="fa-solid fa-route"></i><span>Journeys</span>
      </a>
      <a href="voice-mails.html" class="mobile-nav-item" data-view="voice-mails">
        <i class="fa-solid fa-microphone"></i><span>Voice Mails</span>
      </a>
      <button class="mobile-nav-item" id="mobile-more-button" aria-expanded="false" aria-controls="mobile-more-sheet">
        <i class="fa-solid fa-ellipsis"></i><span>More</span>
      </button>
    `;

    // Create More Sheet
    const moreSheetOverlay = document.createElement('div');
    moreSheetOverlay.className = 'mobile-more-sheet-overlay';
    
    const moreSheet = document.createElement('div');
    moreSheet.className = 'mobile-more-sheet';
    moreSheet.id = 'mobile-more-sheet';
    moreSheet.innerHTML = `
      <div class="more-sheet-header">
        <h3>More</h3>
        <button id="close-more-sheet" aria-label="Close menu">&times;</button>
      </div>
      <div class="more-sheet-content">
        <a href="insights.html" class="more-sheet-item" data-view="insights"><i class="fa-solid fa-chart-line"></i> Insights</a>
        <a href="band.html" class="more-sheet-item" data-view="band"><i class="fa-solid fa-stopwatch"></i> Guardian Band</a>
        <a href="profile.html" class="more-sheet-item" data-view="profile"><i class="fa-solid fa-user"></i> Profile</a>
        <a href="settings.html" class="more-sheet-item" data-view="settings"><i class="fa-solid fa-gear"></i> Settings</a>
        <div class="more-sheet-divider"></div>
        <a href="sos-alert.html" class="more-sheet-item text-danger fw-700" data-view="sos-alert"><i class="fa-solid fa-triangle-exclamation"></i> SOS Alert Simulator</a>
      </div>
    `;

    document.body.appendChild(bottomNav);
    document.body.appendChild(moreSheetOverlay);
    document.body.appendChild(moreSheet);

    // Toggle Logic
    const moreBtn = document.getElementById('mobile-more-button');
    const closeBtn = document.getElementById('close-more-sheet');

    function openMoreSheet() {
      moreSheetOverlay.classList.add('active');
      moreSheet.classList.add('active');
      moreBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    function closeMoreSheet() {
      moreSheetOverlay.classList.remove('active');
      moreSheet.classList.remove('active');
      moreBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    moreBtn.addEventListener('click', openMoreSheet);
    closeBtn.addEventListener('click', closeMoreSheet);
    moreSheetOverlay.addEventListener('click', closeMoreSheet);

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && moreSheet.classList.contains('active')) {
        closeMoreSheet();
      }
    });

    // Close when clicking a link inside the sheet
    moreSheet.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMoreSheet);
    });
  }

  initMobileNavigation();

  // Handle Active States (Desktop & Mobile)
  const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-item, .more-sheet-item');
  const isSecondaryPage = ['insights.html', 'band.html', 'profile.html', 'settings.html', 'sos-alert.html'].some(page => currentPath.endsWith(page));

  navLinks.forEach(link => {
    link.classList.remove('active');
    const href = link.getAttribute('href');
    if (href && (currentPath.endsWith('/' + href.toLowerCase()) || currentPath.endsWith(href.toLowerCase()))) {
      link.classList.add('active');
    }
  });

  // If on a secondary page, highlight the "More" button in mobile nav
  if (isSecondaryPage) {
    const moreBtn = document.getElementById('mobile-more-button');
    if (moreBtn) moreBtn.classList.add('active');
  }

  // Active Bell State for Alerts Page
  if (currentPath.endsWith('alerts.html')) {
    const notificationBells = document.querySelectorAll('.notification-icon-wrapper');
    notificationBells.forEach(bell => bell.classList.add('active-bell'));
  }

  // --- 2. VOICE CALL MODAL CONTROLS ---
  const modalVoiceCall = document.getElementById('modal-voice-call');
  const callStatusLabel = document.getElementById('call-status-label');
  const callTimer = document.getElementById('call-timer');
  let callTimerInterval = null;

  function launchVoiceCall() {
    if (!modalVoiceCall) return;
    modalVoiceCall.classList.add('active-modal');
    if (callStatusLabel) callStatusLabel.textContent = 'Connecting Encrypted Voice Handshake...';
    let sec = 0;
    
    callTimerInterval = setInterval(() => {
      sec++;
      const m = String(Math.floor(sec / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      if (callTimer) callTimer.textContent = `${m}:${s}`;
      if (sec === 2 && callStatusLabel) callStatusLabel.textContent = '● Live Encrypted Voice Stream (AES-256)';
    }, 1000);
  }

  function closeVoiceCall() {
    if (!modalVoiceCall) return;
    modalVoiceCall.classList.remove('active-modal');
    if (callTimerInterval) clearInterval(callTimerInterval);
  }

  document.getElementById('btn-voice-link-trigger')?.addEventListener('click', launchVoiceCall);
  document.getElementById('btn-call-ananya-live')?.addEventListener('click', launchVoiceCall);
  document.getElementById('btn-direct-call-sos')?.addEventListener('click', launchVoiceCall);
  document.getElementById('btn-call-ananya-journey')?.addEventListener('click', launchVoiceCall);

  document.getElementById('btn-close-call-modal')?.addEventListener('click', closeVoiceCall);
  document.getElementById('btn-hangup-call')?.addEventListener('click', () => {
    closeVoiceCall();
    showToast('Voice Link call ended.');
  });

  // --- 3. AUDIT LOG DRAWER CONTROLS ---
  const modalAuditDrawer = document.getElementById('modal-audit-drawer');
  const auditBodyContent = document.getElementById('audit-body-content');

  document.querySelectorAll('.btn-open-audit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id') || 'ALT-8921';
      const badgeElem = document.getElementById('audit-badge-id');
      if (badgeElem) badgeElem.textContent = id;
      if (auditBodyContent) {
        auditBodyContent.innerHTML = `
          <div style="font-size:13px;line-height:1.6;color:#334155;">
            <h4 style="font-size:15px;color:#0f172a;margin-bottom:8px;">Forensic Audit Summary for ${id}</h4>
            <p><strong>Timestamp:</strong> 2026-09-18 18:54:22 UTC</p>
            <p><strong>Device ID:</strong> Guardian Band V3 (#GB-V3-982)</p>
            <p><strong>Cellular Beacon:</strong> Airtel 5G Ultra (Tower #42-RJY)</p>
            <p><strong>Biometric Pulse Delta:</strong> Baseline 78 BPM, Peak 84 BPM (No distress detected)</p>
            <p><strong>Acoustic Decibel Sample:</strong> 42 dB (Conversational, Zero scream/distress signatures)</p>
            <hr style="margin:14px 0;border:0;border-top:1px solid #e2e8f0;">
            <h5 style="color:#0f172a;margin-bottom:6px;">Sentinel Resolution Log:</h5>
            <p>System cross-referenced user location with public pedestrian arcade. Auto-resolution satisfied within 90-second SLA timeout.</p>
          </div>
        `;
      }
      if (modalAuditDrawer) modalAuditDrawer.classList.add('active-modal');
    });
  });

  document.getElementById('btn-close-audit')?.addEventListener('click', () => {
    if (modalAuditDrawer) modalAuditDrawer.classList.remove('active-modal');
  });

  // --- 4. AUDIO TRIAGE PLAYER SIMULATOR ---
  let isPlayingAudio = false;
  document.getElementById('btn-toggle-triage-audio')?.addEventListener('click', function() {
    isPlayingAudio = !isPlayingAudio;
    this.innerHTML = isPlayingAudio ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
    showToast(isPlayingAudio ? '🔊 Playing encrypted acoustic triage snippet loop' : 'Audio snippet paused');
  });

  // --- 5. SHARED TOAST TRIGGERS ---
  document.getElementById('btn-silent-checkin')?.addEventListener('click', () => showToast('Ping sent: Silent check-in delivered to Guardian Band.'));
  document.getElementById('btn-send-safety-ping-live')?.addEventListener('click', () => showToast('Ping sent: Ananya notified on band.'));
  document.getElementById('btn-buzz-ping')?.addEventListener('click', () => showToast('Haptic gentle buzz ping delivered to band!'));
  document.getElementById('btn-test-handshake')?.addEventListener('click', () => showToast('Connection Handshake: 42ms round-trip latency verified.'));
  document.getElementById('btn-query-band-hardware')?.addEventListener('click', () => showToast('Band Query: All hardware subsystems 100% nominal.'));
  document.getElementById('btn-run-self-test')?.addEventListener('click', () => showToast('Self-Test: All 5 sensor self-tests PASSED!'));
  document.getElementById('btn-export-forensic-log')?.addEventListener('click', () => showToast('Forensic log exported (CSV/PDF)'));
  document.getElementById('btn-export-dossier')?.addEventListener('click', () => showToast('Safety Insights Dossier exported'));
  document.getElementById('btn-download-audit-log')?.addEventListener('click', () => showToast('Cryptographic Audit Log downloaded'));
  document.getElementById('btn-call-112')?.addEventListener('click', () => showToast('🚨 EMERGENCY CALL DISPATCHED TO 112 CONTROL ROOM!', 'danger'));

  // --- 6. REAL-TIME TIMER TICKER ---
  const syncTimerSpan = document.getElementById('sync-timer-sec');
  if (syncTimerSpan) {
    let count = 10;
    setInterval(() => {
      count = (count % 15) + 1;
      syncTimerSpan.textContent = count;
    }, 1000);
  }
});

