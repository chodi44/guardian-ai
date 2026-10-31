import { appState } from '../state.js';

let leafletMap = null;
let markersGroup = null;

export function init() {
  const mapContainer = document.getElementById('leaflet-live-map');
  if (!mapContainer) return;

  // Cleanup existing map instance on page re-init
  if (leafletMap) {
    try { leafletMap.remove(); } catch (e) {}
    leafletMap = null;
  }

  const cases = appState.cases || [];
  
  // Determine center coordinates based on first case's IP/location or default coordinates
  const firstCase = cases[0];
  const centerLat = (firstCase && firstCase.coords && firstCase.coords.lat) ? firstCase.coords.lat : 17.0005;
  const centerLng = (firstCase && firstCase.coords && firstCase.coords.lng) ? firstCase.coords.lng : 81.8040;

  if (typeof L !== 'undefined') {
    leafletMap = L.map('leaflet-live-map', {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([centerLat, centerLng], 14);

    // OpenStreetMap dark/tile tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap • Guardian AI Live IP Map'
    }).addTo(leafletMap);

    markersGroup = L.layerGroup().addTo(leafletMap);

    renderMapMarkers();
  }

  appState.subscribe(() => {
    renderMapMarkers();
  });

  function renderMapMarkers() {
    if (!leafletMap || !markersGroup || typeof L === 'undefined') return;

    markersGroup.clearLayers();
    const currentCases = appState.cases || [];

    if (currentCases.length === 0) {
      // Add default sector marker
      const defaultMarker = L.marker([17.0005, 81.8040])
        .bindPopup(`
          <div style="font-family: Inter, sans-serif; padding: 4px;">
            <strong style="color: #0284c7; font-size: 14px;">📡 SECTOR 4 GATEWAY ACTIVE</strong><br/>
            <span style="font-size: 12px; color: #64748b;">Device IP: Local Gateway</span><br/>
            <span style="font-size: 12px; color: #10b981;">Status: Monitoring Live SOS Ingestion</span>
          </div>
        `);
      markersGroup.addLayer(defaultMarker);
      return;
    }

    const bounds = [];

    currentCases.forEach(c => {
      const lat = (c.coords && c.coords.lat) ? c.coords.lat : 17.0005;
      const lng = (c.coords && c.coords.lng) ? c.coords.lng : 81.8040;
      const ip = c.ipAddress || c.ip || '127.0.0.1';
      const locStr = c.location || c.ipLocation || 'Rajahmundry, AP, India';
      const isCritical = c.severity === 'Critical' || c.rawStatus === 'ESCALATED_POLICE';

      bounds.push([lat, lng]);

      // Custom HTML Marker for IP Location & Incident Status
      const markerIcon = L.divIcon({
        className: 'custom-ip-map-marker',
        html: `
          <div style="
            background: ${isCritical ? '#ef4444' : '#2563eb'};
            color: #ffffff;
            padding: 6px 10px;
            border-radius: 20px;
            font-family: Inter, sans-serif;
            font-size: 11px;
            font-weight: 800;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            border: 2px solid #ffffff;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 5px;
          ">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: #ffffff; display: inline-block;"></span>
            #${c.id} • ${c.name || 'Ward'}
          </div>
        `,
        iconSize: [120, 30],
        iconAnchor: [60, 15]
      });

      const popupHtml = `
        <div style="font-family: Inter, sans-serif; width: 220px; padding: 4px;">
          <div style="font-size: 11px; font-weight: 800; color: ${isCritical ? '#ef4444' : '#2563eb'}; margin-bottom: 4px;">
            🚨 INCIDENT CASE #${c.id}
          </div>
          <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
            ${c.name || 'Protected Ward'}
          </div>
          <div style="font-size: 12px; color: #475569; margin-bottom: 6px; line-height: 1.3;">
            📍 <strong>Location:</strong> ${locStr}<br/>
            🌐 <strong>Device IP:</strong> <code style="background: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-weight: 700; color: #2563eb;">${ip}</code><br/>
            ❤️ <strong>Biometrics:</strong> ${c.bpm || 148} BPM (${c.score || 89}/100)
          </div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
            <strong>Trigger:</strong> ${c.reason || 'Explicit SOS Trigger'}
          </div>
          <button onclick="if(window.router) window.router.navigate('/case/${c.id}')" style="
            width: 100%;
            background: #0f172a;
            color: #ffffff;
            border: none;
            padding: 6px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
          ">
            OPEN INCIDENT DOSSIER →
          </button>
        </div>
      `;

      const marker = L.marker([lat, lng], { icon: markerIcon }).bindPopup(popupHtml);
      markersGroup.addLayer(marker);
    });

    if (bounds.length > 0 && leafletMap) {
      if (bounds.length === 1) {
        leafletMap.setView(bounds[0], 14);
      } else {
        leafletMap.fitBounds(bounds, { padding: [40, 40] });
      }
    }
  }
}
