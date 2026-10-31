document.addEventListener('DOMContentLoaded', () => {
  drawECG('ecg-preview-canvas');

  document.getElementById('btn-launch-dashboard')?.addEventListener('click', () => {
    showToast('Guardian Profile successfully provisioned!');
    setTimeout(() => {
      window.location.href = 'home.html';
    }, 400);
  });
});
