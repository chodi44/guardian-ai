document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-back-to-welcome')?.addEventListener('click', () => {
    window.location.href = 'welcome.html';
  });
  document.getElementById('btn-goto-step2')?.addEventListener('click', () => {
    window.location.href = 'onboarding-step2.html';
  });
});
