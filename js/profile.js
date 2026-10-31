/**
 * GUARDIAN AI — PROFILE CONTROLLER
 * Manages Guardian Profile, Band User Police Missing Person Dossier, Role Permissions, and Dynamic Modals.
 */

document.addEventListener('DOMContentLoaded', () => {

  // Default Profiles Data Initialization
  const defaultGuardian = {
    name: 'Ravi Sharma',
    email: 'ravi.sharma@sentinel-ai.com',
    phone: '+91 98480 23145',
    id: 'GDN-7A92K4',
    relationship: 'Parent (Father)',
    secondaryContact: 'Priya Sharma (Mother) +91 98480 23146',
    address: 'Green Acres, Rajahmundry, AP'
  };

  const defaultBandUser = {
    name: 'Ananya Sharma',
    id: 'GDN-PER-82A7X9',
    dob: '14 Apr 2007 (19 yrs)',
    gender: 'Female',
    photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80',
    heightWeight: '5 ft 6 in (168 cm) / 54 kg',
    hairEyes: 'Dark Brown Hair, Black Eyes',
    distinguishingMarks: 'Small birthmark on left wrist, wears round glasses',
    bloodGroup: 'O+ Positive (Mild Asthma - Inhaler equipped)',
    medicalConditions: 'Mild Asthma (Inhaler equipped)',
    bandId: 'GB-V3-982',
    frequentLocations: 'SRM University Campus, Central Library, Green Arcade',
    geofenceRadius: '1.5 km (SRM Campus)',
    hapticSensitivity: 'High (Level 4)',
    emergencyPhone: '+91 98480 23145'
  };

  function getGuardianData() {
    try {
      return JSON.parse(localStorage.getItem('guardian_profile')) || defaultGuardian;
    } catch (e) {
      return defaultGuardian;
    }
  }

  function getBandUserData() {
    try {
      return JSON.parse(localStorage.getItem('band_user_profile')) || defaultBandUser;
    } catch (e) {
      return defaultBandUser;
    }
  }

  function getCurrentRole() {
    return localStorage.getItem('currentUserRole') || 'guardian';
  }

  // --- RENDER UI DATA ---
  function renderProfiles() {
    const guardian = getGuardianData();
    const bandUser = getBandUserData();
    const role = getCurrentRole();

    // 1. Guardian Header Elements
    const gDisplayName = document.getElementById('g-display-name');
    const gDisplayRel = document.getElementById('g-display-rel');
    const gDisplayId = document.getElementById('g-display-id');
    const dispGName = document.getElementById('disp-g-name');
    const dispGPhone = document.getElementById('disp-g-phone');
    const dispGEmail = document.getElementById('disp-g-email');
    const dispGRel = document.getElementById('disp-g-rel');
    const dispGSecondary = document.getElementById('disp-g-secondary');
    const dispGAddress = document.getElementById('disp-g-address');

    if (gDisplayName) gDisplayName.textContent = guardian.name;
    if (gDisplayRel) gDisplayRel.textContent = guardian.relationship + ' & Primary Responder';
    if (gDisplayId) gDisplayId.textContent = guardian.id;
    if (dispGName) dispGName.textContent = guardian.name;
    if (dispGPhone) dispGPhone.textContent = guardian.phone;
    if (dispGEmail) dispGEmail.textContent = guardian.email;
    if (dispGRel) dispGRel.textContent = guardian.relationship;
    if (dispGSecondary) dispGSecondary.textContent = guardian.secondaryContact;
    if (dispGAddress) dispGAddress.textContent = guardian.address;

    // 2. Band User Police Dossier Elements
    const dispBPhoto = document.getElementById('disp-b-photo');
    const dispBName = document.getElementById('disp-b-name');
    const dispBId = document.getElementById('disp-b-id');
    const dispBGender = document.getElementById('disp-b-gender');
    const dispBDob = document.getElementById('disp-b-dob');
    const dispBHeight = document.getElementById('disp-b-height');
    const dispBHairEyes = document.getElementById('disp-b-hair-eyes');
    const dispBMarks = document.getElementById('disp-b-marks');
    const dispBBlood = document.getElementById('disp-b-blood');
    const dispBLocations = document.getElementById('disp-b-locations');
    const dispBDevice = document.getElementById('disp-b-device');
    const dispBPhone = document.getElementById('disp-b-phone');
    const sidebarDepName = document.getElementById('sidebar-dep-name');

    if (dispBPhoto) dispBPhoto.src = bandUser.photo || defaultBandUser.photo;
    if (dispBName) dispBName.textContent = bandUser.name;
    if (sidebarDepName) sidebarDepName.textContent = bandUser.name.split(' ')[0];
    if (dispBId) dispBId.textContent = bandUser.id;
    if (dispBGender) dispBGender.textContent = bandUser.gender || 'Female';
    if (dispBDob) dispBDob.textContent = bandUser.dob || '14 Apr 2007 (19 yrs)';
    if (dispBHeight) dispBHeight.textContent = bandUser.heightWeight || '5 ft 6 in (168 cm) / 54 kg';
    if (dispBHairEyes) dispBHairEyes.textContent = bandUser.hairEyes || 'Dark Brown Hair, Black Eyes';
    if (dispBMarks) dispBMarks.textContent = bandUser.distinguishingMarks || 'Small birthmark on left wrist, wears round glasses';
    if (dispBBlood) dispBBlood.textContent = bandUser.bloodGroup || 'O+ Positive';
    if (dispBLocations) dispBLocations.textContent = bandUser.frequentLocations || 'SRM University Campus, Central Library';
    if (dispBDevice) dispBDevice.textContent = bandUser.bandId;
    if (dispBPhone) dispBPhone.textContent = bandUser.emergencyPhone;

    // 3. Role Banner & Permission Control Updates
    const bannerRoleIcon = document.getElementById('banner-role-icon');
    const bannerRoleTitle = document.getElementById('banner-role-title');
    const bannerRoleDesc = document.getElementById('banner-role-desc');
    const btnToggleRoleText = document.getElementById('btn-toggle-role-text');
    const bandUserPermissionBadge = document.getElementById('banduser-permission-badge');
    const btnEditBandUserText = document.getElementById('btn-edit-banduser-text');
    const bandUserEditHint = document.getElementById('banduser-edit-hint');
    const btnOpenEditBandUser = document.getElementById('btn-open-edit-banduser');

    if (role === 'guardian') {
      if (bannerRoleIcon) bannerRoleIcon.innerHTML = '<i class="fa-solid fa-user-shield"></i>';
      if (bannerRoleTitle) bannerRoleTitle.textContent = `Active Role: Primary Guardian (${guardian.name})`;
      if (bannerRoleDesc) bannerRoleDesc.textContent = 'Full Edit Rights: Guardian can edit Guardian details & Police Missing Person Dossier.';
      if (btnToggleRoleText) btnToggleRoleText.textContent = 'Test as Band User';
      
      if (bandUserPermissionBadge) {
        bandUserPermissionBadge.className = 'pill-badge pill-safe';
        bandUserPermissionBadge.innerHTML = '<i class="fa-solid fa-unlock"></i> Editable by Guardian';
      }
      if (btnEditBandUserText) btnEditBandUserText.textContent = 'Edit Missing Person Dossier (Guardian Unlocked)';
      if (btnOpenEditBandUser) {
        btnOpenEditBandUser.style.opacity = '1';
        btnOpenEditBandUser.style.cursor = 'pointer';
      }
      if (bandUserEditHint) {
        bandUserEditHint.innerHTML = '<i class="fa-solid fa-circle-check text-safe"></i> You are logged in as Guardian. All missing person details can be edited.';
      }
    } else {
      if (bannerRoleIcon) bannerRoleIcon.innerHTML = '<i class="fa-solid fa-stopwatch text-purple"></i>';
      if (bannerRoleTitle) bannerRoleTitle.textContent = `Active Role: Protected Band User (${bandUser.name})`;
      if (bannerRoleDesc) bannerRoleDesc.textContent = 'Protected View: Band User profile details can ONLY be modified by the Primary Guardian.';
      if (btnToggleRoleText) btnToggleRoleText.textContent = 'Switch to Guardian Mode';

      if (bandUserPermissionBadge) {
        bandUserPermissionBadge.className = 'pill-badge pill-warning';
        bandUserPermissionBadge.innerHTML = '<i class="fa-solid fa-lock"></i> Locked — Editable Only By Guardian';
      }
      if (btnEditBandUserText) btnEditBandUserText.textContent = 'Locked (Guardian Permission Required)';
      if (btnOpenEditBandUser) {
        btnOpenEditBandUser.style.opacity = '0.75';
        btnOpenEditBandUser.style.cursor = 'not-allowed';
      }
      if (bandUserEditHint) {
        bandUserEditHint.innerHTML = '<i class="fa-solid fa-lock text-warning"></i> Access Restricted: Only Primary Guardian accounts can edit Police Dossier details.';
      }
    }
  }

  renderProfiles();

  // --- ROLE TOGGLE BUTTON ---
  document.getElementById('btn-toggle-active-role')?.addEventListener('click', () => {
    const currentRole = getCurrentRole();
    const newRole = currentRole === 'guardian' ? 'band_user' : 'guardian';
    localStorage.setItem('currentUserRole', newRole);
    renderProfiles();
    
    if (newRole === 'guardian') {
      showToast('Switched to Guardian Mode (Full Edit Rights Enabled).');
    } else {
      showToast('Switched to Band User View (Police Dossier Locked for Guardian only).', 'warning');
    }
  });

  // --- MODAL CONTROLS: GUARDIAN EDIT ---
  const modalEditGuardian = document.getElementById('modal-edit-guardian');
  const btnOpenEditGuardian = document.getElementById('btn-open-edit-guardian');
  const btnCloseEditG = document.getElementById('btn-close-edit-g');
  const btnCancelEditG = document.getElementById('btn-cancel-edit-g');
  const formEditGuardian = document.getElementById('form-edit-guardian');

  btnOpenEditGuardian?.addEventListener('click', () => {
    const guardian = getGuardianData();
    document.getElementById('edit-g-name').value = guardian.name || '';
    document.getElementById('edit-g-phone').value = guardian.phone || '';
    document.getElementById('edit-g-email').value = guardian.email || '';
    document.getElementById('edit-g-rel').value = guardian.relationship || '';
    document.getElementById('edit-g-address').value = guardian.address || '';

    if (modalEditGuardian) modalEditGuardian.classList.add('active-modal');
  });

  function closeGuardianModal() {
    if (modalEditGuardian) modalEditGuardian.classList.remove('active-modal');
  }

  btnCloseEditG?.addEventListener('click', closeGuardianModal);
  btnCancelEditG?.addEventListener('click', closeGuardianModal);

  formEditGuardian?.addEventListener('submit', (e) => {
    e.preventDefault();
    const current = getGuardianData();
    const updated = {
      ...current,
      name: document.getElementById('edit-g-name').value.trim(),
      phone: document.getElementById('edit-g-phone').value.trim(),
      email: document.getElementById('edit-g-email').value.trim(),
      relationship: document.getElementById('edit-g-rel').value.trim(),
      address: document.getElementById('edit-g-address').value.trim()
    };
    localStorage.setItem('guardian_profile', JSON.stringify(updated));
    closeGuardianModal();
    renderProfiles();
    showToast('Guardian Profile updated successfully!');
  });

  // --- MODAL CONTROLS: BAND USER POLICE DOSSIER EDIT (GUARDIAN AUTHORIZED) ---
  const modalEditBandUser = document.getElementById('modal-edit-banduser');
  const btnOpenEditBandUser = document.getElementById('btn-open-edit-banduser');
  const btnCloseEditB = document.getElementById('btn-close-edit-b');
  const btnCancelEditB = document.getElementById('btn-cancel-edit-b');
  const formEditBandUser = document.getElementById('form-edit-banduser');

  btnOpenEditBandUser?.addEventListener('click', () => {
    const role = getCurrentRole();
    if (role !== 'guardian') {
      showToast('Permission Denied: Band User profile details can only be edited by the Primary Guardian.', 'danger');
      return;
    }

    const bandUser = getBandUserData();
    document.getElementById('edit-b-name').value = bandUser.name || '';
    document.getElementById('edit-b-dob').value = bandUser.dob || '';
    document.getElementById('edit-b-gender').value = bandUser.gender || '';
    document.getElementById('edit-b-photo').value = bandUser.photo || '';
    document.getElementById('edit-b-height').value = bandUser.heightWeight || '';
    document.getElementById('edit-b-hair-eyes').value = bandUser.hairEyes || '';
    document.getElementById('edit-b-marks').value = bandUser.distinguishingMarks || '';
    document.getElementById('edit-b-blood').value = bandUser.bloodGroup || '';
    document.getElementById('edit-b-device').value = bandUser.bandId || '';
    document.getElementById('edit-b-locations').value = bandUser.frequentLocations || '';
    document.getElementById('edit-b-phone').value = bandUser.emergencyPhone || '';

    if (modalEditBandUser) modalEditBandUser.classList.add('active-modal');
  });

  function closeBandUserModal() {
    if (modalEditBandUser) modalEditBandUser.classList.remove('active-modal');
  }

  btnCloseEditB?.addEventListener('click', closeBandUserModal);
  btnCancelEditB?.addEventListener('click', closeBandUserModal);

  formEditBandUser?.addEventListener('submit', (e) => {
    e.preventDefault();
    const role = getCurrentRole();
    if (role !== 'guardian') {
      showToast('Permission Denied: Band User profile details can only be edited by the Primary Guardian.', 'danger');
      closeBandUserModal();
      return;
    }

    const current = getBandUserData();
    const updated = {
      ...current,
      name: document.getElementById('edit-b-name').value.trim(),
      dob: document.getElementById('edit-b-dob').value.trim(),
      gender: document.getElementById('edit-b-gender').value.trim(),
      photo: document.getElementById('edit-b-photo').value.trim(),
      heightWeight: document.getElementById('edit-b-height').value.trim(),
      hairEyes: document.getElementById('edit-b-hair-eyes').value.trim(),
      distinguishingMarks: document.getElementById('edit-b-marks').value.trim(),
      bloodGroup: document.getElementById('edit-b-blood').value.trim(),
      bandId: document.getElementById('edit-b-device').value.trim(),
      frequentLocations: document.getElementById('edit-b-locations').value.trim(),
      emergencyPhone: document.getElementById('edit-b-phone').value.trim()
    };

    localStorage.setItem('band_user_profile', JSON.stringify(updated));
    closeBandUserModal();
    renderProfiles();
    showToast('Police Missing Person Search Dossier updated successfully by Guardian!');
  });

  // Export Police Missing Person Dossier Button
  document.getElementById('btn-export-police-dossier')?.addEventListener('click', () => {
    const bandUser = getBandUserData();
    showToast(`🚨 POLICE DOSSIER GENERATED: Missing person search packet exported for ${bandUser.name} (PDF/FIR Format)`);
  });

  // Export Pass Button
  document.getElementById('btn-export-pass')?.addEventListener('click', () => {
    showToast('Guardian Master Security Token Pass downloaded (PDF/NFC encrypted).');
  });

  // Cycle Token Button
  document.getElementById('btn-cycle-token')?.addEventListener('click', () => {
    showToast('Security Key Cycled: New 256-bit Hardware Token generated.');
  });
});
