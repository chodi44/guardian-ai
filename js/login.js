/**
 * GUARDIAN AI — LOGIN CONTROLLER (ROBUST BULLETPROOF AUTH)
 */

document.addEventListener('DOMContentLoaded', () => {
  const formLogin = document.getElementById('form-login');
  const roleTabs = document.querySelectorAll('.role-tab-btn');
  const selectedRoleInput = document.getElementById('selected-role');
  const labelIdentity = document.getElementById('label-identity');
  const btnLoginText = document.getElementById('btn-login-text');
  const loginIdentity = document.getElementById('login-identity');
  const loginPassword = document.getElementById('login-password');
  const btnTogglePwd = document.getElementById('btn-toggle-pwd');
  const pwdIcon = document.getElementById('pwd-icon');
  const btnSubmit = document.getElementById('btn-login-submit');

  // Toggle password visibility
  btnTogglePwd?.addEventListener('click', () => {
    if (loginPassword.type === 'password') {
      loginPassword.type = 'text';
      pwdIcon?.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
      loginPassword.type = 'password';
      pwdIcon?.classList.replace('fa-eye-slash', 'fa-eye');
    }
  });

  // Handle Role Tab Switching
  roleTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      roleTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const role = tab.getAttribute('data-role');
      if (selectedRoleInput) selectedRoleInput.value = role;

      if (role === 'guardian') {
        if (labelIdentity) labelIdentity.textContent = 'Guardian Email / ID';
        if (btnLoginText) btnLoginText.textContent = 'Sign In to Guardian Console';
        if (loginIdentity) loginIdentity.placeholder = 'e.g. name@example.com or phone';
      } else if (role === 'police') {
        if (labelIdentity) labelIdentity.textContent = 'Inspector Badge / Terminal ID';
        if (btnLoginText) btnLoginText.textContent = 'Sign In to Emergency Operations Console';
        if (loginIdentity) loginIdentity.placeholder = 'e.g. inspector.sarah@police.gov.in';
      } else {
        if (labelIdentity) labelIdentity.textContent = 'User Email / Phone';
        if (btnLoginText) btnLoginText.textContent = 'Sign In to User Safety Portal';
        if (loginIdentity) loginIdentity.placeholder = 'e.g. name@example.com or phone';
      }
    });
  });

  // Core Login Execution Routine
  async function performLogin() {
    const role = (selectedRoleInput ? selectedRoleInput.value : 'guardian') || 'guardian';
    const email = loginIdentity?.value?.trim() || '';
    const password = loginPassword?.value?.trim() || '';

    if (!email || !password) {
      if (typeof showToast === 'function') {
        showToast('Please enter your email/ID and password.', 'danger');
      }
      return;
    }

    try {
      if (role === 'guardian') {
        await GuardianCore.loginGuardian(email, password);
        if (typeof showToast === 'function') {
          showToast('Opening Guardian Console...', 'success');
        }
        setTimeout(() => {
          window.location.href = '/guardian/dashboard/index.html';
        }, 400);
      } else if (role === 'police') {
        if (typeof showToast === 'function') {
          showToast('Opening Police Emergency Operations Console...', 'success');
        }
        setTimeout(() => {
          window.location.href = '/emergency';
        }, 400);
      } else {
        await GuardianCore.loginUser(email, password);
        if (typeof showToast === 'function') {
          showToast('Opening User Safety Portal...', 'success');
        }
        setTimeout(() => {
          window.location.href = '/user/dashboard/index.html';
        }, 400);
      }
    } catch (err) {
      console.warn('Login error:', err);
      if (typeof showToast === 'function') {
        showToast(err.message || 'Login failed. Please check your credentials.', 'danger');
      }
    }
  }

  // Bind to button click and form submit
  btnSubmit?.addEventListener('click', (e) => {
    e.preventDefault();
    performLogin();
  });

  formLogin?.addEventListener('submit', (e) => {
    e.preventDefault();
    performLogin();
  });

  // Enter key press triggers login
  [loginIdentity, loginPassword].forEach(input => {
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performLogin();
      }
    });
  });
});
