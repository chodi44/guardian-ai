document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-threshold-config')?.addEventListener('click', () => showToast('Threshold configuration modal opened.'));
  document.getElementById('btn-run-corridor-diag')?.addEventListener('click', () => showToast('Corridor diagnostics: All 14 sensors 100% nominal.'));

  // Filter tabs
  const tabBtns = document.querySelectorAll('.filter-tabs .tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showToast(`Filtered by: ${btn.textContent.trim()}`);
    });
  });
});
