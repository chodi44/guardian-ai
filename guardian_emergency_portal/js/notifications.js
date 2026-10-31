let toasts = [];

function getIcon(type) {
  switch (type) {
    case 'success': return `<i data-lucide="check-circle" class="text-success" style="width: 18px; height: 18px;"></i>`;
    case 'error': return `<i data-lucide="shield-alert" class="text-error" style="width: 18px; height: 18px;"></i>`;
    case 'warning': return `<i data-lucide="alert-triangle" class="text-warning" style="width: 18px; height: 18px;"></i>`;
    default: return `<i data-lucide="info" class="text-secondary" style="width: 18px; height: 18px;"></i>`;
  }
}

export function showToast(title, message = '', type = 'info') {
  // Prevent stacking of identical toasts
  if (toasts.some(t => t.title === title && t.message === message)) {
    return;
  }

  const id = Math.random().toString(36).substring(2, 9);
  const toast = { id, type, title, message };
  toasts.push(toast);

  renderToasts();

  setTimeout(() => {
    removeToast(id);
  }, 4000);
}

export function removeToast(id) {
  toasts = toasts.filter(t => t.id !== id);
  renderToasts();
}

function renderToasts() {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  container.innerHTML = toasts.map(toast => `
    <div id="toast-${toast.id}" class="toast-item animate-slide-up">
      <div class="mt-0.5">${getIcon(toast.type)}</div>
      <div class="flex-1">
        <h4>${toast.title}</h4>
        ${toast.message ? `<p>${toast.message}</p>` : ''}
      </div>
      <button onclick="window.removeToast('${toast.id}')" title="Dismiss">
        <i data-lucide="x" style="width: 14px; height: 14px;"></i>
      </button>
    </div>
  `).join('');
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

window.removeToast = removeToast;
window.showToast = showToast;
