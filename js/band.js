document.addEventListener('DOMContentLoaded', () => {
  drawECG('band-ecg-live-canvas');

  document.getElementById('btn-calibrate-baseline')?.addEventListener('click', () => showToast('Biometric Baseline calibrated successfully.'));
});
