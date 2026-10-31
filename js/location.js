document.addEventListener('DOMContentLoaded', () => {
  try {
    const liveMap = L.map('live-location-map', { zoomControl: false }).setView([centerLat, centerLng], 14);
    L.tileLayer(mapTileUrl, { attribution: mapAttribution, maxZoom: 19 }).addTo(liveMap);

    const routeCoords = [
      [17.0150, 81.7900], // Campus
      [17.0080, 81.7980], // Safe Haven 1
      [17.0005, 81.8040], // Ananya Current Location
      [16.9920, 81.8120]  // Home
    ];

    L.polyline(routeCoords, { color: '#2563eb', weight: 5, opacity: 0.85, lineCap: 'round' }).addTo(liveMap);
    L.marker([centerLat, centerLng]).addTo(liveMap).bindPopup('Ananya • 4.2 km/h (Route #4)').openPopup();

    setTimeout(() => liveMap.invalidateSize(), 300);
  } catch (err) {
    console.log('Live map init:', err);
  }

  document.getElementById('btn-trigger-escort-alert-hero')?.addEventListener('click', () => {
    window.location.href = 'sos-alert.html';
  });
  document.getElementById('btn-timeline-log')?.addEventListener('click', () => showToast('Timeline log fetched for last 24h.'));
  document.getElementById('btn-share-link')?.addEventListener('click', () => showToast('Encrypted live location share link copied to clipboard!'));
});
