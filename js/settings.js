/**
 * GUARDIAN AI — SETTINGS & PRIVACY CONTROLLER
 */

document.addEventListener('DOMContentLoaded', () => {
  // Segmented Control Button Switching
  const segBtns = document.querySelectorAll('.segmented-control .seg-btn');
  segBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      segBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showToast(`Cadence Sensitivity set to: ${btn.textContent.trim()}`);
    });
  });

  // Toggle Checkbox Interactivity
  const switches = document.querySelectorAll('.switch input[type="checkbox"]');
  switches.forEach(sw => {
    sw.addEventListener('change', function() {
      const label = this.closest('.toggle-row')?.querySelector('strong')?.textContent.trim() || 'Setting';
      const status = this.checked ? 'ENABLED' : 'DISABLED';
      showToast(`${label} is now ${status}`);
    });
  });

  document.getElementById('btn-view-whitepaper')?.addEventListener('click', () => showToast('Guardian AI Zero-Knowledge Whitepaper opened (PDF).'));
  document.getElementById('btn-download-audit-log')?.addEventListener('click', () => showToast('Cryptographic Audit Log downloaded.'));
});
