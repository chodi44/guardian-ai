/**
 * GUARDIAN AI — CORE STATE & AUTHENTICATION ENGINE
 * Connected to Node.js Backend & MongoDB / Mongoose API
 * Manages User & Guardian accounts, GuardianLink handshakes,
 * permissions, sessions, and reactive portal states.
 */

(function () {
  const STORAGE_KEYS = {
    USERS: 'gdn_portal_users',
    GUARDIANS: 'gdn_portal_guardians',
    LINKS: 'gdn_portal_links',
    SESSION: 'gdn_portal_session',
    CLEANED_DEMO: 'gdn_fresh_start_v1'
  };

  // Clean old demo seeds if present so user starts freshly
  function cleanDemoArtifacts() {
    try {
      if (!localStorage.getItem(STORAGE_KEYS.CLEANED_DEMO)) {
        const storedUsers = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
        const storedGuardians = JSON.parse(localStorage.getItem(STORAGE_KEYS.GUARDIANS) || '[]');
        
        // If users only contain demo accounts like ananya, remove them
        const filteredUsers = storedUsers.filter(u => u.email !== 'ananya@sentinel-ai.com' && u.id !== 'usr_ananya_01');
        const filteredGuardians = storedGuardians.filter(g => g.email !== 'ravi@sentinel-ai.com' && g.id !== 'gdn_ravi_01');

        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filteredUsers));
        localStorage.setItem(STORAGE_KEYS.GUARDIANS, JSON.stringify(filteredGuardians));
        
        const currentSession = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION) || 'null');
        if (currentSession && (currentSession.id === 'usr_ananya_01' || currentSession.id === 'gdn_ravi_01')) {
          localStorage.removeItem(STORAGE_KEYS.SESSION);
          localStorage.removeItem('currentUserRole');
        }

        localStorage.setItem(STORAGE_KEYS.CLEANED_DEMO, 'true');
      }
    } catch (e) {
      console.warn('LocalStorage cleaning warning:', e);
    }
  }

  cleanDemoArtifacts();

  // Storage Helpers
  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveUsers(users) {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch (e) {}
  }

  function getGuardians() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.GUARDIANS) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveGuardians(guardians) {
    try {
      localStorage.setItem(STORAGE_KEYS.GUARDIANS, JSON.stringify(guardians));
    } catch (e) {}
  }

  function getLinks() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.LINKS) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveLinks(links) {
    try {
      localStorage.setItem(STORAGE_KEYS.LINKS, JSON.stringify(links));
    } catch (e) {}
  }

  function generateGuardianId() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'GDN-';
    for (let i = 0; i < 7; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Session Management
  function getSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(sessionData) {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionData));
    } catch (e) {}
  }

  function clearSession() {
    try {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
      localStorage.removeItem('currentUserRole');
    } catch (e) {}
  }

  function getCurrentUser() {
    const session = getSession();
    if (session && session.role === 'user') {
      return session;
    }
    const users = getUsers();
    if (session && session.id) {
      return users.find(u => u.id === session.id || u._id === session.id) || session;
    }
    return null;
  }

  function getCurrentGuardian() {
    const session = getSession();
    if (session && session.role === 'guardian') {
      return session;
    }
    const guardians = getGuardians();
    if (session && session.id) {
      return guardians.find(g => g.id === session.id || g._id === session.id) || session;
    }
    return null;
  }

  // Auth Operations
  const GuardianCore = {
    generateGuardianId,
    getSession,
    setSession,
    clearSession,
    getCurrentUser,
    getCurrentGuardian,

    requireAuth(expectedRole, redirectFallback) {
      const session = getSession();
      if (!session || session.role !== expectedRole) {
        let target = redirectFallback;
        if (!target) {
          target = expectedRole === 'user' ? '/user/login/index.html' : '/guardian/login/index.html';
        }
        window.location.href = target;
        return null;
      }
      return expectedRole === 'user' ? getCurrentUser() : getCurrentGuardian();
    },

    logout(redirectUrl) {
      clearSession();
      let target = redirectUrl || '/login.html';
      if (target === '/user/login' || target === '/user/login/') target = '/user/login/index.html';
      else if (target === '/guardian/login' || target === '/guardian/login/') target = '/guardian/login/index.html';
      else if (target === '/user/register' || target === '/user/register/') target = '/user/register/index.html';
      else if (target === '/guardian/register' || target === '/guardian/register/') target = '/guardian/register/index.html';
      window.location.href = target;
    },

    // User Registration
    async registerUser(data) {
      const res = await fetch('/api/auth/register-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Failed to create user account.');
      }

      const u = result.user;
      const userObj = {
        id: u._id || u.id,
        _id: u._id || u.id,
        role: 'user',
        guardianId: u.guardianId,
        fullName: u.fullName,
        name: u.fullName,
        email: u.email,
        phone: u.phone,
        dob: u.dob,
        gender: u.gender,
        avatar: u.avatar,
        emergencyProfile: u.emergencyProfile || {},
        createdAt: u.createdAt
      };

      setSession(userObj);
      localStorage.setItem('currentUserRole', 'user');

      const users = getUsers();
      users.push(userObj);
      saveUsers(users);

      // Keep legacy band_user_profile in sync
      try {
        localStorage.setItem('band_user_profile', JSON.stringify({
          name: userObj.fullName,
          id: userObj.guardianId,
          emergencyPhone: userObj.phone,
          bloodGroup: userObj.emergencyProfile?.bloodGroup || 'Not specified'
        }));
      } catch (e) {}

      return userObj;
    },

    // User Login
    async loginUser(email, password) {
      const res = await fetch('/api/auth/login-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Invalid email or password.');
      }

      const u = result.user;
      const userObj = {
        id: u._id || u.id,
        _id: u._id || u.id,
        role: 'user',
        guardianId: u.guardianId,
        fullName: u.fullName,
        name: u.fullName,
        email: u.email,
        phone: u.phone,
        dob: u.dob,
        gender: u.gender,
        avatar: u.avatar,
        emergencyProfile: u.emergencyProfile || {},
        createdAt: u.createdAt
      };

      setSession(userObj);
      localStorage.setItem('currentUserRole', 'user');

      const users = getUsers();
      const existingIdx = users.findIndex(x => (x.id === userObj.id || x.email === userObj.email));
      if (existingIdx >= 0) users[existingIdx] = userObj;
      else users.push(userObj);
      saveUsers(users);

      return userObj;
    },

    // Guardian Registration
    async registerGuardian(data) {
      const res = await fetch('/api/auth/register-guardian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Failed to create guardian account.');
      }

      const g = result.guardian;
      const guardianObj = {
        id: g._id || g.id,
        _id: g._id || g.id,
        role: 'guardian',
        fullName: g.fullName,
        name: g.fullName,
        email: g.email,
        phone: g.phone,
        relationship: g.relationship,
        city: g.city,
        avatar: g.avatar,
        notifications: g.notifications || {},
        createdAt: g.createdAt
      };

      setSession(guardianObj);
      localStorage.setItem('currentUserRole', 'guardian');

      const guardians = getGuardians();
      guardians.push(guardianObj);
      saveGuardians(guardians);

      // Keep legacy guardian_profile in sync
      try {
        localStorage.setItem('guardian_profile', JSON.stringify({
          name: guardianObj.fullName,
          email: guardianObj.email,
          phone: guardianObj.phone,
          relationship: guardianObj.relationship,
          city: guardianObj.city
        }));
      } catch (e) {}

      return guardianObj;
    },

    // Guardian Login
    async loginGuardian(email, password) {
      const res = await fetch('/api/auth/login-guardian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Invalid email or password.');
      }

      const g = result.guardian;
      const guardianObj = {
        id: g._id || g.id,
        _id: g._id || g.id,
        role: 'guardian',
        fullName: g.fullName,
        name: g.fullName,
        email: g.email,
        phone: g.phone,
        relationship: g.relationship,
        city: g.city,
        avatar: g.avatar,
        notifications: g.notifications || {},
        createdAt: g.createdAt
      };

      setSession(guardianObj);
      localStorage.setItem('currentUserRole', 'guardian');

      const guardians = getGuardians();
      const existingIdx = guardians.findIndex(x => (x.id === guardianObj.id || x.email === guardianObj.email));
      if (existingIdx >= 0) guardians[existingIdx] = guardianObj;
      else guardians.push(guardianObj);
      saveGuardians(guardians);

      return guardianObj;
    },

    // Profile Updates
    async updateUserProfile(userId, updates) {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...updates })
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Failed to update profile.');
      }

      const updated = result.user;
      const session = getSession();
      if (session && (session.id === userId || session._id === userId)) {
        setSession({ ...session, ...updated, id: updated._id || updated.id });
      }

      const users = getUsers();
      const idx = users.findIndex(u => u.id === userId || u._id === userId);
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...updated };
        saveUsers(users);
      }

      return updated;
    },

    async updateGuardianProfile(guardianId, updates) {
      const res = await fetch('/api/guardian/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guardianId, ...updates })
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Failed to update profile.');
      }

      const updated = result.guardian;
      const session = getSession();
      if (session && (session.id === guardianId || session._id === guardianId)) {
        setSession({ ...session, ...updated, id: updated._id || updated.id });
      }

      const guardians = getGuardians();
      const idx = guardians.findIndex(g => g.id === guardianId || g._id === guardianId);
      if (idx >= 0) {
        guardians[idx] = { ...guardians[idx], ...updated };
        saveGuardians(guardians);
      }

      return updated;
    },

    // Connection Handshake: Guardian initiates with User's Guardian ID
    async sendConnectionRequest(guardianId, targetGuardianCode) {
      const res = await fetch('/api/guardian/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guardianId, guardianCode: targetGuardianCode })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send connection request.');
      }

      // Update local storage links
      if (data.link) {
        const links = getLinks();
        const linkId = data.link._id || data.link.id;
        const idx = links.findIndex(l => (l.id === linkId || l._id === linkId));
        if (idx >= 0) links[idx] = { ...data.link, id: linkId };
        else links.push({ ...data.link, id: linkId });
        saveLinks(links);
      }

      return data.link;
    },

    // User Side: Pending Requests
    async getUserGuardianRequests(userId) {
      try {
        const res = await fetch('/api/user/requests?userId=' + encodeURIComponent(userId));
        const data = await res.json();
        if (data.success && Array.isArray(data.requests)) {
          const links = getLinks().filter(l => l.status !== 'pending' || l.userId !== userId);
          data.requests.forEach(r => {
            links.push({ ...r, id: r._id || r.id, status: 'pending' });
          });
          saveLinks(links);
          return data.requests;
        }
      } catch (e) {
        console.warn('API error in getUserGuardianRequests:', e);
      }

      // Fallback to local cache
      return getLinks().filter(l => l.userId === userId && l.status === 'pending');
    },

    // User Side: Approved Guardians
    async getUserApprovedGuardians(userId) {
      try {
        const res = await fetch('/api/user/guardians?userId=' + encodeURIComponent(userId));
        const data = await res.json();
        if (data.success && Array.isArray(data.guardians)) {
          return data.guardians;
        }
      } catch (e) {
        console.warn('API error in getUserApprovedGuardians:', e);
      }

      return getLinks().filter(l => l.userId === userId && l.status === 'approved');
    },

    // User Side: Accept Request
    async acceptGuardianRequest(linkId) {
      const res = await fetch('/api/user/requests/' + encodeURIComponent(linkId) + '/accept', {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to approve request.');
      }

      const links = getLinks();
      const link = links.find(l => (l.id === linkId || l._id === linkId));
      if (link) {
        link.status = 'approved';
        link.approvedDate = new Date().toISOString();
        saveLinks(links);
      }

      return data.link;
    },

    // User Side: Reject Request
    async rejectGuardianRequest(linkId) {
      const res = await fetch('/api/user/requests/' + encodeURIComponent(linkId) + '/reject', {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to reject request.');
      }

      const links = getLinks();
      const link = links.find(l => (l.id === linkId || l._id === linkId));
      if (link) {
        link.status = 'rejected';
        saveLinks(links);
      }

      return data.link;
    },

    // Permissions
    async updatePermissions(linkId, newPermissions) {
      const res = await fetch('/api/user/permissions/' + encodeURIComponent(linkId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: newPermissions })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update permissions.');
      }
      return data.link;
    },

    // Guardian Side: Linked Users (Approved)
    async getGuardianLinkedUsers(guardianId) {
      try {
        const res = await fetch('/api/guardian/linked-users?guardianId=' + encodeURIComponent(guardianId));
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
          return data.users;
        }
      } catch (e) {
        console.warn('API error in getGuardianLinkedUsers:', e);
      }

      return getLinks().filter(l => l.guardianId === guardianId && l.status === 'approved');
    },

    // Guardian Side: Connection Requests History
    async getGuardianConnectionRequests(guardianId) {
      try {
        const res = await fetch('/api/guardian/connection-requests?guardianId=' + encodeURIComponent(guardianId));
        const data = await res.json();
        if (data.success && Array.isArray(data.requests)) {
          return data.requests;
        }
      } catch (e) {
        console.warn('API error in getGuardianConnectionRequests:', e);
      }

      return getLinks().filter(l => l.guardianId === guardianId);
    },

    async requestPermission(linkId, permissionKey) {
      const res = await fetch('/api/guardian/request-permission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId, permissionKey })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to request permission.');
      }
      return data.link;
    },

    // UI Helper: Profile completion calculator
    calculateProfileCompletion(user) {
      if (!user) return 0;
      let total = 8;
      let completed = 0;

      if (user.fullName) completed++;
      if (user.email) completed++;
      if (user.phone) completed++;
      if (user.dob) completed++;
      if (user.gender) completed++;
      if (user.emergencyProfile?.bloodGroup) completed++;
      if (user.emergencyProfile?.address) completed++;
      if (user.emergencyProfile?.emergencyNotes) completed++;

      return Math.round((completed / total) * 100);
    },

    // Toast Notification System
    showToast(message, type = 'info') {
      let container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = `portal-toast ${type === 'danger' ? 'toast-danger' : type === 'success' ? 'toast-success' : 'toast-info'}`;

      let icon = '<i class="fa-solid fa-circle-check"></i>';
      if (type === 'danger') icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
      if (type === 'info') icon = '<i class="fa-solid fa-circle-info"></i>';

      toast.innerHTML = `<div class="toast-content">${icon} <span>${message}</span></div>`;
      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('visible');
      }, 10);

      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    },

    // Confirmation Modal Helper
    confirmModal({ title, message, confirmText = 'Confirm', isDanger = false, onConfirm }) {
      const existing = document.getElementById('portal-confirm-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'portal-confirm-modal';
      modal.className = 'portal-modal-overlay active';
      modal.innerHTML = `
        <div class="portal-modal-box" role="dialog" aria-modal="true">
          <div class="modal-box-header">
            <h3 class="modal-title ${isDanger ? 'text-danger' : ''}">${title}</h3>
            <button class="modal-close-btn" id="modal-btn-cancel-x">&times;</button>
          </div>
          <div class="modal-box-body">
            <p>${message}</p>
          </div>
          <div class="modal-box-actions">
            <button class="btn-portal-secondary" id="modal-btn-cancel">Cancel</button>
            <button class="btn-portal-primary ${isDanger ? 'btn-portal-danger' : ''}" id="modal-btn-action">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const closeModal = () => modal.remove();
      modal.querySelector('#modal-btn-cancel-x').addEventListener('click', closeModal);
      modal.querySelector('#modal-btn-cancel').addEventListener('click', closeModal);
      modal.querySelector('#modal-btn-action').addEventListener('click', () => {
        closeModal();
        if (typeof onConfirm === 'function') onConfirm();
      });
    },

    // Clipboard Copy Helper
    copyToClipboard(text, successMsg = 'Copied to clipboard!') {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          GuardianCore.showToast(successMsg, 'success');
        }).catch(() => {
          GuardianCore.fallbackCopy(text, successMsg);
        });
      } else {
        GuardianCore.fallbackCopy(text, successMsg);
      }
    },

    fallbackCopy(text, successMsg) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        GuardianCore.showToast(successMsg, 'success');
      } catch (err) {
        GuardianCore.showToast('Failed to copy. Please copy manually.', 'danger');
      }
      document.body.removeChild(textArea);
    },

    // Mobile Drawer & Navigation Dock Controller
    initMobileNavigation() {
      const sidebar = document.querySelector('.portal-sidebar');
      const overlay = document.getElementById('portal-sidebar-overlay');
      const openBtn = document.getElementById('mobile-sidebar-toggle-btn');
      const dockMenuBtn = document.getElementById('dock-menu-toggle-btn');
      const closeBtn = document.getElementById('mobile-sidebar-close-btn');

      if (!sidebar) return;

      function openSidebar() {
        sidebar.classList.add('mobile-open');
        if (overlay) overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      }

      function closeSidebar() {
        sidebar.classList.remove('mobile-open');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
      }

      if (openBtn) openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openSidebar();
      });

      if (dockMenuBtn) dockMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openSidebar();
      });

      if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
      if (overlay) overlay.addEventListener('click', closeSidebar);

      // Close drawer when clicking any link inside the sidebar
      sidebar.querySelectorAll('.portal-nav-item, .spa-nav-link').forEach(link => {
        link.addEventListener('click', () => {
          if (window.innerWidth <= 900) {
            closeSidebar();
          }
        });
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('mobile-open')) {
          closeSidebar();
        }
      });
    }
  };

  window.GuardianCore = GuardianCore;

  // Auto-bind mobile navigation when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => GuardianCore.initMobileNavigation());
  } else {
    GuardianCore.initMobileNavigation();
  }
})();

