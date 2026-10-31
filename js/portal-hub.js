/**
 * GUARDIAN AI — UNIFIED SENTINEL PLATFORM CONTROLLER (PORTAL HUB)
 * Manages Master Single-Link Routing, Embedded Studio Viewport,
 * Device Simulation, Feature Catalog Search & Live Persona Switching.
 */

(function () {
  'use strict';

  // 1. MASTER FEATURE REGISTRY (30 modules fully connected)
  const PLATFORM_FEATURES = [
    // --- USER SAFETY & TELEMETRY SUITE ---
    {
      id: 'user-dashboard',
      title: 'User Safety Dashboard',
      category: 'user',
      path: 'user/dashboard/index.html',
      icon: 'fa-solid fa-chart-pie',
      iconColor: 'hub-icon-blue',
      roleBadge: 'user',
      status: 'Safety Score 94/100',
      tags: ['overview', 'dashboard', 'ecg', 'vitals', 'score', 'sentinel'],
      description: 'Central real-time safety telemetry hub with live biometrics, active corridor tracking, and SOS dispatch.'
    },
    {
      id: 'location',
      title: 'Live GPS GeoNAV & Safe Zones',
      category: 'telemetry',
      path: 'location.html',
      icon: 'fa-solid fa-location-arrow',
      iconColor: 'hub-icon-cyan',
      roleBadge: 'user',
      status: 'GPS Fixed • High Accuracy',
      tags: ['gps', 'map', 'geofence', 'safe zones', 'coordinates', 'live tracking'],
      description: 'Interactive Leaflet GPS map with perimeter boundaries, dynamic radius geofencing, and breadcrumb trails.'
    },
    {
      id: 'journeys',
      title: 'Safe Corridors & Journeys',
      category: 'telemetry',
      path: 'journeys.html',
      icon: 'fa-solid fa-route',
      iconColor: 'hub-icon-indigo',
      roleBadge: 'user',
      status: 'Corridor Active • 98% Safe',
      tags: ['transit', 'route', 'corridor', 'eta', 'travel', 'safe path'],
      description: 'Transit safety corridor with ETA monitoring, route deviation detection, and danger zone avoidance.'
    },
    {
      id: 'band',
      title: 'Guardian Band Hardware Suite',
      category: 'biometrics',
      path: 'band.html',
      icon: 'fa-solid fa-stopwatch',
      iconColor: 'hub-icon-emerald',
      roleBadge: 'user',
      status: 'ESP32 BLE Connected • 84%',
      tags: ['wearable', 'esp32', 'heart rate', 'spo2', 'fall detection', 'vitals'],
      description: 'MAX30102 PPG pulse oximeter, MPU6050 fall detection, battery diagnostics, and GSM SMS fallback.'
    },
    {
      id: 'sos-alert',
      title: 'Critical SOS Emergency Simulator',
      category: 'emergency',
      path: 'sos-alert.html',
      icon: 'fa-solid fa-triangle-exclamation',
      iconColor: 'hub-icon-rose',
      roleBadge: 'emergency',
      status: 'Beacon Ready',
      tags: ['sos', 'emergency', 'siren', 'countdown', 'police', 'dispatch', 'alarm'],
      description: 'High-priority emergency trigger with 10-second countdown, automated siren, police alert, and live beacon broadcast.'
    },
    {
      id: 'insights',
      title: 'AI Risk Insights & Predictions',
      category: 'telemetry',
      path: 'insights.html',
      icon: 'fa-solid fa-chart-line',
      iconColor: 'hub-icon-purple',
      roleBadge: 'user',
      status: 'AI Sentinel Active',
      tags: ['ai', 'analytics', 'risk', 'patterns', 'anomalies', 'safety index'],
      description: 'Machine learning risk scoring, environmental threat index, and historical anomaly detection models.'
    },
    {
      id: 'voice-mails',
      title: 'Acoustic Triage & Voice Memos',
      category: 'telemetry',
      path: 'voice-mails.html',
      icon: 'fa-solid fa-microphone',
      iconColor: 'hub-icon-amber',
      roleBadge: 'user',
      status: 'Waveform Analyzer Ready',
      tags: ['audio', 'voice', 'decibels', 'distress', 'acoustic', 'recordings'],
      description: 'Voice check-in analysis, ambient distress acoustic monitoring, and emergency voice memo transcripts.'
    },
    {
      id: 'alerts',
      title: 'Alerts & Incident Registry',
      category: 'telemetry',
      path: 'alerts.html',
      icon: 'fa-solid fa-bell',
      iconColor: 'hub-icon-amber',
      roleBadge: 'user',
      status: '3 Active Notices',
      tags: ['alerts', 'notifications', 'incidents', 'breach', 'logs'],
      description: 'Chronological timeline of system warnings, hardware heartbeats, and emergency responder dispatches.'
    },

    // --- RELATIONSHIPS & GUARDIAN CONTROLS ---
    {
      id: 'guardians',
      title: 'My Connected Guardians',
      category: 'user',
      path: 'user/guardians/index.html',
      icon: 'fa-solid fa-users',
      iconColor: 'hub-icon-blue',
      roleBadge: 'user',
      status: '2 Guardians Linked',
      tags: ['guardians', 'contacts', 'family', 'protectors', 'links'],
      description: 'Manage connected protectors, view relationship hierarchies, and configure access permissions.'
    },
    {
      id: 'guardian-requests',
      title: 'Guardian Link Requests & OTP',
      category: 'user',
      path: 'user/guardian-requests/index.html',
      icon: 'fa-solid fa-user-clock',
      iconColor: 'hub-icon-indigo',
      roleBadge: 'user',
      status: 'Handshake Ready',
      tags: ['requests', 'approval', 'otp', 'verification', 'link code'],
      description: 'Approve incoming guardian link requests using secure One-Time Passcodes (OTP) and identity handshakes.'
    },
    {
      id: 'guardian-id',
      title: 'Your Unique Guardian ID',
      category: 'user',
      path: 'user/guardian-id/index.html',
      icon: 'fa-solid fa-id-badge',
      iconColor: 'hub-icon-purple',
      roleBadge: 'user',
      status: 'GDN-7F4K92X Active',
      tags: ['id', 'qr code', 'share', 'code', 'unique id'],
      description: 'Secure unique guardian sharing identifier and QR code for establishing cryptographically linked connections.'
    },
    {
      id: 'user-permissions',
      title: 'Granular Access Permissions',
      category: 'user',
      path: 'user/permissions/index.html',
      icon: 'fa-solid fa-sliders',
      iconColor: 'hub-icon-cyan',
      roleBadge: 'user',
      status: 'Privacy Shield On',
      tags: ['permissions', 'privacy', 'telemetry access', 'gps toggle', 'vitals toggle'],
      description: 'Fine-grained privacy controls for toggling GPS sharing, biometric vitals visibility, and audio threat metrics.'
    },
    {
      id: 'user-profile',
      title: 'User Profile & Medical Info',
      category: 'user',
      path: 'user/profile/index.html',
      icon: 'fa-solid fa-user',
      iconColor: 'hub-icon-blue',
      roleBadge: 'user',
      status: 'Profile Complete',
      tags: ['profile', 'medical', 'blood group', 'allergies', 'contact'],
      description: 'Personal details, vital emergency medical notes, allergies, blood type, and emergency contacts.'
    },
    {
      id: 'user-settings',
      title: 'User Safety Settings',
      category: 'user',
      path: 'user/settings/index.html',
      icon: 'fa-solid fa-gear',
      iconColor: 'hub-icon-indigo',
      roleBadge: 'user',
      status: 'Preferences Configured',
      tags: ['settings', 'configuration', 'notifications', 'thresholds'],
      description: 'Configure biometric alert thresholds, siren volume, SMS dispatch numbers, and system preferences.'
    },

    // --- GUARDIAN PROTECTOR SUITE ---
    {
      id: 'guardian-dashboard',
      title: 'Guardian Protector Console',
      category: 'guardian',
      path: 'guardian/dashboard/index.html',
      icon: 'fa-solid fa-user-shield',
      iconColor: 'hub-icon-emerald',
      roleBadge: 'guardian',
      status: 'Monitoring 2 Wards',
      tags: ['guardian', 'protector', 'supervision', 'ward tracking', 'console'],
      description: 'Primary guardian supervisory portal for monitoring protected family members and live emergency telemetry.'
    },
    {
      id: 'guardian-connect',
      title: 'Connect to Protected User',
      category: 'guardian',
      path: 'guardian/connect-user/index.html',
      icon: 'fa-solid fa-link',
      iconColor: 'hub-icon-cyan',
      roleBadge: 'guardian',
      status: 'Link Protocol Ready',
      tags: ['connect', 'link ward', 'otp', 'pair user', 'guardian id'],
      description: 'Initiate a secure connection to a ward by entering their unique Guardian ID and verifying the shared OTP.'
    },
    {
      id: 'guardian-linked',
      title: 'Linked Protected Wards',
      category: 'guardian',
      path: 'guardian/linked-users/index.html',
      icon: 'fa-solid fa-users-viewfinder',
      iconColor: 'hub-icon-emerald',
      roleBadge: 'guardian',
      status: 'Active Connections',
      tags: ['linked', 'wards', 'dependents', 'supervised users'],
      description: 'Roster of all connected individuals under your protection with real-time status and quick action controls.'
    },
    {
      id: 'guardian-user',
      title: 'Protected Ward Deep-Dive',
      category: 'guardian',
      path: 'guardian/user/index.html',
      icon: 'fa-solid fa-user-check',
      iconColor: 'hub-icon-blue',
      roleBadge: 'guardian',
      status: 'Telemetry Live',
      tags: ['ward', 'individual', 'live stats', 'location deep dive'],
      description: 'Detailed telemetry inspection view for a specific ward including GPS breadcrumbs, vitals history, and route map.'
    },
    {
      id: 'guardian-permissions',
      title: 'Supervised Permissions Matrix',
      category: 'guardian',
      path: 'guardian/permissions/index.html',
      icon: 'fa-solid fa-shield-halved',
      iconColor: 'hub-icon-purple',
      roleBadge: 'guardian',
      status: 'Authorized',
      tags: ['guardian permissions', 'access scope', 'clearance'],
      description: 'Review granted monitoring privileges and telemetry access levels permitted by each linked ward.'
    },
    {
      id: 'guardian-settings',
      title: 'Guardian Notification Settings',
      category: 'guardian',
      path: 'guardian/settings/index.html',
      icon: 'fa-solid fa-sliders',
      iconColor: 'hub-icon-emerald',
      roleBadge: 'guardian',
      status: 'Configured',
      tags: ['guardian settings', 'push alerts', 'sms notification'],
      description: 'Manage push notifications, SMS alert escalation chains, and emergency dispatch thresholds.'
    },

    // --- AUTHENTICATION & ONBOARDING ---
    {
      id: 'welcome',
      title: 'Welcome & System Hero',
      category: 'auth',
      path: 'welcome.html',
      icon: 'fa-solid fa-house-chimney-window',
      iconColor: 'hub-icon-indigo',
      roleBadge: 'system',
      status: 'Platform Landing',
      tags: ['welcome', 'hero', 'landing', 'introduction', 'specs'],
      description: 'Guardian AI overview landing screen highlighting FIPS-140 encryption, zero-recording audio, and SOC2 compliance.'
    },
    {
      id: 'user-login',
      title: 'User Portal Login',
      category: 'auth',
      path: 'user/login/index.html',
      icon: 'fa-solid fa-right-to-bracket',
      iconColor: 'hub-icon-blue',
      roleBadge: 'user',
      status: 'Auth Ready',
      tags: ['login', 'user auth', 'signin', 'ananya'],
      description: 'Dedicated login screen for protected users (e.g. Ananya Sharma) with instant one-click demo credentials.'
    },
    {
      id: 'guardian-login',
      title: 'Guardian Portal Login',
      category: 'auth',
      path: 'guardian/login/index.html',
      icon: 'fa-solid fa-shield-cat',
      iconColor: 'hub-icon-emerald',
      roleBadge: 'guardian',
      status: 'Auth Ready',
      tags: ['login', 'guardian auth', 'signin', 'ravi'],
      description: 'Protector authentication portal for primary and secondary guardians (e.g. Ravi Sharma).'
    },
    {
      id: 'user-register',
      title: 'User Account Registration',
      category: 'auth',
      path: 'user/register/index.html',
      icon: 'fa-solid fa-user-plus',
      iconColor: 'hub-icon-blue',
      roleBadge: 'user',
      status: 'Signup Flow',
      tags: ['register', 'signup', 'user account', 'new user'],
      description: 'Step-by-step account creation with emergency contact assignment and Guardian ID generation.'
    },
    {
      id: 'guardian-register',
      title: 'Guardian Registration',
      category: 'auth',
      path: 'guardian/register/index.html',
      icon: 'fa-solid fa-id-card-clip',
      iconColor: 'hub-icon-emerald',
      roleBadge: 'guardian',
      status: 'Signup Flow',
      tags: ['guardian register', 'protector signup', 'verification'],
      description: 'Enroll as a licensed guardian with identity verification, phone validation, and ward linkage setup.'
    },
    {
      id: 'onboarding-1',
      title: 'Onboarding Step 1: Emergency Contacts',
      category: 'auth',
      path: 'onboarding-step1.html',
      icon: 'fa-solid fa-address-book',
      iconColor: 'hub-icon-cyan',
      roleBadge: 'system',
      status: 'Wizard Step 1',
      tags: ['onboarding', 'contacts', 'setup', 'step 1', 'family'],
      description: 'Primary emergency contacts configuration, SMS dispatch numbers, and priority call list.'
    },
    {
      id: 'onboarding-2',
      title: 'Onboarding Step 2: Wearable BLE Pairing',
      category: 'auth',
      path: 'onboarding-step2.html',
      icon: 'fa-solid fa-bluetooth',
      iconColor: 'hub-icon-indigo',
      roleBadge: 'system',
      status: 'Wizard Step 2',
      tags: ['onboarding', 'ble', 'bluetooth', 'pairing', 'step 2', 'band'],
      description: 'Wireless Bluetooth LE discovery and cryptographic binding of the ESP32 Guardian Band.'
    },
    {
      id: 'home',
      title: 'Unified Monitoring Console (Classic)',
      category: 'telemetry',
      path: 'home.html',
      icon: 'fa-solid fa-desktop',
      iconColor: 'hub-icon-cyan',
      roleBadge: 'system',
      status: 'Legacy Unified View',
      tags: ['console', 'home', 'integrated view', 'multi-panel'],
      description: 'Classic single-view monitoring console featuring map, vitals, and telemetry in a multi-column dashboard.'
    }
  ];

  // DOM Elements
  const studioFrame = document.getElementById('studio-frame');
  const studioDeviceFrame = document.getElementById('studio-device-frame');
  const studioUrlText = document.getElementById('studio-url-text');
  const studioBadgeFeature = document.getElementById('studio-badge-feature');
  const btnReloadFrame = document.getElementById('btn-reload-frame');
  const btnExternalLink = document.getElementById('btn-external-link');
  const btnCopyLink = document.getElementById('btn-copy-link');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const cardsContainer = document.getElementById('hub-cards-grid');
  const searchInput = document.getElementById('hub-search-input');
  const categoryPills = document.querySelectorAll('.hub-cat-pill');
  const viewportBtns = document.querySelectorAll('.hub-viewport-btn');
  const viewmodeBtns = document.querySelectorAll('.hub-viewmode-btn');
  const studioSection = document.getElementById('studio-section');
  const catalogSection = document.getElementById('catalog-section');
  const personaPill = document.getElementById('hub-persona-pill');
  const personaName = document.getElementById('hub-persona-name');
  const personaRole = document.getElementById('hub-persona-role');
  const personaAvatar = document.getElementById('hub-persona-avatar');
  const toastElement = document.getElementById('hub-toast');
  const toastText = document.getElementById('hub-toast-text');
  const quicktabsContainer = document.getElementById('hub-studio-quicktabs');

  let currentFeature = PLATFORM_FEATURES[0];
  let currentPersona = 'user'; // 'user' or 'guardian'
  let currentCategory = 'all';

  // --- 2. RENDER MASTER FEATURE CARDS ---
  function renderFeatureCards(featuresToRender) {
    if (!cardsContainer) return;
    cardsContainer.innerHTML = '';

    if (featuresToRender.length === 0) {
      cardsContainer.innerHTML = `
        <div class="hub-empty-state">
          <i class="fa-solid fa-magnifying-glass hub-empty-icon"></i>
          <h3 class="hub-empty-title">No matching features found</h3>
          <p class="hub-empty-desc">Try searching for keywords like "SOS", "GPS", "Band", "OTP", or "Guardian".</p>
        </div>
      `;
      return;
    }

    featuresToRender.forEach(feature => {
      const card = document.createElement('div');
      card.className = 'hub-card';
      card.setAttribute('data-id', feature.id);

      const roleClass = 
        feature.roleBadge === 'user' ? 'hub-role-user' :
        feature.roleBadge === 'guardian' ? 'hub-role-guardian' :
        feature.roleBadge === 'emergency' ? 'hub-role-emergency' : 'hub-role-system';

      card.innerHTML = `
        <div class="hub-card-header">
          <div class="hub-card-icon-wrap ${feature.iconColor}">
            <i class="${feature.icon}"></i>
          </div>
          <div class="hub-card-badges">
            <span class="hub-role-badge ${roleClass}">${feature.roleBadge}</span>
            <span class="hub-status-pill"><span class="indicator"></span>${feature.status}</span>
          </div>
        </div>
        <div class="hub-card-body">
          <h3 class="hub-card-title">${feature.title}</h3>
          <p class="hub-card-desc">${feature.description}</p>
          <div class="hub-card-tags">
            ${feature.tags.map(tag => `<span class="hub-tag">#${tag}</span>`).join('')}
          </div>
        </div>
        <div class="hub-card-footer">
          <span class="hub-card-url" title="${feature.path}">/${feature.path}</span>
          <div class="hub-card-btn-group">
            <button type="button" class="hub-btn-launch" data-launch="${feature.id}">
              <i class="fa-solid fa-play"></i>
              <span>Launch Studio</span>
            </button>
            <a href="${feature.path}" target="_blank" class="hub-btn-standalone" title="Open Standalone in New Tab">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          </div>
        </div>
      `;
      cardsContainer.appendChild(card);
    });

    // Attach click listeners to cards' Launch buttons
    cardsContainer.querySelectorAll('.hub-btn-launch').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-launch');
        navigateToFeature(id, true);
      });
    });
  }

  // --- 3. RENDER STUDIO QUICK JUMP TABS ---
  function renderStudioQuickTabs() {
    if (!quicktabsContainer) return;
    quicktabsContainer.innerHTML = '';

    const priorityIds = [
      'user-dashboard',
      'guardian-dashboard',
      'location',
      'journeys',
      'sos-alert',
      'band',
      'insights',
      'alerts',
      'guardians',
      'guardian-requests',
      'guardian-id',
      'user-permissions',
      'user-profile',
      'user-settings',
      'welcome'
    ];

    priorityIds.forEach(id => {
      const feat = PLATFORM_FEATURES.find(f => f.id === id);
      if (!feat) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `hub-studio-tab-btn ${feat.id === currentFeature.id ? 'active' : ''}`;
      btn.setAttribute('data-id', feat.id);
      btn.innerHTML = `<i class="${feat.icon}"></i><span>${feat.title.split(' ')[0]}</span>`;
      btn.title = feat.title;

      btn.addEventListener('click', () => {
        navigateToFeature(feat.id, false);
      });

      quicktabsContainer.appendChild(btn);
    });
  }

  // --- 4. ROUTER & FEATURE SWITCHER ---
  function navigateToFeature(featureId, smoothScrollToStudio = false) {
    const feat = PLATFORM_FEATURES.find(f => f.id === featureId);
    if (!feat) return;

    currentFeature = feat;

    // Update Frame Source
    if (studioFrame) {
      studioFrame.src = feat.path;
    }

    // Update URL Bar & Title
    if (studioUrlText) {
      studioUrlText.textContent = `http://localhost:8000/${feat.path}`;
    }
    if (studioBadgeFeature) {
      studioBadgeFeature.textContent = feat.title;
    }

    // Update External Link
    if (btnExternalLink) {
      btnExternalLink.href = feat.path;
    }

    // Update Quick Tab active states
    document.querySelectorAll('.hub-studio-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-id') === feat.id) {
        btn.classList.add('active');
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        btn.classList.remove('active');
      }
    });

    // Update URL Hash without triggering re-navigation loop
    if (window.location.hash !== `#${feat.id}`) {
      history.pushState(null, '', `#${feat.id}`);
    }

    if (smoothScrollToStudio && studioSection) {
      studioSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // --- 5. HASH CHANGE LISTENER ---
  function handleHashChange() {
    const hash = window.location.hash.replace('#', '').trim();
    if (hash) {
      const found = PLATFORM_FEATURES.find(f => f.id === hash);
      if (found) {
        navigateToFeature(found.id, false);
        return;
      }
    }
    // Default to user-dashboard
    navigateToFeature('user-dashboard', false);
  }

  // --- 6. DEVICE VIEWPORT CONTROLS ---
  viewportBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      viewportBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.getAttribute('data-mode'); // 'desktop', 'tablet', 'mobile'

      if (studioDeviceFrame) {
        studioDeviceFrame.classList.remove('mode-desktop', 'mode-tablet', 'mode-mobile');
        studioDeviceFrame.classList.add(`mode-${mode}`);
      }

      showToast(`Viewport switched to ${mode.toUpperCase()} simulation`);
    });
  });

  // --- 7. ACTION BUTTONS (Reload, Copy Link, Fullscreen) ---
  btnReloadFrame?.addEventListener('click', () => {
    if (studioFrame) {
      studioFrame.src = currentFeature.path;
      showToast('Studio frame reloaded');
    }
  });

  btnCopyLink?.addEventListener('click', () => {
    const fullUrl = `${window.location.origin}/${currentFeature.path}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      showToast(`Copied direct URL: ${fullUrl}`);
    }).catch(() => {
      showToast(`Link: ${fullUrl}`);
    });
  });

  btnFullscreen?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.querySelector('.hub-viewport-stage')?.requestFullscreen().catch(err => {
        showToast(`Fullscreen error: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  });

  // --- 8. SEARCH & FILTERING ---
  function filterFeatures() {
    const query = (searchInput?.value || '').toLowerCase().trim();

    let filtered = PLATFORM_FEATURES;

    // Filter by Category
    if (currentCategory !== 'all') {
      filtered = filtered.filter(f => {
        if (currentCategory === 'user') return f.category === 'user';
        if (currentCategory === 'guardian') return f.category === 'guardian';
        if (currentCategory === 'telemetry') return f.category === 'telemetry' || f.category === 'biometrics';
        if (currentCategory === 'emergency') return f.category === 'emergency';
        if (currentCategory === 'auth') return f.category === 'auth';
        return true;
      });
    }

    // Filter by Query
    if (query) {
      filtered = filtered.filter(f => 
        f.title.toLowerCase().includes(query) ||
        f.description.toLowerCase().includes(query) ||
        f.path.toLowerCase().includes(query) ||
        f.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    renderFeatureCards(filtered);
  }

  searchInput?.addEventListener('input', filterFeatures);

  // Keyboard Shortcut: Cmd/Ctrl + K to focus search
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      searchInput?.focus();
      searchInput?.select();
    }
  });

  // Category Pills
  categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      categoryPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.getAttribute('data-category');
      filterFeatures();
    });
  });

  // --- 9. VIEW MODE TOGGLE (Studio / Catalog / Split) ---
  viewmodeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      viewmodeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.getAttribute('data-view');

      if (mode === 'studio') {
        studioSection.style.display = 'flex';
        catalogSection.style.display = 'none';
        studioSection.scrollIntoView({ behavior: 'smooth' });
      } else if (mode === 'catalog') {
        studioSection.style.display = 'none';
        catalogSection.style.display = 'flex';
        catalogSection.scrollIntoView({ behavior: 'smooth' });
      } else {
        // 'split' / 'both'
        studioSection.style.display = 'flex';
        catalogSection.style.display = 'flex';
      }
    });
  });

  // --- 10. PERSONA SWITCHER ---
  personaPill?.addEventListener('click', () => {
    if (currentPersona === 'user') {
      currentPersona = 'guardian';
      personaName.textContent = 'Ravi Sharma';
      personaRole.textContent = 'Primary Guardian';
      personaAvatar.src = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80';
      localStorage.setItem('currentUserRole', 'guardian');
      localStorage.setItem('gdn_portal_session', JSON.stringify({
        role: 'guardian',
        id: 'gdn_ravi_01',
        name: 'Ravi Sharma',
        fullName: 'Ravi Sharma',
        email: 'ravi@sentinel-ai.com'
      }));
      showToast('Switched Persona to Primary Guardian (Ravi)');
      navigateToFeature('guardian-dashboard', false);
    } else {
      currentPersona = 'user';
      personaName.textContent = 'Ananya Sharma';
      personaRole.textContent = 'Protected User';
      personaAvatar.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80';
      localStorage.setItem('currentUserRole', 'user');
      localStorage.setItem('gdn_portal_session', JSON.stringify({
        role: 'user',
        id: 'usr_ananya_01',
        name: 'Ananya Sharma',
        fullName: 'Ananya Sharma',
        email: 'ananya@sentinel-ai.com'
      }));
      showToast('Switched Persona to Protected User (Ananya)');
      navigateToFeature('user-dashboard', false);
    }
  });

  // --- 11. TOAST NOTIFICATION HELPER ---
  let toastTimer = null;
  function showToast(message) {
    if (!toastElement || !toastText) return;
    toastText.textContent = message;
    toastElement.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastElement.classList.remove('visible');
    }, 3200);
  }

  // --- 12. INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', () => {
    renderFeatureCards(PLATFORM_FEATURES);
    renderStudioQuickTabs();
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
  });

  // Expose API
  window.GuardianHub = {
    navigateTo: navigateToFeature,
    getFeatures: () => PLATFORM_FEATURES,
    showToast: showToast
  };

})();
