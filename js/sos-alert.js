document.addEventListener('DOMContentLoaded', () => {
  // Initialize SOS Tactical Map
  try {
    const sosLat = 16.9890;
    const sosLng = 81.7840;

    const sosMap = L.map('sos-tactical-map', { zoomControl: false }).setView([sosLat, sosLng], 15);
    L.tileLayer(mapTileUrl, { attribution: mapAttribution, maxZoom: 19 }).addTo(sosMap);

    L.circle([sosLat, sosLng], {
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 0.25,
      radius: 350,
      weight: 2
    }).addTo(sosMap);

    const sosIcon = L.divIcon({
      className: 'custom-sos-marker',
      html: `<div style="width:24px;height:24px;background:#ef4444;border:3px solid #ffffff;border-radius:50%;box-shadow:0 0 15px rgba(239,68,68,0.9);animation:pulseRed 1s infinite"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    L.marker([sosLat, sosLng], { icon: sosIcon }).addTo(sosMap).bindPopup('<b>Ananya (SOS Trigger Point)</b><br>Alcot Gardens').openPopup();
    L.marker([16.9920, 81.7890]).addTo(sosMap).bindPopup('Town Police Station (420m away)');

    setTimeout(() => sosMap.invalidateSize(), 300);
  } catch (err) {
    console.log('SOS map init:', err);
  }

  document.getElementById('btn-ack-tone')?.addEventListener('click', () => showToast('Audio alarm acknowledged & muted.'));
  document.getElementById('btn-trigger-siren')?.addEventListener('click', () => showToast('⚠️ High-decibel emergency siren triggered on Band!', 'danger'));
  document.getElementById('btn-share-police-link')?.addEventListener('click', () => showToast('Police dispatch tracking payload generated.'));
});
