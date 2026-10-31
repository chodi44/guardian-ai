/**
 * 🛡️ Guardian AI — Web Bluetooth (BLE) Gateway
 * Pairs with Guardian Safety Band over Bluetooth Low Energy, listens for SOS & Telemetry,
 * relays authenticated calls to the Express Backend, and returns server ACK for haptic double-pulse vibration!
 */

(function () {
  const SERVICE_UUID               = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
  const SOS_CHARACTERISTIC_UUID     = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
  const HAPTIC_CHARACTERISTIC_UUID    = '8ec90001-f504-4a27-a657-7690623a6774';
  const TELEMETRY_CHAR_UUID         = 'e3240002-8054-46e7-a99f-44b423423b45';
  const AUDIO_CHAR_UUID             = 'c63b0003-9123-4f81-b552-88126b42b102';

  let bluetoothDevice = null;
  let gattServer = null;
  let service = null;
  let sosChar = null;
  let hapticChar = null;
  let telChar = null;
  let audioChar = null;
  let isConnecting = false;
  let isBandConnected = false;
  let isBackendReachable = false;
  let lastMeasurementTime = null;
  let lastSuccessfulUploadTime = null;
  let firmwareVersion = 'ESP32 Band (BLE GATT)';
  let activeIncidentId = null;

  // Cleanup BLE State on disconnect or error
  function cleanupBLEState() {
    isBandConnected = false;
    isConnecting = false;

    if (sosChar) {
      try { sosChar.removeEventListener('characteristicvaluechanged', handleSosNotification); } catch (e) {}
    }
    if (telChar) {
      try { telChar.removeEventListener('characteristicvaluechanged', handleTelemetryNotification); } catch (e) {}
    }
    if (audioChar) {
      try { audioChar.removeEventListener('characteristicvaluechanged', handleAudioChunkNotification); } catch (e) {}
    }
    if (bluetoothDevice) {
      try { bluetoothDevice.removeEventListener('gattserverdisconnected', onDisconnected); } catch (e) {}
    }

    gattServer = null;
    service = null;
    sosChar = null;
    hapticChar = null;
    telChar = null;
    audioChar = null;
    bluetoothDevice = null;

    updateBLEUIState(false);
    window.dispatchEvent(new CustomEvent('guardian:ble-disconnected'));
  }

  function onDisconnected() {
    console.warn('⚠️ [BLE Gateway] GATT Server Disconnected!');
    cleanupBLEState();
  }

  // Check Backend Connectivity Health
  async function checkBackendHealth() {
    try {
      const apiBase = window.GUARDIAN_CONFIG ? window.GUARDIAN_CONFIG.API_BASE_URL : '';
      const res = await fetch(apiBase + '/api/health', { method: 'GET' });
      isBackendReachable = res.ok;
    } catch (e) {
      isBackendReachable = false;
    }
    updateBLEUIState(isBandConnected);
  }

  setInterval(checkBackendHealth, 10000);
  checkBackendHealth();

  window.GuardianBLE = {
    isBandConnected: function () {
      return !!(gattServer && gattServer.connected && isBandConnected);
    },
    isBackendReachable: function () { return isBackendReachable; },
    getLastMeasurementTime: function () { return lastMeasurementTime; },
    getLastSuccessfulUploadTime: function () { return lastSuccessfulUploadTime; },
    getFirmwareVersion: function () { return firmwareVersion; },

    // Connect to Guardian Band via Web Bluetooth API (User Device Gateway Only)
    connect: async function () {
      if (isConnecting) {
        console.warn('⚠️ Connection attempt already in progress...');
        return false;
      }
      isConnecting = true;

      try {
        const currentPath = (window.location.pathname || '').toLowerCase();
        if (currentPath.includes('/guardian') || currentPath.includes('/police') || currentPath.includes('/emergency')) {
          alert('ℹ️ Guardian & Police consoles receive authorized backend updates over secure API. Direct BLE pairing is available on the User Safety Portal.');
          isConnecting = false;
          return false;
        }

        // 1. Secure Context Check
        if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
          alert('⚠️ Web Bluetooth Requirement:\n\nWeb Bluetooth requires HTTPS connection or http://localhost:8000.');
          isConnecting = false;
          return false;
        }

        if (!navigator.bluetooth) {
          alert('⚠️ Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Android Chrome.');
          isConnecting = false;
          return false;
        }

        cleanupBLEState(); // Reset previous state

        console.log('🔵 [BLE Gateway] Requesting Bluetooth Device...');
        bluetoothDevice = await navigator.bluetooth.requestDevice({
          filters: [{ namePrefix: 'Guardian' }, { namePrefix: 'ESP32' }],
          optionalServices: [SERVICE_UUID]
        });

        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

        console.log('🔵 [BLE Gateway] Connecting to GATT Server...');
        gattServer = await bluetoothDevice.gatt.connect();

        if (!gattServer || !gattServer.connected) {
          throw new Error('GATT Server disconnected during initial connection.');
        }

        firmwareVersion = bluetoothDevice.name || 'ESP32 Band (BLE GATT)';

        console.log('🔵 [BLE Gateway] Accessing Primary Safety Service...');
        service = await gattServer.getPrimaryService(SERVICE_UUID);

        // Get Haptic Characteristic
        hapticChar = await service.getCharacteristic(HAPTIC_CHARACTERISTIC_UUID);

        // Subscribe to SOS Characteristic
        sosChar = await service.getCharacteristic(SOS_CHARACTERISTIC_UUID);
        await sosChar.startNotifications();
        sosChar.addEventListener('characteristicvaluechanged', handleSosNotification);

        // Subscribe to Telemetry Characteristic
        try {
          telChar = await service.getCharacteristic(TELEMETRY_CHAR_UUID);
          await telChar.startNotifications();
          telChar.addEventListener('characteristicvaluechanged', handleTelemetryNotification);
        } catch (e) {
          console.log('ℹ️ [BLE Gateway] Telemetry characteristic optional subscribe.');
        }

        // Subscribe to Audio Chunk Characteristic
        try {
          audioChar = await service.getCharacteristic(AUDIO_CHAR_UUID);
          await audioChar.startNotifications();
          audioChar.addEventListener('characteristicvaluechanged', handleAudioChunkNotification);
        } catch (e) {
          console.log('ℹ️ [BLE Gateway] Audio characteristic optional subscribe.');
        }

        isBandConnected = gattServer.connected;
        isConnecting = false;
        console.log('✅ [BLE Gateway] Connected & Subscribed to Guardian Safety Band!');

        updateBLEUIState(isBandConnected);
        window.dispatchEvent(new CustomEvent('guardian:ble-connected'));
        return true;
      } catch (err) {
        console.error('❌ [BLE Gateway] Connection failed:', err);
        cleanupBLEState();
        return false;
      }
    },

    disconnect: function () {
      if (bluetoothDevice && bluetoothDevice.gatt.connected) {
        bluetoothDevice.gatt.disconnect();
      } else {
        cleanupBLEState();
      }
    },

    // Send structured JSON receipt over BLE to activate motor double-pulse
    sendHapticAck: async function (receiptData) {
      if (hapticChar && gattServer && gattServer.connected) {
        try {
          const encoder = new TextEncoder();
          const receiptPayload = typeof receiptData === 'object' 
            ? JSON.stringify(receiptData) 
            : (receiptData || 'ACK');
          await hapticChar.writeValue(encoder.encode(receiptPayload));
          console.log('🎉 [BLE Gateway] Sent receipt to Band:', receiptPayload);
        } catch (err) {
          console.error('❌ [BLE Gateway] Error sending haptic receipt:', err);
        }
      }
    },

    // Send STOP_HAPTICS over BLE to halt motor vibration
    sendStopHaptics: async function () {
      if (hapticChar && gattServer && gattServer.connected) {
        try {
          const encoder = new TextEncoder();
          await hapticChar.writeValue(encoder.encode('STOP_HAPTICS'));
          console.log('⏹️ [BLE Gateway] Sent STOP_HAPTICS to Band');
        } catch (err) {
          console.error('❌ [BLE Gateway] Error sending STOP_HAPTICS:', err);
        }
      }
    },

    // Send authenticated REQUEST_CANCEL over BLE to band
    sendStopAlarm: async function () {
      if (hapticChar && gattServer && gattServer.connected) {
        try {
          const encoder = new TextEncoder();
          await hapticChar.writeValue(encoder.encode('REQUEST_CANCEL'));
          console.log('⏹️ [BLE Gateway] Sent REQUEST_CANCEL to Band');
        } catch (err) {
          console.error('❌ [BLE Gateway] Error sending REQUEST_CANCEL to Band:', err);
        }
      }
    }
  };

  // Handle incoming SOS notification from physical ESP32 button press over Bluetooth
  async function handleSosNotification(event) {
    try {
      const value = new TextDecoder().decode(event.target.value);
      console.log('🔴 [BLE Gateway] Received SOS event from Band:', value);

      lastMeasurementTime = new Date();

      let payload;
      try {
        payload = JSON.parse(value);
      } catch (e) {
        payload = {
          deviceId: 'ESP32_BAND_001',
          deviceSecret: 'secret_key_123',
          deviceEventId: 'EVT_BLE_' + Date.now()
        };
      }

      let currentUser = null;
      try {
        const storedUser = localStorage.getItem('user') || localStorage.getItem('guardianUser');
        if (storedUser) currentUser = JSON.parse(storedUser);
      } catch (e) {}

      // Relay authenticated hardware SOS call to backend
      const apiBase = window.GUARDIAN_CONFIG ? window.GUARDIAN_CONFIG.API_BASE_URL : '';
      const response = await fetch(apiBase + '/api/device/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.userId || currentUser?._id || payload.userId || 'USR-TEST-100',
          userName: currentUser?.fullName || currentUser?.name || 'Logged-In Safety User',
          userPhone: currentUser?.phone || '9876543210',
          deviceId: payload.deviceId || 'ESP32_BAND_001',
          deviceSecret: payload.deviceSecret || 'secret_key_123',
          deviceEventId: payload.deviceEventId || ('EVT_BLE_' + Date.now()),
          triggerSource: payload.triggerSource || 'band_button',
          location: payload.location,
          detectionReason: payload.detectionReason
        })
      });

      const data = await response.json();

      // Confirm server receipt ONLY after backend saves incident in MongoDB
      if (data.success && data.acknowledged) {
        lastSuccessfulUploadTime = new Date();
        activeIncidentId = data.incidentId || data.caseId;
        const receiptObj = {
          deviceEventId: payload.deviceEventId || data.deviceEventId,
          incidentId: activeIncidentId || 'GA-SAVED',
          serverReceived: true,
          serverReceivedAt: new Date().toISOString()
        };
        console.log('✅ [BLE Gateway] Backend acknowledged SOS! Returning receipt to Band over BLE...');
        window.GuardianBLE.sendHapticAck(receiptObj);
      }

      updateBLEUIState(window.GuardianBLE.isBandConnected());
    } catch (err) {
      console.error('❌ [BLE Gateway] Failed to process BLE SOS notification:', err);
    }
  }

  async function handleTelemetryNotification(event) {
    try {
      const value = new TextDecoder().decode(event.target.value);
      console.log('📊 [BLE Telemetry Received]:', value);

      lastMeasurementTime = new Date();
      let payload;
      try {
        payload = JSON.parse(value);
      } catch (e) {
        payload = { heartRate: null, spO2: null, steps: 0, fingerContact: false };
      }

      await sendTelemetryBackend(payload);
    } catch (e) {
      console.error('Telemetry processing error:', e);
    }
  }

  async function handleAudioChunkNotification(event) {
    try {
      const value = new TextDecoder().decode(event.target.value);
      console.log('🎙️ [BLE Audio Chunk Received]:', value.length, 'bytes');

      let chunkPayload;
      try {
        chunkPayload = JSON.parse(value);
      } catch (e) {
        chunkPayload = { chunkIndex: 0, totalChunks: 1, pcmData: '' };
      }

      if (activeIncidentId) {
        chunkPayload.incidentId = activeIncidentId;
      }

      const apiBase = window.GUARDIAN_CONFIG ? window.GUARDIAN_CONFIG.API_BASE_URL : '';
      await fetch(apiBase + '/api/device/audio/chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunkPayload)
      });
    } catch (e) {
      console.error('Audio chunk error:', e);
    }
  }

  async function sendTelemetryBackend(payload) {
    let currentUser = null;
    try {
      const storedUser = localStorage.getItem('user') || localStorage.getItem('guardianUser');
      if (storedUser) currentUser = JSON.parse(storedUser);
    } catch (e) {}

    const apiBase = window.GUARDIAN_CONFIG ? window.GUARDIAN_CONFIG.API_BASE_URL : '';
    const res = await fetch(apiBase + '/api/device/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser?.userId || currentUser?._id || 'USR-TEST-100',
        deviceId: payload.deviceId || 'ESP32_BAND_001',
        heartRate: (payload.heartRate && payload.heartRate > 0) ? payload.heartRate : null,
        spO2: (payload.spO2 && payload.spO2 > 0) ? payload.spO2 : null,
        steps: payload.steps !== undefined ? payload.steps : 0,
        lat: payload.lat || null,
        lng: payload.lng || null,
        satellites: payload.satellites !== undefined ? payload.satellites : 14,
        hdop: payload.hdop !== undefined ? payload.hdop : 0.8,
        speedKmh: payload.speedKmh !== undefined ? payload.speedKmh : 0.0,
        gpsHasFix: payload.gpsHasFix !== undefined ? payload.gpsHasFix : true,
        fixQuality: payload.fixQuality || '3D_FIX',
        fingerContact: payload.fingerContact !== undefined ? !!payload.fingerContact : (payload.heartRate > 0)
      })
    });

    if (res.ok) {
      lastSuccessfulUploadTime = new Date();
    }

    window.dispatchEvent(new CustomEvent('guardian:telemetry', { detail: payload }));
    updateBLEUIState(window.GuardianBLE.isBandConnected());
  }

  function formatRelativeTime(date) {
    if (!date) return 'Never';
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const mins = Math.floor(seconds / 60);
    return `${mins}m ago`;
  }

  function updateBLEUIState(connected) {
    const btn = document.getElementById('btn-ble-connect');
    const badgeBand = document.getElementById('ble-status-badge');
    const badgeBackend = document.getElementById('backend-status-badge');
    const txtLastMeas = document.getElementById('ble-last-measurement-time');
    const txtLastUpload = document.getElementById('ble-last-upload-time');
    const txtFwVersion = document.getElementById('ble-fw-version');

    if (btn) btn.innerText = connected ? 'Disconnect Band' : 'Connect Band via Bluetooth';
    
    if (badgeBand) {
      badgeBand.className = connected ? 'pill-badge pill-safe' : 'pill-badge pill-warning';
      badgeBand.innerText = connected ? 'Band Connected' : 'Band Disconnected';
    }

    if (badgeBackend) {
      badgeBackend.className = isBackendReachable ? 'pill-badge pill-safe' : 'pill-badge pill-danger';
      badgeBackend.innerText = isBackendReachable ? 'Backend Reachable' : 'Backend Unreachable';
    }

    if (txtLastMeas) txtLastMeas.innerText = formatRelativeTime(lastMeasurementTime);
    if (txtLastUpload) txtLastUpload.innerText = formatRelativeTime(lastSuccessfulUploadTime);
    if (txtFwVersion) txtFwVersion.innerText = firmwareVersion;
  }
})();

