export function init() {
  const toggles = {
    timeout: true,
    heartRate: true,
    impact: true,
    geofence: false
  };

  const toggleInputs = document.querySelectorAll('.setting-toggle-input');
  
  toggleInputs.forEach(input => {
    const key = input.getAttribute('data-key');
    if (key && toggles.hasOwnProperty(key)) {
      input.checked = toggles[key];
    }

    input.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      toggles[key] = isChecked;
      
      // Optional: Add logic to save state to backend/local storage here
    });
  });
}
