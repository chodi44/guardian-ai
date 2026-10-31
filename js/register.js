/**
 * GUARDIAN AI — REGISTER CONTROLLER
 * Captures Guardian Profile and Complete Police Missing Person Search Dossier.
 */

document.addEventListener('DOMContentLoaded', () => {
  const formRegister = document.getElementById('form-register');

  formRegister?.addEventListener('submit', (e) => {
    e.preventDefault();

    // 1. Guardian Details
    const guardianName = document.getElementById('reg-guardian-name').value.trim();
    const guardianEmail = document.getElementById('reg-guardian-email').value.trim();
    const guardianPhone = document.getElementById('reg-guardian-phone').value.trim();
    const guardianAddress = document.getElementById('reg-guardian-address').value.trim();

    // 2. Band User Police Dossier Details
    const bandUserName = document.getElementById('reg-banduser-name').value.trim();
    const bandUserDob = document.getElementById('reg-banduser-dob').value.trim();
    const bandUserGender = document.getElementById('reg-banduser-gender').value.trim();
    const bandUserPhoto = document.getElementById('reg-banduser-photo').value.trim();
    const bandUserHeight = document.getElementById('reg-banduser-height').value.trim();
    const bandUserHairEyes = document.getElementById('reg-banduser-hair-eyes').value.trim();
    const bandUserMarks = document.getElementById('reg-banduser-marks').value.trim();
    const bandUserBlood = document.getElementById('reg-banduser-blood').value.trim();
    const bandDeviceId = document.getElementById('reg-band-device').value.trim();
    const bandUserLocations = document.getElementById('reg-banduser-locations').value.trim();

    const guardianData = {
      name: guardianName || 'Ravi Sharma',
      email: guardianEmail || 'ravi.sharma@sentinel-ai.com',
      phone: guardianPhone || '+91 98480 23145',
      id: 'GDN-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      relationship: 'Parent (Primary Guardian)',
      secondaryContact: 'Priya Sharma (Mother) +91 98480 23146',
      address: guardianAddress || 'Green Acres, Rajahmundry, AP'
    };

    const bandUserData = {
      name: bandUserName || 'Ananya Sharma',
      id: 'GDN-PER-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      dob: bandUserDob || '14 Apr 2007 (19 yrs)',
      gender: bandUserGender || 'Female',
      photo: bandUserPhoto || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80',
      heightWeight: bandUserHeight || '5 ft 6 in (168 cm) / 54 kg',
      hairEyes: bandUserHairEyes || 'Dark Brown Hair, Black Eyes',
      distinguishingMarks: bandUserMarks || 'Small birthmark on left wrist, wears round glasses',
      bloodGroup: bandUserBlood || 'O+ Positive',
      medicalConditions: 'Mild Asthma (Inhaler equipped)',
      bandId: bandDeviceId || 'GB-V3-982',
      frequentLocations: bandUserLocations || 'SRM University Campus, Central Library, Green Arcade',
      geofenceRadius: '1.5 km (SRM Campus)',
      hapticSensitivity: 'High (Level 4)',
      emergencyPhone: guardianPhone || '+91 98480 23145'
    };

    localStorage.setItem('guardian_profile', JSON.stringify(guardianData));
    localStorage.setItem('band_user_profile', JSON.stringify(bandUserData));
    localStorage.setItem('currentUserRole', 'guardian');

    if (window.GuardianCore && typeof window.GuardianCore.syncWithLegacyBand === 'function') {
      try {
        window.GuardianCore.syncWithLegacyBand();
      } catch (err) {
        console.warn('GuardianCore sync error:', err);
      }
    }

    showToast('Guardian Account & Police Missing Person Search Dossier registered successfully!');
    setTimeout(() => {
      window.location.href = 'profile.html';
    }, 1000);
  });
});
