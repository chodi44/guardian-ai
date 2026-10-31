document.addEventListener('DOMContentLoaded', () => {
  // Weekly Chart
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
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 0, max: 50, grid: { color: 'rgba(226, 232, 240, 0.6)' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // Topology Map
  try {
    const topologyMap = L.map('insights-topology-map', { zoomControl: false }).setView([centerLat, centerLng], 13);
    L.tileLayer(mapTileUrl, { attribution: mapAttribution, maxZoom: 19 }).addTo(topologyMap);
    L.circle([centerLat, centerLng], { color: '#10b981', fillColor: '#10b981', fillOpacity: 0.1, radius: 2500 }).addTo(topologyMap);
    setTimeout(() => topologyMap.invalidateSize(), 300);
  } catch (err) {
    console.log('Topology map init:', err);
  }

  document.getElementById('btn-export-dossier')?.addEventListener('click', () => showToast('Safety Insights Dossier exported as PDF'));
  document.getElementById('btn-expand-topology-map')?.addEventListener('click', () => showToast('Map expanded to full screen mode.'));
});
