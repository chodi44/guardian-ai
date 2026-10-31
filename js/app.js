/**
 * GUARDIAN AI — COMPLETE APPLICATION CONTROLLER & LOGIC
 * Manages SPA Routing, Interactive Leaflet Maps, Chart.js Visualizations,
 * Audio Triage Simulators, Modal Drawers, and Toast Notifications.
 */

document.addEventListener('DOMContentLoaded', () => {

  // --- 1. SPA ROUTER & NAVIGATION SYSTEM ---
  const views = document.querySelectorAll('.app-view');
  const navLinks = document.querySelectorAll('.nav-link');
  const breadcrumbTitle = document.getElementById('breadcrumb-title');
  const mainSidebar = document.getElementById('main-sidebar');
  const topHeader = document.getElementById('top-header');

  const routeBreadcrumbs = {
    'welcome': 'Welcome & Onboarding',
    'onboarding-step1': 'Profile Setup (Step 1)',
    'onboarding-step2': 'Link Protected Person (Step 2)',
    'home': 'Monitoring Console',
    'live-location': 'Real-Time GeoNAV',
    'sos-alert': '🚨 CRITICAL SOS ALERT',
    'journeys': 'Transit Corridor & Journey Log',
    'alerts': 'Alerts & Incident Registry',
    'insights': 'Safety Insights & Telemetry',
    'band': 'Guardian Band Wearable Suite',
    'profile': 'Guardian Profile Management',
    'settings': 'Configuration & Privacy'
  };

  function switchView(targetViewId) {
    if (!targetViewId) targetViewId = 'home';
    
    // Normalize hash (strip #)
    targetViewId = targetViewId.replace('#', '');

    // Hide sidebar on Welcome/Onboarding pages if needed
    if (targetViewId === 'welcome' || targetViewId === 'onboarding-step1' || targetViewId === 'onboarding-step2') {
      mainSidebar.style.display = 'none';
      topHeader.style.display = 'none';
      document.querySelector('.main-wrapper').style.marginLeft = '0';
    } else {
      mainSidebar.style.display = 'flex';
      topHeader.style.display = 'flex';
      document.querySelector('.main-wrapper').style.marginLeft = '240px';
    }

    // Deactivate all views
    views.forEach(view => {
      view.classList.remove('active-view');
    });

    // Activate target view
    const targetElement = document.getElementById(`view-${targetViewId}`);
    if (targetElement) {
      targetElement.classList.add('active-view');
      window.scrollTo(0, 0);
    } else {
      // Fallback to home
      document.getElementById('view-home').classList.add('active-view');
      targetViewId = 'home';
    }

    // Update active nav link in sidebar
    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('data-view') === targetViewId) {
        link.classList.add('active');
      }
    });

    // Update breadcrumb text
    if (breadcrumbTitle && routeBreadcrumbs[targetViewId]) {
      breadcrumbTitle.textContent = routeBreadcrumbs[targetViewId];
    }

    // Trigger map invalidation for Leaflet maps if visible
    setTimeout(() => {
      if (targetViewId === 'home' && maps.homeMap) maps.homeMap.invalidateSize();
      if (targetViewId === 'live-location' && maps.liveMap) maps.liveMap.invalidateSize();
      if (targetViewId === 'sos-alert' && maps.sosMap) maps.sosMap.invalidateSize();
      if (targetViewId === 'journeys' && maps.journeyMap) maps.journeyMap.invalidateSize();
      if (targetViewId === 'insights' && maps.topologyMap) maps.topologyMap.invalidateSize();
    }, 200);
  }

  // Handle hash change & initial load
  window.addEventListener('hashchange', () => {
    switchView(window.location.hash);
  });

  // Handle click on nav triggers
  document.querySelectorAll('.nav-trigger-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = link.getAttribute('data-target');
      if (target) {
        window.location.hash = `#${target}`;
      }
    });
  });

  // Onboarding Navigation Buttons
  document.getElementById('btn-start-onboarding')?.addEventListener('click', () => { window.location.hash = '#onboarding-step1'; });
  document.getElementById('btn-back-to-welcome')?.addEventListener('click', () => { window.location.hash = '#welcome'; });
  document.getElementById('btn-goto-step2')?.addEventListener('click', () => { window.location.hash = '#onboarding-step2'; });
  document.getElementById('btn-launch-dashboard')?.addEventListener('click', () => { window.location.hash = '#home'; showToast('Guardian Profile successfully provisioned!'); });

  // SOS Emergency Mode Simulator Button
  document.getElementById('btn-trigger-sos-mode')?.addEventListener('click', () => {
    window.location.hash = '#sos-alert';
    showToast('⚠️ CRITICAL SOS ALERT SIMULATION TRIGGERED!', 'danger');
  });

  document.getElementById('btn-trigger-escort-alert-hero')?.addEventListener('click', () => {
    window.location.hash = '#sos-alert';
    showToast('⚠️ Escort alert escalated to emergency dispatch!', 'danger');
  });

  // --- 2. LEAFLET MAPS INITIALIZATION ---
  const maps = {};

  // Custom Map Tile (OpenStreetMap for clean vector appearance without watermarks)
  const mapTileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const mapAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  // Rajahmundry Coordinates
  const centerLat = 17.0005;
  const centerLng = 81.8040;

  // Initialize Home Map
  try {
    maps.homeMap = L.map('home-map', { zoomControl: false }).setView([centerLat, centerLng], 14);
    L.tileLayer(mapTileUrl, { attribution: mapAttribution, maxZoom: 19 }).addTo(maps.homeMap);

    // Geofence Circle (1.5 km)
    L.circle([centerLat, centerLng], {
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.12,
      radius: 1500,
      weight: 2,
      dashArray: '6, 6'
    }).addTo(maps.homeMap);

    // Ananya Location Pulse Marker
    const pulsingIcon = L.divIcon({
      className: 'custom-pulse-marker',
      html: `<div style="width:16px;height:16px;background:#2563eb;border:3px solid #ffffff;border-radius:50%;box-shadow:0 0 10px rgba(37,99,235,0.8)"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    L.marker([centerLat, centerLng], { icon: pulsingIcon })
      .addTo(maps.homeMap)
      .bindPopup('<b>Ananya</b><br>Inside Safe Geofence').openPopup();

  } catch (err) {
    console.log('Home map init:', err);
  }

  // Initialize Live Location Map
  try {
    maps.liveMap = L.map('live-location-map', { zoomControl: false }).setView([centerLat, centerLng], 14);
    L.tileLayer(mapTileUrl, { attribution: mapAttribution, maxZoom: 19 }).addTo(maps.liveMap);

    // Route Polyline
    const routeCoords = [
      [17.0150, 81.7900], // Campus
      [17.0080, 81.7980], // Safe Haven 1
      [17.0005, 81.8040], // Ananya Current Location
      [16.9920, 81.8120]  // Home
    ];

    L.polyline(routeCoords, { color: '#2563eb', weight: 5, opacity: 0.85, lineCap: 'round' }).addTo(maps.liveMap);

    // Current Position Marker
    L.marker([centerLat, centerLng]).addTo(maps.liveMap).bindPopup('Ananya • 4.2 km/h (Route #4)');
  } catch (err) {
    console.log('Live map init:', err);
  }

  // Initialize SOS Tactical Map
  try {
    const sosLat = 16.9890;
    const sosLng = 81.7840;

    maps.sosMap = L.map('sos-tactical-map', { zoomControl: false }).setView([sosLat, sosLng], 15);
    L.tileLayer(mapTileUrl, { attribution: mapAttribution, maxZoom: 19 }).addTo(maps.sosMap);

    // Red Hazard Circle
    L.circle([sosLat, sosLng], {
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 0.25,
      radius: 350,
      weight: 2
    }).addTo(maps.sosMap);

    // SOS Marker
    const sosIcon = L.divIcon({
      className: 'custom-sos-marker',
      html: `<div style="width:24px;height:24px;background:#ef4444;border:3px solid #ffffff;border-radius:50%;box-shadow:0 0 15px rgba(239,68,68,0.9);animation:pulseRed 1s infinite"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    L.marker([sosLat, sosLng], { icon: sosIcon }).addTo(maps.sosMap).bindPopup('<b>Ananya (SOS Trigger Point)</b><br>Alcot Gardens').openPopup();

    // Nearby Police Haven Pin
    L.marker([16.9920, 81.7890]).addTo(maps.sosMap).bindPopup('Town Police Station (420m away)');

  } catch (err) {
    console.log('SOS map init:', err);
  }

  // Initialize Journeys Route Map
  try {
    maps.journeyMap = L.map('journey-route-map', { zoomControl: false }).setView([12.9716, 77.5946], 12);
    L.tileLayer(mapTileUrl, { attribution: mapAttribution, maxZoom: 19 }).addTo(maps.journeyMap);

    const bgrCoords = [
      [12.9900, 77.5700], // Campus East Gate
      [12.9780, 77.6000], // Detour point
      [12.9650, 77.6200]  // Home (Green Acres)
    ];

    L.polyline(bgrCoords, { color: '#2563eb', weight: 4, dashArray: '8, 8' }).addTo(maps.journeyMap);
    L.marker([12.9780, 77.6000]).addTo(maps.journeyMap).bindPopup('Detour Flagged (+40m offset)');

  } catch (err) {
    console.log('Journey map init:', err);
  }

  // Initialize Insights Topology Map
  try {
    maps.topologyMap = L.map('insights-topology-map', { zoomControl: false }).setView([centerLat, centerLng], 13);
    L.tileLayer(mapTileUrl, { attribution: mapAttribution, maxZoom: 19 }).addTo(maps.topologyMap);

    L.circle([centerLat, centerLng], { color: '#10b981', fillColor: '#10b981', fillOpacity: 0.1, radius: 2500 }).addTo(maps.topologyMap);
  } catch (err) {
    console.log('Topology map init:', err);
  }

  // --- 3. CHART.JS & CANVASES ---

  // Sparkline Chart on Home Page
  const homeSparklineCanvas = document.getElementById('home-sparkline-canvas');
  if (homeSparklineCanvas) {
    new Chart(homeSparklineCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
        datasets: [{
          data: [20, 24, 16, 24, 22, 15, 24],
          borderColor: '#2563eb',
          borderWidth: 2.5,
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#2563eb'
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false, min: 10, max: 40 } }
      }
    });
  }

  // Insights Weekly Risk Trend Chart
  const insightsWeeklyCanvas = document.getElementById('insights-weekly-chart');
  if (insightsWeeklyCanvas) {
    new Chart(insightsWeeklyCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: ['Mon', 'Tue', 'Wed (Lowest)', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
          {
            label: 'Daily Risk Score',
            data: [20, 24, 16, 24, 22, 15, 24],
            borderColor: '#2563eb',
            borderWidth: 3,
            backgroundColor: 'rgba(37, 99, 235, 0.12)',
            fill: true,
            tension: 0.45,
            pointRadius: 5,
            pointBackgroundColor: '#2563eb',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2
          },
          {
            label: 'Caution Threshold (35)',
            data: [35, 35, 35, 35, 35, 35, 35],
            borderColor: '#f59e0b',
            borderWidth: 2,
            borderDash: [6, 6],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            min: 0,
            max: 50,
            grid: { color: 'rgba(226, 232, 240, 0.6)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  // ECG Waveform Canvas Simulation
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

  drawECG('ecg-preview-canvas');
  drawECG('band-ecg-live-canvas');
  drawECG('journey-hr-canvas');

  // --- 4. INTERACTIVE ACTIONS & MODALS ---

  // Voice Call Modal Controls
  const modalVoiceCall = document.getElementById('modal-voice-call');
  const callStatusLabel = document.getElementById('call-status-label');
  const callTimer = document.getElementById('call-timer');
  let callTimerInterval = null;

  function launchVoiceCall() {
    modalVoiceCall.classList.add('active-modal');
    callStatusLabel.textContent = 'Connecting Encrypted Voice Handshake...';
    let sec = 0;
    
    callTimerInterval = setInterval(() => {
      sec++;
      const m = String(Math.floor(sec / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      callTimer.textContent = `${m}:${s}`;
      if (sec === 2) callStatusLabel.textContent = '● Live Encrypted Voice Stream (AES-256)';
    }, 1000);
  }

  function closeVoiceCall() {
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

  // Audit Log Drawer Controls
  const modalAuditDrawer = document.getElementById('modal-audit-drawer');
  const auditBodyContent = document.getElementById('audit-body-content');

  document.querySelectorAll('.btn-open-audit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id') || 'ALT-8921';
      document.getElementById('audit-badge-id').textContent = id;
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
      modalAuditDrawer.classList.add('active-modal');
    });
  });

  document.getElementById('btn-close-audit')?.addEventListener('click', () => {
    modalAuditDrawer.classList.remove('active-modal');
  });

  // Audio Triage Simulator Player
  let isPlayingAudio = false;
  document.getElementById('btn-toggle-triage-audio')?.addEventListener('click', function() {
    isPlayingAudio = !isPlayingAudio;
    this.innerHTML = isPlayingAudio ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
    showToast(isPlayingAudio ? '🔊 Playing encrypted acoustic triage snippet loop' : 'Audio snippet paused');
  });

  // Action Buttons Toast Triggers
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

  // --- 5. TOAST NOTIFICATION ENGINE ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    if (type === 'danger') toast.style.background = '#dc2626';

    const icon = type === 'danger' ? '<i class="fa-solid fa-triangle-exclamation"></i>' : '<i class="fa-solid fa-circle-info text-primary"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // --- 6. REAL-TIME TIMER TICKER ---
  const syncTimerSpan = document.getElementById('sync-timer-sec');
  if (syncTimerSpan) {
    let count = 10;
    setInterval(() => {
      count = (count % 15) + 1;
      syncTimerSpan.textContent = count;
    }, 1000);
  }

  // Initial Route Check
  switchView(window.location.hash || '#home');
});
