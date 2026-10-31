document.addEventListener('DOMContentLoaded', () => {
  // Initialize Home Map
  try {
    const homeMap = L.map('home-map', { zoomControl: false }).setView([centerLat, centerLng], 14);
    L.tileLayer(mapTileUrl, { attribution: mapAttribution, maxZoom: 19 }).addTo(homeMap);

    // Geofence Circle (1.5 km)
    L.circle([centerLat, centerLng], {
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.12,
      radius: 1500,
      weight: 2,
      dashArray: '6, 6'
    }).addTo(homeMap);

    // Marker
    const pulsingIcon = L.divIcon({
      className: 'custom-pulse-marker',
      html: `<div style="width:16px;height:16px;background:#2563eb;border:3px solid #ffffff;border-radius:50%;box-shadow:0 0 10px rgba(37,99,235,0.8)"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    L.marker([centerLat, centerLng], { icon: pulsingIcon })
      .addTo(homeMap)
      .bindPopup('<b>Ananya</b><br>Inside Safe Geofence').openPopup();

    setTimeout(() => homeMap.invalidateSize(), 300);
  } catch (err) {
    console.log('Home map init:', err);
  }

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
});
