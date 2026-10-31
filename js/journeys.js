document.addEventListener('DOMContentLoaded', () => {
  try {
    const journeyMap = L.map('journey-route-map', { zoomControl: false }).setView([12.9716, 77.5946], 12);
    L.tileLayer(mapTileUrl, { attribution: mapAttribution, maxZoom: 19 }).addTo(journeyMap);

    const bgrCoords = [
      [12.9900, 77.5700], // Campus East Gate
      [12.9780, 77.6000], // Detour point
      [12.9650, 77.6200]  // Home
    ];

    L.polyline(bgrCoords, { color: '#2563eb', weight: 4, dashArray: '8, 8' }).addTo(journeyMap);
    L.marker([12.9780, 77.6000]).addTo(journeyMap).bindPopup('Detour Flagged (+40m offset)');

    setTimeout(() => journeyMap.invalidateSize(), 300);
  } catch (err) {
    console.log('Journey map init:', err);
  }

  drawECG('journey-hr-canvas');

  document.getElementById('btn-share-journey-link')?.addEventListener('click', () => showToast('Journey share link generated & copied.'));
  document.getElementById('btn-trigger-guard-checkin')?.addEventListener('click', () => showToast('Check-in ping dispatched to Ananya\'s band.'));
});
