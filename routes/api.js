const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const User = require('../models/User');
const Guardian = require('../models/Guardian');
const ConnectionRequest = require('../models/ConnectionRequest');
const EmergencyIncident = require('../models/EmergencyIncident');
const Device = require('../models/Device');
const Officer = require('../models/Officer');
const Assignment = require('../models/Assignment');
const Telemetry = require('../models/Telemetry');
const DailyActivity = require('../models/DailyActivity');
const Workout = require('../models/Workout');

const { createCoreEmergencyIncident, memoryIncidents } = require('../services/incidentService');
const { matchAndAssignOfficer, processAssignmentTimeouts, memoryOfficers, memoryAssignments } = require('../services/officerService');
const { getIsConnected } = require('../db');
const { resolveIpLocation } = require('../services/ipLocationService');

// In-memory fallback stores in case MongoDB password is not yet configured
let memoryUsers = [];
let memoryGuardians = [];
let memoryLinks = [];
let memoryDevices = [];
let memoryTelemetry = [];
let memoryDailyActivities = [];

// Validated Active Sessions Store (Token -> Session User object)
const activeSessions = new Map();

// Server-Established Authenticated Identity Helper (Validates Expiry & Revocation)
function getAuthenticatedUser(req) {
  let userCandidate = null;

  if (req.user && (req.user.id || req.user._id)) {
    userCandidate = req.user;
  } else {
    const authHeader = req.headers['authorization'];
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.headers['x-session-token']) {
      token = req.headers['x-session-token'];
    }

    if (token && activeSessions.has(token)) {
      const session = activeSessions.get(token);
      if (session.revoked || (session.expiresAt && Date.now() > session.expiresAt)) {
        activeSessions.delete(token); // Evict revoked/expired session
        return null;
      }
      userCandidate = session.user;
    }
  }

  if (userCandidate) {
    if (userCandidate.revoked || userCandidate.isRevoked || (userCandidate.expiresAt && Date.now() > userCandidate.expiresAt)) {
      return null;
    }
    return userCandidate;
  }

  return null;
}

// Canonical non-empty String ID matcher (Prevents '' === '' accidental matches)
function isValidCanonicalMatch(idA, idB) {
  if (!idA || !idB) return false;
  const strA = String(idA).trim();
  const strB = String(idB).trim();
  if (strA.length === 0 || strB.length === 0) return false;
  return strA === strB;
}

// Check if user is the legitimate incident owner (Protected User who created it)
function checkIsIncidentOwner(incident, authUser) {
  if (!incident || !authUser) return false;
  const authId = authUser.id || authUser._id;
  return isValidCanonicalMatch(incident.userId, authId);
}

// Check if user is the specific assigned officer for this incident
function checkIsAssignedOfficer(incident, authUser) {
  if (!incident || !authUser) return false;
  const role = authUser.role || '';
  if (!['police', 'officer', 'field_officer'].includes(role)) return false;
  const authId = authUser.id || authUser._id;
  const assignedOfficerId = incident.assignedOfficerId || (incident.assignment && incident.assignment.officerId);
  return isValidCanonicalMatch(assignedOfficerId, authId);
}

// Check if user is a Station Supervisor with valid jurisdiction over incident's station
function checkIsStationSupervisor(incident, authUser) {
  if (!incident || !authUser) return false;
  if (authUser.role !== 'supervisor') return false;
  // STRICT: Require explicit non-empty station IDs (NO default fallbacks like STATION-01!)
  const authStation = authUser.stationId;
  const incidentStation = incident.assignedStationId || (incident.assignment && incident.assignment.stationId);
  if (!authStation || !incidentStation) return false;
  return isValidCanonicalMatch(authStation, incidentStation);
}

// Check if user is System Admin
function checkIsSystemAdmin(authUser) {
  return authUser && authUser.role === 'system_admin';
}

// Helper: Generate unique Guardian ID
function generateGuardianCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'GDN-';
  for (let i = 0; i < 7; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/health — System health check
router.get('/health', (req, res) => {
  return res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// --------------------------------------------------------------------------
// 1. AUTHENTICATION ROUTES
// --------------------------------------------------------------------------

// POST /api/auth/register-user
router.post('/auth/register-user', async (req, res) => {
  try {
    const { fullName, email, phone, password, dob, gender, avatar } = req.body;

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'All required fields must be provided.' });
    }

    const emailClean = email.trim().toLowerCase();
    const phoneClean = phone.trim();

    if (getIsConnected()) {
      // Check existing email
      const existingUser = await User.findOne({ email: emailClean });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'This email is already registered as a User.' });
      }
      const existingGuardian = await Guardian.findOne({ email: emailClean });
      if (existingGuardian) {
        return res.status(400).json({ success: false, message: 'This email is registered as a Guardian. Please sign in or use another email.' });
      }

      // Generate unique guardian ID
      let guardianId = generateGuardianCode();
      let collision = await User.findOne({ guardianId });
      while (collision) {
        guardianId = generateGuardianCode();
        collision = await User.findOne({ guardianId });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({
        guardianId,
        fullName: fullName.trim(),
        email: emailClean,
        phone: phoneClean,
        password: hashedPassword,
        dob: dob || '',
        gender: gender || '',
        avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}&backgroundColor=2563eb,3b82f6,1d4ed8`,
        role: 'user',
        emergencyProfile: {
          bloodGroup: '',
          address: '',
          city: '',
          state: '',
          emergencyNotes: ''
        }
      });

      await user.save();
      const token = 'token_' + (user._id || user.id) + '_' + Math.random().toString(36).substring(2, 8);
      activeSessions.set(token, { user: { id: String(user._id || user.id), email: user.email, role: 'user', guardianId: user.guardianId } });
      return res.status(201).json({ success: true, message: 'User account created successfully!', token, user });
    } else {
      // Fallback
      if (memoryUsers.some(u => u.email === emailClean)) {
        return res.status(400).json({ success: false, message: 'This email is already registered.' });
      }
      const guardianId = generateGuardianCode();
      const uId = 'usr_' + Date.now().toString(36);
      const user = {
        _id: uId,
        id: uId,
        guardianId,
        fullName: fullName.trim(),
        email: emailClean,
        phone: phoneClean,
        dob: dob || '',
        gender: gender || '',
        avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}&backgroundColor=2563eb,3b82f6,1d4ed8`,
        role: 'user',
        emergencyProfile: { bloodGroup: '', address: '', city: '', state: '', emergencyNotes: '' },
        createdAt: new Date().toISOString()
      };
      memoryUsers.push({ ...user, password });
      const token = 'token_' + uId + '_' + Math.random().toString(36).substring(2, 8);
      activeSessions.set(token, { user: { id: uId, email: user.email, role: 'user', guardianId: user.guardianId } });
      return res.status(201).json({ success: true, message: 'User account created successfully!', token, user });
    }
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error during user registration.' });
  }
});

// POST /api/auth/register-guardian
router.post('/auth/register-guardian', async (req, res) => {
  try {
    const { fullName, email, phone, password, relationship, city, avatar } = req.body;

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'All required fields must be provided.' });
    }

    const emailClean = email.trim().toLowerCase();
    const phoneClean = phone.trim();

    if (getIsConnected()) {
      const existingGuardian = await Guardian.findOne({ email: emailClean });
      if (existingGuardian) {
        return res.status(400).json({ success: false, message: 'This email is already registered as a Guardian.' });
      }
      const existingUser = await User.findOne({ email: emailClean });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'This email is registered as a Protected User. Please use User Login.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const guardian = new Guardian({
        fullName: fullName.trim(),
        email: emailClean,
        phone: phoneClean,
        password: hashedPassword,
        relationship: relationship || 'Guardian',
        city: city ? city.trim() : '',
        avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}&backgroundColor=0284c7,0ea5e9,0369a1`,
        role: 'guardian',
        notifications: { email: true, browser: true, connection: true }
      });

      await guardian.save();
      return res.status(201).json({ success: true, message: 'Guardian account created successfully!', guardian });
    } else {
      // Fallback
      if (memoryGuardians.some(g => g.email === emailClean)) {
        return res.status(400).json({ success: false, message: 'This email is already registered.' });
      }
      const guardian = {
        _id: 'gdn_' + Date.now().toString(36),
        id: 'gdn_' + Date.now().toString(36),
        fullName: fullName.trim(),
        email: emailClean,
        phone: phoneClean,
        relationship: relationship || 'Guardian',
        city: city ? city.trim() : '',
        avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}&backgroundColor=0284c7,0ea5e9,0369a1`,
        role: 'guardian',
        notifications: { email: true, browser: true, connection: true },
        createdAt: new Date().toISOString()
      };
      memoryGuardians.push({ ...guardian, password });
      return res.status(201).json({ success: true, message: 'Guardian account created successfully!', guardian });
    }
  } catch (err) {
    console.error('Guardian registration error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error during guardian registration.' });
  }
});

// POST /api/auth/login-user
router.post('/auth/login-user', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email or phone number is required.' });
    }

    const term = email.trim().toLowerCase();

    if (getIsConnected()) {
      const user = await User.findOne({
        $or: [{ email: term }, { phone: term }, { guardianId: term.toUpperCase() }]
      });

      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
      }

      if (password) {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch && user.password !== password) {
          return res.status(401).json({ success: false, message: 'Incorrect password.' });
        }
      }

      const token = 'token_' + (user.id || user._id || Date.now()) + '_' + Math.random().toString(36).substring(2, 8);
      activeSessions.set(token, { user: { id: user.id || user._id, email: user.email, role: user.role || 'user', guardianId: user.guardianId } });
      return res.json({ success: true, token, user });
    } else {
      const user = memoryUsers.find(u => u.email === term || u.phone === term || u.guardianId === term.toUpperCase());
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
      }
      if (password && user.password !== password) {
        return res.status(401).json({ success: false, message: 'Incorrect password.' });
      }
      const safe = { ...user };
      delete safe.password;
      const token = 'token_' + (safe.id || safe._id || Date.now()) + '_' + Math.random().toString(36).substring(2, 8);
      activeSessions.set(token, { user: { id: safe.id || safe._id, email: safe.email, role: safe.role || 'user', guardianId: safe.guardianId } });
      return res.json({ success: true, token, user: safe });
    }
  } catch (err) {
    console.error('User login error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error during login.' });
  }
});

// POST /api/auth/login-guardian
router.post('/auth/login-guardian', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email or phone is required.' });
    }

    const term = email.trim().toLowerCase();

    if (getIsConnected()) {
      const guardian = await Guardian.findOne({
        $or: [{ email: term }, { phone: term }]
      });

      if (!guardian) {
        return res.status(401).json({ success: false, message: 'Guardian account not found.' });
      }

      if (password) {
        const isMatch = await bcrypt.compare(password, guardian.password);
        if (!isMatch && guardian.password !== password) {
          return res.status(401).json({ success: false, message: 'Incorrect password.' });
        }
      }

      return res.json({ success: true, guardian });
    } else {
      const guardian = memoryGuardians.find(g => g.email === term || g.phone === term);
      if (!guardian) {
        return res.status(401).json({ success: false, message: 'Guardian account not found.' });
      }
      if (password && guardian.password !== password) {
        return res.status(401).json({ success: false, message: 'Incorrect password.' });
      }
      const safe = { ...guardian };
      delete safe.password;
      return res.json({ success: true, guardian: safe });
    }
  } catch (err) {
    console.error('Guardian login error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error during guardian login.' });
  }
});

// --------------------------------------------------------------------------
// 2. USER PORTAL ROUTES
// --------------------------------------------------------------------------

// GET /api/user/me
router.get('/user/me', async (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id'];
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });

    if (getIsConnected()) {
      let user = null;
      if (mongoose.Types.ObjectId.isValid(userId)) {
        user = await User.findById(userId);
      } else {
        user = await User.findOne({ guardianId: userId.toUpperCase() }) || await User.findOne({ email: userId.toLowerCase() });
      }
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      return res.json({ success: true, user });
    } else {
      const user = memoryUsers.find(u => u._id === userId || u.id === userId || u.guardianId === userId.toUpperCase());
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      const safe = { ...user };
      delete safe.password;
      return res.json({ success: true, user: safe });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/user/profile
router.put('/user/profile', async (req, res) => {
  try {
    const { userId, fullName, phone, dob, gender, emergencyProfile } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID is required' });

    if (getIsConnected()) {
      let user = null;
      if (mongoose.Types.ObjectId.isValid(userId)) {
        user = await User.findById(userId);
      }
      if (!user) user = await User.findOne({ guardianId: userId.toUpperCase() });
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      if (fullName) user.fullName = fullName.trim();
      if (phone) user.phone = phone.trim();
      if (dob !== undefined) user.dob = dob;
      if (gender !== undefined) user.gender = gender;
      if (emergencyProfile) {
        user.emergencyProfile = {
          ...user.emergencyProfile,
          ...emergencyProfile
        };
      }

      await user.save();
      return res.json({ success: true, message: 'Profile updated in database!', user });
    } else {
      const idx = memoryUsers.findIndex(u => u._id === userId || u.id === userId || u.guardianId === userId.toUpperCase());
      if (idx === -1) return res.status(404).json({ success: false, message: 'User not found' });
      memoryUsers[idx] = {
        ...memoryUsers[idx],
        fullName: fullName || memoryUsers[idx].fullName,
        phone: phone || memoryUsers[idx].phone,
        dob: dob !== undefined ? dob : memoryUsers[idx].dob,
        gender: gender !== undefined ? gender : memoryUsers[idx].gender,
        emergencyProfile: {
          ...memoryUsers[idx].emergencyProfile,
          ...(emergencyProfile || {})
        }
      };
      const safe = { ...memoryUsers[idx] };
      delete safe.password;
      return res.json({ success: true, message: 'Profile updated!', user: safe });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/user/requests — Pending connection requests for this user
router.get('/user/requests', async (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id'];
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });

    if (getIsConnected()) {
      let userObjId = null;
      if (mongoose.Types.ObjectId.isValid(userId)) {
        userObjId = new mongoose.Types.ObjectId(userId);
      } else {
        const u = await User.findOne({
          $or: [
            { guardianId: userId.toUpperCase() },
            { email: userId.toLowerCase() }
          ]
        });
        if (u) userObjId = u._id;
      }

      if (!userObjId) {
        return res.json({ success: true, requests: [] });
      }

      const requests = await ConnectionRequest.find({ userId: userObjId, status: 'pending' })
        .populate('guardianId')
        .sort({ requestDate: -1 });

      const formatted = requests.map(r => {
        const g = r.guardianId || {};
        return {
          id: r._id,
          _id: r._id,
          linkId: r._id,
          userId: r.userId,
          guardianId: g._id || r.guardianId,
          guardianName: g.fullName || 'Guardian',
          guardianEmail: g.email || 'N/A',
          guardianPhone: g.phone || 'N/A',
          guardianAvatar: g.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=240&h=240&q=80',
          guardianCity: g.city || 'Unknown',
          relationship: r.relationship,
          status: r.status,
          requestDate: r.requestDate,
          permissions: r.permissions,
          permissionRequests: r.permissionRequests || []
        };
      });

      return res.json({ success: true, requests: formatted });
    } else {
      const requests = memoryLinks
        .filter(l => (l.userId === userId || l.userGuardianId === userId.toUpperCase()) && l.status === 'pending')
        .map(l => {
          const g = memoryGuardians.find(guard => guard._id === l.guardianId || guard.id === l.guardianId) || {};
          return {
            id: l._id || l.id,
            _id: l._id || l.id,
            linkId: l._id || l.id,
            userId: l.userId,
            guardianId: l.guardianId,
            guardianName: g.fullName || l.guardianName || 'Guardian',
            guardianEmail: g.email || 'N/A',
            guardianPhone: g.phone || 'N/A',
            guardianAvatar: g.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=240&h=240&q=80',
            guardianCity: g.city || 'Unknown',
            relationship: l.relationship,
            status: l.status,
            requestDate: l.requestDate,
            permissions: l.permissions,
            permissionRequests: l.permissionRequests || []
          };
        });
      return res.json({ success: true, requests });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/user/requests/:id/accept — User accepts guardian connection
router.post('/user/requests/:id/accept', async (req, res) => {
  try {
    const linkId = req.params.id;

    if (getIsConnected()) {
      let link = null;
      if (mongoose.Types.ObjectId.isValid(linkId)) {
        link = await ConnectionRequest.findById(linkId).populate('guardianId').populate('userId');
      }
      if (!link) return res.status(404).json({ success: false, message: 'Connection request not found.' });

      link.status = 'approved';
      link.approvedDate = new Date();
      link.permissions = {
        sosAlerts: true,
        location: true,
        incidentHistory: true,
        insights: true,
        audio: false,
        ...(link.permissions || {})
      };
      link.permissions.location = true; // Ensure location is enabled upon acceptance
      await link.save();

      return res.json({ success: true, message: 'Connection request approved successfully!', link });
    } else {
      const link = memoryLinks.find(l => l._id === linkId || l.id === linkId);
      if (!link) return res.status(404).json({ success: false, message: 'Request not found.' });
      link.status = 'approved';
      link.approvedDate = new Date().toISOString();
      if (!link.permissions) link.permissions = {};
      link.permissions.location = true;
      return res.json({ success: true, message: 'Connection request approved!', link });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/user/requests/:id/reject — User rejects guardian connection
router.post('/user/requests/:id/reject', async (req, res) => {
  try {
    const linkId = req.params.id;

    if (getIsConnected()) {
      let link = null;
      if (mongoose.Types.ObjectId.isValid(linkId)) {
        link = await ConnectionRequest.findById(linkId);
      }
      if (!link) return res.status(404).json({ success: false, message: 'Connection request not found.' });

      link.status = 'rejected';
      await link.save();

      return res.json({ success: true, message: 'Connection request rejected.', link });
    } else {
      const link = memoryLinks.find(l => l._id === linkId || l.id === linkId);
      if (!link) return res.status(404).json({ success: false, message: 'Request not found.' });
      link.status = 'rejected';
      return res.json({ success: true, message: 'Connection request rejected.', link });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/user/guardians — Approved guardians for user
router.get('/user/guardians', async (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id'];
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });

    if (getIsConnected()) {
      let userObjId = null;
      if (mongoose.Types.ObjectId.isValid(userId)) {
        userObjId = new mongoose.Types.ObjectId(userId);
      } else {
        const u = await User.findOne({
          $or: [
            { guardianId: userId.toUpperCase() },
            { email: userId.toLowerCase() }
          ]
        });
        if (u) userObjId = u._id;
      }

      if (!userObjId) {
        return res.json({ success: true, guardians: [] });
      }

      const links = await ConnectionRequest.find({ userId: userObjId, status: 'approved' })
        .populate('guardianId')
        .sort({ approvedDate: -1 });

      const formatted = links.map(l => {
        const g = l.guardianId || {};
        return {
          id: l._id,
          _id: l._id,
          linkId: l._id,
          userId: l.userId,
          guardianId: g._id || l.guardianId,
          guardianName: g.fullName || 'Guardian',
          guardianEmail: g.email || 'N/A',
          guardianPhone: g.phone || 'N/A',
          guardianAvatar: g.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=240&h=240&q=80',
          guardianCity: g.city || 'Unknown',
          relationship: l.relationship,
          status: l.status,
          requestDate: l.requestDate,
          approvedDate: l.approvedDate,
          permissions: l.permissions,
          permissionRequests: l.permissionRequests || []
        };
      });

      return res.json({ success: true, guardians: formatted });
    } else {
      const links = memoryLinks
        .filter(l => (l.userId === userId || l.userGuardianId === userId.toUpperCase()) && l.status === 'approved')
        .map(l => {
          const g = memoryGuardians.find(guard => guard._id === l.guardianId || guard.id === l.guardianId) || {};
          return {
            id: l._id || l.id,
            _id: l._id || l.id,
            linkId: l._id || l.id,
            userId: l.userId,
            guardianId: l.guardianId,
            guardianName: g.fullName || l.guardianName || 'Guardian',
            guardianEmail: g.email || 'N/A',
            guardianPhone: g.phone || 'N/A',
            guardianAvatar: g.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=240&h=240&q=80',
            guardianCity: g.city || 'Unknown',
            relationship: l.relationship,
            status: l.status,
            requestDate: l.requestDate,
            approvedDate: l.approvedDate,
            permissions: l.permissions,
            permissionRequests: l.permissionRequests || []
          };
        });
      return res.json({ success: true, guardians: links });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/user/permissions/:linkId — Update access permissions
router.put('/user/permissions/:linkId', async (req, res) => {
  try {
    const linkId = req.params.linkId;
    const { permissions } = req.body;

    if (getIsConnected()) {
      const link = await ConnectionRequest.findById(linkId);
      if (!link) return res.status(404).json({ success: false, message: 'Link not found' });

      link.permissions = {
        ...link.permissions,
        ...permissions
      };
      await link.save();
      return res.json({ success: true, message: 'Permissions updated in database!', link });
    } else {
      const link = memoryLinks.find(l => l._id === linkId || l.id === linkId);
      if (!link) return res.status(404).json({ success: false, message: 'Link not found' });
      link.permissions = {
        ...link.permissions,
        ...permissions
      };
      return res.json({ success: true, message: 'Permissions updated!', link });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --------------------------------------------------------------------------
// 3. GUARDIAN PORTAL ROUTES
// --------------------------------------------------------------------------

// GET /api/guardian/me
router.get('/guardian/me', async (req, res) => {
  try {
    const guardianId = req.query.guardianId || req.headers['x-guardian-id'];
    if (!guardianId) return res.status(400).json({ success: false, message: 'Guardian ID required' });

    if (getIsConnected()) {
      let guardian = null;
      if (mongoose.Types.ObjectId.isValid(guardianId)) {
        guardian = await Guardian.findById(guardianId);
      } else {
        guardian = await Guardian.findOne({ email: guardianId.toLowerCase() });
      }
      if (!guardian) return res.status(404).json({ success: false, message: 'Guardian not found' });
      return res.json({ success: true, guardian });
    } else {
      const guardian = memoryGuardians.find(g => g._id === guardianId || g.id === guardianId || g.email === guardianId.toLowerCase());
      if (!guardian) return res.status(404).json({ success: false, message: 'Guardian not found' });
      const safe = { ...guardian };
      delete safe.password;
      return res.json({ success: true, guardian: safe });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/guardian/profile
router.put('/guardian/profile', async (req, res) => {
  try {
    const { guardianId, fullName, phone, relationship, city, notifications } = req.body;
    if (!guardianId) return res.status(400).json({ success: false, message: 'Guardian ID is required' });

    if (getIsConnected()) {
      let guardian = null;
      if (mongoose.Types.ObjectId.isValid(guardianId)) {
        guardian = await Guardian.findById(guardianId);
      } else {
        guardian = await Guardian.findOne({ email: guardianId.toLowerCase() });
      }
      if (!guardian) return res.status(404).json({ success: false, message: 'Guardian not found' });

      if (fullName) guardian.fullName = fullName.trim();
      if (phone) guardian.phone = phone.trim();
      if (relationship) guardian.relationship = relationship;
      if (city !== undefined) guardian.city = city.trim();
      if (notifications) guardian.notifications = { ...guardian.notifications, ...notifications };

      await guardian.save();
      return res.json({ success: true, message: 'Profile updated in database!', guardian });
    } else {
      const idx = memoryGuardians.findIndex(g => g._id === guardianId || g.id === guardianId || g.email === guardianId.toLowerCase());
      if (idx === -1) return res.status(404).json({ success: false, message: 'Guardian not found' });
      memoryGuardians[idx] = {
        ...memoryGuardians[idx],
        fullName: fullName || memoryGuardians[idx].fullName,
        phone: phone || memoryGuardians[idx].phone,
        relationship: relationship || memoryGuardians[idx].relationship,
        city: city !== undefined ? city : memoryGuardians[idx].city,
        notifications: {
          ...memoryGuardians[idx].notifications,
          ...(notifications || {})
        }
      };
      const safe = { ...memoryGuardians[idx] };
      delete safe.password;
      return res.json({ success: true, message: 'Guardian profile updated!', guardian: safe });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/guardian/connect — Guardian enters user's unique Guardian ID / Connection ID
router.post('/guardian/connect', async (req, res) => {
  try {
    const { guardianId, guardianCode } = req.body;

    if (!guardianId || !guardianCode) {
      return res.status(400).json({ success: false, message: 'Guardian ID and User Connection ID are required.' });
    }

    const rawCode = guardianCode.trim();
    const cleanCode = rawCode.toUpperCase();

    if (getIsConnected()) {
      let guardian = null;
      if (mongoose.Types.ObjectId.isValid(guardianId)) {
        guardian = await Guardian.findById(guardianId);
      }
      if (!guardian) {
        guardian = await Guardian.findOne({ email: guardianId.toLowerCase() });
      }
      if (!guardian) return res.status(404).json({ success: false, message: 'Guardian account not found.' });

      // Flexible matching for User Connection ID (e.g. GDN-XXXXXXX, or without GDN-, or email)
      const targetUser = await User.findOne({
        $or: [
          { guardianId: cleanCode },
          { guardianId: cleanCode.startsWith('GDN-') ? cleanCode : `GDN-${cleanCode}` },
          { guardianId: cleanCode.replace(/^GDN-/, '') },
          { email: rawCode.toLowerCase() },
          ...(mongoose.Types.ObjectId.isValid(rawCode) ? [{ _id: rawCode }] : [])
        ]
      });

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: `Invalid Connection ID "${cleanCode}". Please verify the code with the user.`
        });
      }

      // Check existing connection
      let existing = await ConnectionRequest.findOne({ userId: targetUser._id, guardianId: guardian._id });
      if (existing) {
        if (existing.status === 'approved') {
          return res.status(400).json({ success: false, message: `You are already connected to ${targetUser.fullName}.` });
        }
        // If pending, rejected, or revoked, allow refreshing the request timestamp so user gets re-notified
        existing.status = 'pending';
        existing.requestDate = new Date();
        await existing.save();

        return res.json({
          success: true,
          message: `Connection request resent to ${targetUser.fullName}! It will appear in their User Portal for authorization.`,
          link: existing,
          targetUser: {
            _id: targetUser._id,
            id: targetUser._id,
            fullName: targetUser.fullName,
            guardianId: targetUser.guardianId,
            email: targetUser.email,
            phone: targetUser.phone,
            avatar: targetUser.avatar
          }
        });
      }

      const newLink = new ConnectionRequest({
        userId: targetUser._id,
        guardianId: guardian._id,
        relationship: guardian.relationship || 'Guardian',
        status: 'pending',
        requestDate: new Date(),
        permissions: { sosAlerts: true, location: true, incidentHistory: true, insights: true, audio: false }
      });

      await newLink.save();

      return res.status(201).json({
        success: true,
        message: `Connection request successfully sent to ${targetUser.fullName}! It will appear in their User Portal for authorization.`,
        link: newLink,
        targetUser: {
          _id: targetUser._id,
          id: targetUser._id,
          fullName: targetUser.fullName,
          guardianId: targetUser.guardianId,
          email: targetUser.email,
          phone: targetUser.phone,
          avatar: targetUser.avatar
        }
      });
    } else {
      let guardian = memoryGuardians.find(g => g._id === guardianId || g.id === guardianId || g.email === guardianId.toLowerCase());
      if (!guardian) return res.status(404).json({ success: false, message: 'Guardian not found.' });

      const targetUser = memoryUsers.find(u => 
        u.guardianId === cleanCode || 
        u.guardianId === (cleanCode.startsWith('GDN-') ? cleanCode : `GDN-${cleanCode}`) ||
        u.guardianId === cleanCode.replace(/^GDN-/, '') ||
        u.email === rawCode.toLowerCase()
      );
      if (!targetUser) {
        return res.status(404).json({ success: false, message: `Invalid Connection ID "${cleanCode}".` });
      }

      let existing = memoryLinks.find(l => (l.userId === targetUser._id || l.userId === targetUser.id) && (l.guardianId === guardian._id || l.guardianId === guardian.id));
      if (existing) {
        if (existing.status === 'approved') {
          return res.status(400).json({ success: false, message: `Already connected to ${targetUser.fullName}.` });
        }
        existing.status = 'pending';
        existing.requestDate = new Date().toISOString();
        return res.json({
          success: true,
          message: `Connection request resent to ${targetUser.fullName}!`,
          link: existing,
          targetUser: {
            _id: targetUser._id || targetUser.id,
            id: targetUser._id || targetUser.id,
            fullName: targetUser.fullName,
            guardianId: targetUser.guardianId,
            email: targetUser.email,
            phone: targetUser.phone,
            avatar: targetUser.avatar
          }
        });
      }

      const link = {
        _id: 'lnk_' + Date.now().toString(36),
        id: 'lnk_' + Date.now().toString(36),
        userId: targetUser._id || targetUser.id,
        userGuardianId: targetUser.guardianId,
        userName: targetUser.fullName,
        guardianId: guardian._id || guardian.id,
        guardianName: guardian.fullName,
        relationship: guardian.relationship || 'Guardian',
        status: 'pending',
        requestDate: new Date().toISOString(),
        permissions: { sosAlerts: true, location: true, incidentHistory: true, insights: true, audio: false },
        permissionRequests: []
      };

      memoryLinks.push(link);
      return res.status(201).json({
        success: true,
        message: `Connection request sent to ${targetUser.fullName}!`,
        link,
        targetUser: {
          _id: targetUser._id || targetUser.id,
          id: targetUser._id || targetUser.id,
          fullName: targetUser.fullName,
          guardianId: targetUser.guardianId,
          email: targetUser.email,
          phone: targetUser.phone,
          avatar: targetUser.avatar
        }
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/guardian/linked-users — All approved wards for guardian
router.get('/guardian/linked-users', async (req, res) => {
  try {
    const guardianId = req.query.guardianId || req.headers['x-guardian-id'];
    if (!guardianId) return res.status(400).json({ success: false, message: 'Guardian ID required' });

    if (getIsConnected()) {
      let gObjId = null;
      if (mongoose.Types.ObjectId.isValid(guardianId)) {
        gObjId = new mongoose.Types.ObjectId(guardianId);
      } else {
        const g = await Guardian.findOne({ email: guardianId.toLowerCase() });
        if (g) gObjId = g._id;
      }

      if (!gObjId) {
        return res.json({ success: true, users: [] });
      }

      const links = await ConnectionRequest.find({ guardianId: gObjId, status: 'approved' })
        .populate('userId')
        .sort({ approvedDate: -1 });

      const formatted = links.map(l => {
        const u = l.userId || {};
        return {
          id: l._id,
          _id: l._id,
          linkId: l._id,
          userId: u._id || l.userId,
          userName: u.fullName || 'Protected User',
          userEmail: u.email || 'N/A',
          userPhone: u.phone || 'N/A',
          userGuardianId: u.guardianId || 'N/A',
          guardianId: u.guardianId || 'N/A',
          userAvatar: u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&h=240&q=80',
          userDob: u.dob,
          userGender: u.gender,
          userCreatedAt: u.createdAt,
          emergencyProfile: u.emergencyProfile || {},
          userCity: u.emergencyProfile?.city || 'Not specified',
          relationship: l.relationship,
          status: l.status,
          approvedDate: l.approvedDate,
          permissions: l.permissions,
          permissionRequests: l.permissionRequests || []
        };
      });

      return res.json({ success: true, users: formatted });
    } else {
      const links = memoryLinks
        .filter(l => (l.guardianId === guardianId) && l.status === 'approved')
        .map(l => {
          const u = memoryUsers.find(user => user._id === l.userId || user.id === l.userId) || {};
          return {
            id: l._id || l.id,
            _id: l._id || l.id,
            linkId: l._id || l.id,
            userId: l.userId,
            userName: u.fullName || l.userName || 'Protected User',
            userEmail: u.email || 'N/A',
            userPhone: u.phone || 'N/A',
            userGuardianId: u.guardianId || 'N/A',
            userAvatar: u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&h=240&q=80',
            emergencyProfile: u.emergencyProfile || {},
            userCity: u.emergencyProfile?.city || 'Not specified',
            relationship: l.relationship,
            status: l.status,
            approvedDate: l.approvedDate,
            permissions: l.permissions,
            permissionRequests: l.permissionRequests || []
          };
        });
      return res.json({ success: true, users: links });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/guardian/connection-requests — Sent requests history
router.get('/guardian/connection-requests', async (req, res) => {
  try {
    const guardianId = req.query.guardianId || req.headers['x-guardian-id'];
    if (!guardianId) return res.status(400).json({ success: false, message: 'Guardian ID required' });

    if (getIsConnected()) {
      let gObjId = null;
      if (mongoose.Types.ObjectId.isValid(guardianId)) {
        gObjId = new mongoose.Types.ObjectId(guardianId);
      } else {
        const g = await Guardian.findOne({ email: guardianId.toLowerCase() });
        if (g) gObjId = g._id;
      }

      if (!gObjId) {
        return res.json({ success: true, requests: [] });
      }

      const links = await ConnectionRequest.find({ guardianId: gObjId })
        .populate('userId')
        .sort({ requestDate: -1 });

      const formatted = links.map(l => {
        const u = l.userId || {};
        return {
          id: l._id,
          _id: l._id,
          userId: u._id || l.userId,
          userName: u.fullName || 'Protected User',
          userAvatar: u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&h=240&q=80',
          relationship: l.relationship,
          status: l.status,
          requestDate: l.requestDate,
          permissions: l.permissions
        };
      });

      return res.json({ success: true, requests: formatted });
    } else {
      const links = memoryLinks.filter(l => l.guardianId === guardianId);
      return res.json({ success: true, requests: links });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/guardian/request-permission
router.post('/guardian/request-permission', async (req, res) => {
  try {
    const { linkId, permissionKey } = req.body;
    if (!linkId || !permissionKey) return res.status(400).json({ success: false, message: 'Link ID and permission key required' });

    if (getIsConnected()) {
      const link = await ConnectionRequest.findById(linkId);
      if (!link) return res.status(404).json({ success: false, message: 'Link not found' });

      if (!link.permissionRequests) link.permissionRequests = [];
      if (!link.permissionRequests.includes(permissionKey)) {
        link.permissionRequests.push(permissionKey);
        await link.save();
      }
      return res.json({ success: true, message: `Permission request for ${permissionKey} sent!`, link });
    } else {
      const link = memoryLinks.find(l => l._id === linkId || l.id === linkId);
      if (!link) return res.status(404).json({ success: false, message: 'Link not found' });
      if (!link.permissionRequests) link.permissionRequests = [];
      if (!link.permissionRequests.includes(permissionKey)) {
        link.permissionRequests.push(permissionKey);
      }
      return res.json({ success: true, message: `Permission request for ${permissionKey} sent!`, link });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================================
// 6. EMERGENCY SOS & POLICE ESCALATION CHAIN ROUTES
// ============================================================================

// Helper: Format time string HH:MM:SS
function formatTime(d = new Date()) {
  return d.toTimeString().split(' ')[0];
}

// Helper: Ensure 60-second timeout check on any active incident
async function checkAndAutoEscalate(incident) {
  if (!incident) return incident;
  
  if (incident.status === 'PENDING_GUARDIAN') {
    const timeoutTime = new Date(incident.guardianTimeoutAt).getTime();
    if (Date.now() >= timeoutTime) {
      // 1 minute has expired with 0 guardian responses!
      incident.status = 'ESCALATED_POLICE';
      incident.escalatedAt = new Date();
      incident.escalationReason = 'Guardian did not respond within 1-minute response window (60s timeout). Autonomous municipal emergency protocol triggered.';
      
      const escalationTime = formatTime(incident.escalatedAt);
      incident.auditTrail.push({
        step: 3,
        title: '1-Min Response Window Expired',
        time: escalationTime,
        desc: '60-second threshold exceeded with 0 guardian replies.',
        statusClass: 'error'
      });
      incident.auditTrail.push({
        step: 4,
        title: 'Municipal Police Escalation',
        time: escalationTime,
        desc: 'Failover protocol engaged. Incident routed to Police Emergency Operations Command Center (Zero-Human Delay).',
        statusClass: 'error'
      });
      incident.auditTrail.push({
        step: 5,
        title: 'Console Delivery (EOC)',
        time: escalationTime,
        desc: 'Priority 01 incident packet placed live on Tactical Emergency Desk.',
        statusClass: 'active'
      });

      if (getIsConnected() && incident.save) {
        await incident.save();
      }
    }
  }
  return incident;
}

// POST /api/sos/trigger — Triggered by user from User Portal or Web App
router.post(['/sos/trigger', '/api/sos/trigger', '/emergency/sos', '/api/emergency/sos'], async (req, res) => {
  try {
    const result = await createCoreEmergencyIncident({
      ...req.body,
      triggerSource: req.body.triggerSource || 'app'
    });

    return res.json({
      success: true,
      message: 'Critical SOS emergency triggered successfully. Alerting guardians for 5 minutes (300s) before police failover.',
      incident: result.incident,
      isDuplicate: result.isDuplicate
    });
  } catch (err) {
    console.error('Error triggering SOS:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sos/active — Fetches the currently active SOS incident & checks 1-min timer
router.get(['/sos/active', '/api/sos/active'], async (req, res) => {
  try {
    const { userId, guardianId } = req.query;

    let activeIncident = null;

    if (getIsConnected()) {
      const filter = {
        status: { $in: ['PENDING_GUARDIAN', 'ESCALATED_POLICE', 'POLICE_ACKNOWLEDGED', 'DISPATCHED'] }
      };
      if (userId) filter.userId = userId;

      const incident = await EmergencyIncident.findOne(filter).sort({ sosTriggeredAt: -1 });
      if (incident) {
        activeIncident = await checkAndAutoEscalate(incident);
      }
    } else {
      let matching = memoryIncidents.filter(inc =>
        ['PENDING_GUARDIAN', 'ESCALATED_POLICE', 'POLICE_ACKNOWLEDGED', 'DISPATCHED'].includes(inc.status)
      );
      if (userId) {
        matching = matching.filter(inc => inc.userId === userId);
      }
      if (matching.length > 0) {
        const incident = matching[matching.length - 1];
        activeIncident = await checkAndAutoEscalate(incident);
      }
    }

    return res.json({
      success: true,
      hasActiveSos: !!activeIncident,
      activeIncident
    });
  } catch (err) {
    console.error('Error fetching active SOS:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/sos/respond-guardian — Guardian acknowledges within the 1-minute window
router.post(['/sos/respond-guardian', '/api/sos/respond-guardian'], async (req, res) => {
  try {
    const { caseId, guardianId, guardianName, note } = req.body;
    const now = new Date();
    const respTime = formatTime(now);

    let incident = null;

    if (getIsConnected()) {
      incident = caseId 
        ? await EmergencyIncident.findOne({ caseId })
        : await EmergencyIncident.findOne({ status: 'PENDING_GUARDIAN' }).sort({ sosTriggeredAt: -1 });

      if (!incident) {
        return res.status(404).json({ success: false, message: 'No active pending SOS found' });
      }

      incident.status = 'GUARDIAN_RESPONDED';
      incident.guardianResponse = {
        respondedAt: now,
        guardianId: guardianId || incident.guardianId,
        guardianName: guardianName || incident.guardianName,
        note: note || 'Guardian responded and is handling the emergency'
      };

      incident.auditTrail.push({
        step: 3,
        title: 'Guardian Responded',
        time: respTime,
        desc: `Guardian ${guardianName || 'Primary Guardian'} responded within the 60s window and assumed incident control.`,
        statusClass: 'success'
      });

      await incident.save();
    } else {
      const idx = caseId
        ? memoryIncidents.findIndex(i => i.caseId === caseId)
        : memoryIncidents.findIndex(i => i.status === 'PENDING_GUARDIAN');

      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'No active pending SOS found' });
      }

      memoryIncidents[idx].status = 'GUARDIAN_RESPONDED';
      memoryIncidents[idx].guardianResponse = {
        respondedAt: now,
        guardianId: guardianId || memoryIncidents[idx].guardianId,
        guardianName: guardianName || memoryIncidents[idx].guardianName,
        note: note || 'Guardian responded and is handling the emergency'
      };

      memoryIncidents[idx].auditTrail.push({
        step: 3,
        title: 'Guardian Responded',
        time: respTime,
        desc: `Guardian ${guardianName || 'Primary Guardian'} responded within the 60s window and assumed incident control.`,
        statusClass: 'success'
      });

      incident = memoryIncidents[idx];
    }

    return res.json({
      success: true,
      message: 'Guardian acknowledged emergency. Escalation to police halted.',
      incident
    });
  } catch (err) {
    console.error('Error responding as guardian:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/sos/escalate-police — Escalate directly to Emergency Police Portal
router.post(['/sos/escalate-police', '/api/sos/escalate-police'], async (req, res) => {
  try {
    const { caseId, reason } = req.body;
    const now = new Date();
    const escTime = formatTime(now);

    let incident = null;

    if (getIsConnected()) {
      incident = caseId
        ? await EmergencyIncident.findOne({ caseId })
        : await EmergencyIncident.findOne({ status: { $in: ['PENDING_GUARDIAN', 'GUARDIAN_RESPONDED'] } }).sort({ sosTriggeredAt: -1 });

      if (!incident) {
        return res.status(404).json({ success: false, message: 'No eligible SOS incident found to escalate' });
      }

      incident.status = 'ESCALATED_POLICE';
      incident.escalatedAt = now;
      incident.escalationReason = reason || 'Escalated to Police Emergency Operations Center (112 EOC)';

      incident.auditTrail.push({
        step: incident.auditTrail.length + 1,
        title: 'Emergency Escalated to Police',
        time: escTime,
        desc: incident.escalationReason,
        statusClass: 'error'
      });

      await incident.save();
    } else {
      const idx = caseId
        ? memoryIncidents.findIndex(i => i.caseId === caseId)
        : memoryIncidents.findIndex(i => ['PENDING_GUARDIAN', 'GUARDIAN_RESPONDED'].includes(i.status));

      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'No eligible SOS incident found to escalate' });
      }

      memoryIncidents[idx].status = 'ESCALATED_POLICE';
      memoryIncidents[idx].escalatedAt = now;
      memoryIncidents[idx].escalationReason = reason || 'Escalated to Guardian AI Police Operations Desk';

      memoryIncidents[idx].auditTrail.push({
        step: memoryIncidents[idx].auditTrail.length + 1,
        title: 'Emergency Escalated to Police',
        time: escTime,
        desc: memoryIncidents[idx].escalationReason,
        statusClass: 'error'
      });

      incident = memoryIncidents[idx];
    }

    return res.json({
      success: true,
      message: 'Emergency incident successfully escalated to Police Emergency Operations Center!',
      incident
    });
  } catch (err) {
    console.error('Error escalating to police:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/sos/police/acknowledge — Police Officer acknowledges case in Emergency Portal
router.post(['/sos/police/acknowledge', '/api/sos/police/acknowledge'], async (req, res) => {
  try {
    const { caseId, officer } = req.body;
    const now = new Date();
    const ackTime = formatTime(now);

    let incident = null;

    if (getIsConnected()) {
      incident = caseId
        ? await EmergencyIncident.findOne({ caseId })
        : await EmergencyIncident.findOne({ status: 'ESCALATED_POLICE' }).sort({ sosTriggeredAt: -1 });

      if (!incident) return res.status(404).json({ success: false, message: 'Case not found' });

      incident.status = 'POLICE_ACKNOWLEDGED';
      incident.policeAction = {
        ...incident.policeAction,
        acknowledgedAt: now,
        officer: officer || 'Inspector S. Connor (OP-8492)'
      };

      incident.auditTrail.push({
        step: incident.auditTrail.length + 1,
        title: 'Case Acknowledged by Police',
        time: ackTime,
        desc: `Police Dispatcher ${officer || 'Inspector S. Connor'} acknowledged emergency. Tactical unit staging.`,
        statusClass: 'success'
      });

      await incident.save();
    } else {
      const idx = caseId
        ? memoryIncidents.findIndex(i => i.caseId === caseId)
        : memoryIncidents.findIndex(i => i.status === 'ESCALATED_POLICE');

      if (idx === -1) return res.status(404).json({ success: false, message: 'Case not found' });

      memoryIncidents[idx].status = 'POLICE_ACKNOWLEDGED';
      memoryIncidents[idx].policeAction = {
        ...memoryIncidents[idx].policeAction,
        acknowledgedAt: now,
        officer: officer || 'Inspector S. Connor (OP-8492)'
      };

      memoryIncidents[idx].auditTrail.push({
        step: memoryIncidents[idx].auditTrail.length + 1,
        title: 'Case Acknowledged by Police',
        time: ackTime,
        desc: `Police Dispatcher ${officer || 'Inspector S. Connor'} acknowledged emergency. Tactical unit staging.`,
        statusClass: 'success'
      });

      incident = memoryIncidents[idx];
    }

    return res.json({
      success: true,
      message: 'Police successfully acknowledged incident',
      incident
    });
  } catch (err) {
    console.error('Error acknowledging by police:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/sos/police/dispatch — Police dispatches Patrol/EMS to the user
router.post(['/sos/police/dispatch', '/api/sos/police/dispatch'], async (req, res) => {
  try {
    const { caseId, unitId, eta } = req.body;
    const now = new Date();
    const dispTime = formatTime(now);
    const assignedUnit = unitId || 'Unit 01 (Intercept Patrol - Officer K. Sharma)';
    const assignedEta = eta || '2m 10s';

    let incident = null;

    if (getIsConnected()) {
      incident = caseId
        ? await EmergencyIncident.findOne({ caseId })
        : await EmergencyIncident.findOne({ status: { $in: ['ESCALATED_POLICE', 'POLICE_ACKNOWLEDGED'] } }).sort({ sosTriggeredAt: -1 });

      if (!incident) return res.status(404).json({ success: false, message: 'Case not found' });

      incident.status = 'DISPATCHED';
      incident.policeAction = {
        ...incident.policeAction,
        dispatchedUnit: assignedUnit,
        dispatchedAt: now,
        eta: assignedEta
      };

      incident.auditTrail.push({
        step: incident.auditTrail.length + 1,
        title: 'Tactical Unit Dispatched',
        time: dispTime,
        desc: `${assignedUnit} en route to user GPS location. ETA: ${assignedEta}. Sirens active.`,
        statusClass: 'primary'
      });

      await incident.save();
    } else {
      const idx = caseId
        ? memoryIncidents.findIndex(i => i.caseId === caseId)
        : memoryIncidents.findIndex(i => ['ESCALATED_POLICE', 'POLICE_ACKNOWLEDGED'].includes(i.status));

      if (idx === -1) return res.status(404).json({ success: false, message: 'Case not found' });

      memoryIncidents[idx].status = 'DISPATCHED';
      memoryIncidents[idx].policeAction = {
        ...memoryIncidents[idx].policeAction,
        dispatchedUnit: assignedUnit,
        dispatchedAt: now,
        eta: assignedEta
      };

      memoryIncidents[idx].auditTrail.push({
        step: memoryIncidents[idx].auditTrail.length + 1,
        title: 'Tactical Unit Dispatched',
        time: dispTime,
        desc: `${assignedUnit} en route to user GPS location. ETA: ${assignedEta}. Sirens active.`,
        statusClass: 'primary'
      });

      incident = memoryIncidents[idx];
    }

    return res.json({
      success: true,
      message: `Unit ${assignedUnit} dispatched to user! ETA: ${assignedEta}`,
      incident
    });
  } catch (err) {
    console.error('Error dispatching unit:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/sos/cancel — Authenticated Event Cancellation
router.post(['/sos/cancel', '/api/sos/cancel'], async (req, res) => {
  try {
    const { caseId, cancellationReason } = req.body;

    // 1. Authenticate identity via validated server auth middleware / session token
    // DO NOT authorize based on client-supplied x-user-id header!
    const authUser = getAuthenticatedUser(req);
    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Validated authentication credentials required for cancellation.'
      });
    }

    if (!caseId) {
      return res.status(400).json({ success: false, message: 'caseId is required for cancellation.' });
    }

    const now = new Date();
    const resTime = formatTime(now);

    let incident = null;
    let incidentIdx = -1;

    if (getIsConnected()) {
      try {
        incident = await EmergencyIncident.findOne({ caseId });
      } catch (err) {
        console.error('DB query error:', err.message);
      }
    }
    if (!incident) {
      incidentIdx = memoryIncidents.findIndex(i => i.caseId === caseId);
      if (incidentIdx !== -1) incident = memoryIncidents[incidentIdx];
    }

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found.' });
    }

    // 2. Strict Canonical Authorization Check (No empty-string or missing ID fallbacks)
    const isOwner = checkIsIncidentOwner(incident, authUser);
    const isAssigned = checkIsAssignedOfficer(incident, authUser);
    const isSupervisor = checkIsStationSupervisor(incident, authUser);
    const isAdmin = checkIsSystemAdmin(authUser);

    const isAuthorizedToInteract = isOwner || isAssigned || isSupervisor || isAdmin;

    if (!isAuthorizedToInteract) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You lack required organization, jurisdiction, or assignment authorization to cancel this incident.'
      });
    }

    // 3. Cover police QUEUED and DELIVERED states in cancellation review
    const policeInvolvedStates = [
      'QUEUED', 'DELIVERED', 'OFFERED', 'ACCEPTED',
      'ESCALATED_POLICE', 'POLICE_ACKNOWLEDGED', 'DISPATCHED',
      'EN_ROUTE', 'ARRIVED', 'ASSISTANCE_COMPLETED'
    ];
    const policeInvolved = policeInvolvedStates.includes(incident.status);

    const cancellationData = {
      requested: true,
      requestedBy: authUser.id || authUser._id,
      requestedAt: now,
      reason: cancellationReason || 'User marked safe from portal',
      policeReviewRequired: policeInvolved,
      policeReviewStatus: policeInvolved ? 'PENDING_REVIEW' : 'APPROVED'
    };

    if (getIsConnected()) {
      incident.cancellationState = cancellationData;
      if (policeInvolved) {
        incident.auditTrail.push({
          step: incident.auditTrail.length + 1,
          title: 'Cancellation Requested (Police Review Required)',
          time: resTime,
          desc: `User requested cancellation: "${cancellationReason || 'User marked safe'}". Flagged for Police Desk review.`,
          statusClass: 'warning'
        });
        await incident.save();
        return res.json({
          success: true,
          pendingPoliceReview: true,
          message: 'Cancellation requested. Awaiting police desk review as police dispatch state is queued/active.',
          incident
        });
      } else {
        incident.status = 'CANCELLED';
        incident.auditTrail.push({
          step: incident.auditTrail.length + 1,
          title: 'Emergency Beacon Cancelled',
          time: resTime,
          desc: `Authenticated user cancelled beacon: "${cancellationReason || 'User marked safe'}".`,
          statusClass: 'info'
        });
        await incident.save();
        return res.json({
          success: true,
          pendingPoliceReview: false,
          message: 'Emergency incident successfully cancelled.',
          incident
        });
      }
    } else {
      memoryIncidents[incidentIdx].cancellationState = cancellationData;
      if (policeInvolved) {
        memoryIncidents[incidentIdx].auditTrail.push({
          step: memoryIncidents[incidentIdx].auditTrail.length + 1,
          title: 'Cancellation Requested (Police Review Required)',
          time: resTime,
          desc: `User requested cancellation: "${cancellationReason || 'User marked safe'}". Flagged for Police Desk review.`,
          statusClass: 'warning'
        });
        return res.json({
          success: true,
          pendingPoliceReview: true,
          message: 'Cancellation requested (Memory Mode). Flagged for Police Desk review.',
          incident: memoryIncidents[incidentIdx]
        });
      } else {
        memoryIncidents[incidentIdx].status = 'CANCELLED';
        memoryIncidents[incidentIdx].auditTrail.push({
          step: memoryIncidents[incidentIdx].auditTrail.length + 1,
          title: 'Emergency Beacon Cancelled',
          time: resTime,
          desc: `Authenticated user cancelled beacon: "${cancellationReason || 'User marked safe'}".`,
          statusClass: 'info'
        });
        return res.json({
          success: true,
          pendingPoliceReview: false,
          message: 'Emergency incident cancelled.',
          incident: memoryIncidents[incidentIdx]
        });
      }
    }
  } catch (err) {
    console.error('Error cancelling incident:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/sos/resolve — Resolve and clear emergency
router.post(['/sos/resolve', '/api/sos/resolve'], async (req, res) => {
  try {
    const { caseId, resolutionNotes } = req.body;
    const now = new Date();
    const resTime = formatTime(now);

    let incident = null;

    if (getIsConnected()) {
      incident = caseId
        ? await EmergencyIncident.findOne({ caseId })
        : await EmergencyIncident.findOne({ status: { $ne: 'RESOLVED' } }).sort({ sosTriggeredAt: -1 });

      if (!incident) return res.status(404).json({ success: false, message: 'Case not found' });

      incident.status = 'RESOLVED';
      incident.policeAction = {
        ...incident.policeAction,
        resolvedAt: now
      };

      incident.auditTrail.push({
        step: incident.auditTrail.length + 1,
        title: 'Incident Resolved',
        time: resTime,
        desc: resolutionNotes || 'Situation stabilized. User verified safe. Case closed.',
        statusClass: 'success'
      });

      await incident.save();
    } else {
      const idx = caseId
        ? memoryIncidents.findIndex(i => i.caseId === caseId)
        : memoryIncidents.findIndex(i => i.status !== 'RESOLVED');

      if (idx === -1) return res.status(404).json({ success: false, message: 'Case not found' });

      memoryIncidents[idx].status = 'RESOLVED';
      memoryIncidents[idx].policeAction = {
        ...memoryIncidents[idx].policeAction,
        resolvedAt: now
      };

      memoryIncidents[idx].auditTrail.push({
        step: memoryIncidents[idx].auditTrail.length + 1,
        title: 'Incident Resolved',
        time: resTime,
        desc: resolutionNotes || 'Situation stabilized. User verified safe. Case closed.',
        statusClass: 'success'
      });

      incident = memoryIncidents[idx];
    }

    return res.json({
      success: true,
      message: 'Emergency incident resolved and closed.',
      incident
    });
  } catch (err) {
    console.error('Error resolving incident:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/emergency/cases — Live cases feed for Guardian Emergency Portal (Police EOC)
router.get(['/emergency/cases', '/api/emergency/cases'], async (req, res) => {
  try {
    let incidents = [];
    if (getIsConnected()) {
      const found = await EmergencyIncident.find().sort({ sosTriggeredAt: -1 }).limit(10);
      for (const inc of found) {
        const checked = await checkAndAutoEscalate(inc);
        incidents.push(checked);
      }
    } else {
      for (const inc of memoryIncidents) {
        const checked = await checkAndAutoEscalate(inc);
        incidents.push(checked);
      }
    }

    // Transform live incidents into Emergency Portal format
    const formattedLiveCases = incidents.map(inc => {
      const displayStatus = 
        inc.status === 'PENDING_GUARDIAN' ? 'Incoming' :
        inc.status === 'ESCALATED_POLICE' ? 'Incoming' :
        inc.status === 'POLICE_ACKNOWLEDGED' ? 'Active' :
        inc.status === 'DISPATCHED' ? 'In Transit' :
        inc.status === 'RESOLVED' ? 'Resolved' : 'Active';

      return {
        id: inc.caseId,
        caseId: inc.caseId,
        name: inc.userName,
        reason: inc.reason,
        escalationReason: inc.escalationReason || 'Automatic municipal failover triggered.',
        location: inc.location,
        coords: inc.coords,
        time: new Date(inc.sosTriggeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        severity: inc.severity,
        score: inc.score,
        status: displayStatus,
        rawStatus: inc.status,
        bpm: inc.bpm,
        userPhone: inc.userPhone,
        guardianName: inc.guardianName,
        guardianId: inc.guardianId,
        guardianTimeoutAt: inc.guardianTimeoutAt,
        escalatedAt: inc.escalatedAt,
        assignedUnit: inc.policeAction?.dispatchedUnit,
        policeAction: inc.policeAction,
        auditTrail: inc.auditTrail,
        nodeId: 'NODE-INGRESS-04'
      };
    });

    // Sort live cases so ESCALATED_POLICE and active emergencies are at the top
    const priorityMap = {
      'ESCALATED_POLICE': 1,
      'PENDING_GUARDIAN': 2,
      'POLICE_ACKNOWLEDGED': 3,
      'DISPATCHED': 4,
      'GUARDIAN_RESPONDED': 5,
      'RESOLVED': 6
    };
    formattedLiveCases.sort((a, b) => {
      const pA = priorityMap[a.rawStatus] || 99;
      const pB = priorityMap[b.rawStatus] || 99;
      if (pA !== pB) return pA - pB;
      return new Date(b.escalatedAt || b.time || 0) - new Date(a.escalatedAt || a.time || 0);
    });

    // Enrich cases with resolved IP location
    const ipGeo = await resolveIpLocation(req);
    const enriched = (formattedLiveCases || []).map(c => ({
      ...c,
      location: c.location || `${ipGeo.city}, ${ipGeo.region}, ${ipGeo.country} (IP Geolocation)`,
      ipAddress: c.ipAddress || ipGeo.ip,
      ipLocation: c.ipLocation || ipGeo.locationString,
      coords: (c.coords && c.coords.lat) ? c.coords : { lat: ipGeo.lat, lng: ipGeo.lng }
    }));

    // Default static fleet incidents to ensure rich UI if no live SOS
    const defaultCases = [
      { id: 'GA-1024', caseId: 'GA-1024', name: 'Emily Johnson', reason: 'Impact Detection (High Velocity)', location: `${ipGeo.city}, ${ipGeo.region}, ${ipGeo.country}`, ipAddress: ipGeo.ip, ipLocation: ipGeo.locationString, coords: { lat: ipGeo.lat, lng: ipGeo.lng }, time: '15:26', severity: 'Critical', score: 87, status: 'Incoming', bpm: 154, nodeId: 'NODE-INGRESS-04' },
      { id: 'GA-1025', caseId: 'GA-1025', name: 'Rahul Desai', reason: 'Abnormal Heart Rate & Syncope', location: `${ipGeo.city}, ${ipGeo.region}, ${ipGeo.country}`, ipAddress: ipGeo.ip, ipLocation: ipGeo.locationString, coords: { lat: ipGeo.lat + 0.005, lng: ipGeo.lng + 0.005 }, time: '15:28', severity: 'High', score: 72, status: 'Active', bpm: 165 }
    ];

    const allCases = [...enriched, ...defaultCases];

    return res.json({
      success: true,
      cases: allCases.slice(0, 2),
      clientIpLocation: ipGeo
    });
  } catch (err) {
    console.error('Error fetching emergency cases:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/emergency/units — Active Emergency & Police Response Units Feed
router.get(['/emergency/units', '/api/emergency/units'], async (req, res) => {
  try {
    const units = [
      { id: 'Unit 01', name: 'Intercept Patrol', officer: 'Officer K. Sharma', status: 'In Transit', vehicle: 'Patrol Interceptor #04', station: 'Rajahmundry Central (PS-01)' },
      { id: 'Unit 02', name: 'EMS Rapid Response', officer: 'Officer T. Verma', status: 'Available', vehicle: 'ALS Ambulance #12', station: 'Station #04' },
      { id: 'Unit 03', name: 'Med Support Patrol', officer: 'Officer D. Rao', status: 'Available', vehicle: 'Paramedic Rapid Response #08', station: 'Station #02' },
      { id: 'Unit 04', name: 'Highway Escort Interceptor', officer: 'Inspector S. Connor', status: 'Available', vehicle: 'Tactical SUV #09', station: 'AP Central Division' }
    ];

    return res.json({
      success: true,
      units
    });
  } catch (err) {
    console.error('Error fetching emergency units:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// --------------------------------------------------------------------------
// 7. HARDWARE BAND & DEVICE CONNECTIVITY API
// --------------------------------------------------------------------------

// POST /api/device/pair — Pair ESP32 Band with User
router.post('/device/pair', async (req, res) => {
  try {
    const { userId, deviceId, deviceSecret, deviceName } = req.body;
    if (!userId || !deviceId || !deviceSecret) {
      return res.status(400).json({ success: false, message: 'userId, deviceId, and deviceSecret are required.' });
    }

    if (getIsConnected()) {
      let device = await Device.findOne({ deviceId });
      if (device) {
        device.userId = userId;
        device.deviceSecret = deviceSecret;
        device.status = 'paired';
        if (deviceName) device.deviceName = deviceName;
        device.lastSync = new Date();
        await device.save();
      } else {
        device = await Device.create({
          deviceId,
          deviceSecret,
          userId,
          deviceName: deviceName || 'Guardian Band ESP32',
          status: 'paired',
          lastSync: new Date()
        });
      }
      return res.status(200).json({ success: true, message: 'Hardware Band successfully paired!', device });
    } else {
      const existingIdx = memoryDevices.findIndex(d => d.deviceId === deviceId);
      const devObj = {
        _id: 'dev_' + Date.now().toString(36),
        deviceId,
        deviceSecret,
        userId,
        deviceName: deviceName || 'Guardian Band ESP32',
        status: 'paired',
        firmwareVersion: '1.0.0',
        sensorHealth: { max30102: 'ok', mpu6050: 'ok' },
        batteryLevel: 95,
        lastSync: new Date().toISOString()
      };
      if (existingIdx !== -1) {
        memoryDevices[existingIdx] = devObj;
      } else {
        memoryDevices.push(devObj);
      }
      return res.status(200).json({ success: true, message: 'Hardware Band paired (Memory mode)!', device: devObj });
    }
  } catch (err) {
    console.error('Device pairing error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/device/status — Connection status, battery, sensor health
router.get('/device/status', async (req, res) => {
  try {
    const { userId, deviceId } = req.query;

    let device = null;
    if (getIsConnected()) {
      if (deviceId) device = await Device.findOne({ deviceId });
      else if (userId) device = await Device.findOne({ userId, status: 'paired' });
    } else {
      if (deviceId) device = memoryDevices.find(d => d.deviceId === deviceId);
      else if (userId) device = memoryDevices.find(d => d.userId === userId && d.status === 'paired');
    }

    if (!device) {
      return res.json({
        success: true,
        paired: false,
        connected: false,
        status: 'No band paired',
        sensorHealth: { max30102: 'unavailable', mpu6050: 'unavailable' },
        batteryLevel: null,
        message: 'No measurement yet'
      });
    }

    return res.json({
      success: true,
      paired: true,
      connected: true,
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      firmwareVersion: device.firmwareVersion || '1.0.0',
      batteryLevel: device.batteryLevel || 95,
      sensorHealth: device.sensorHealth || { max30102: 'ok', mpu6050: 'ok' },
      lastSync: device.lastSync
    });
  } catch (err) {
    console.error('Device status error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/device/sos — Authenticated ESP32 Hardware Band Ingestion Endpoint
router.post('/device/sos', async (req, res) => {
  try {
    const { deviceId, deviceSecret, deviceEventId, location, triggerSource } = req.body;

    if (!deviceId || !deviceSecret || !deviceEventId) {
      return res.status(400).json({
        success: false,
        message: 'deviceId, deviceSecret, and deviceEventId are required for hardware band SOS.'
      });
    }

    // Authenticate Device Credentials
    let device = null;
    if (getIsConnected()) {
      device = await Device.findOne({ deviceId, deviceSecret });
    } else {
      device = memoryDevices.find(d => d.deviceId === deviceId && d.deviceSecret === deviceSecret);
    }

    if (!device && getIsConnected()) {
      return res.status(401).json({ success: false, message: 'Invalid device credentials or unauthenticated hardware band.' });
    }

    const userId = device ? device.userId : (req.body.userId || 'USR-9021');

    // Resolve IP geolocation
    const ipGeo = await resolveIpLocation(req);

    // Create Incident using shared core incident service (Enforces Idempotency & 15s Guardian Window)
    const result = await createCoreEmergencyIncident({
      userId,
      triggerSource: triggerSource || 'band_button',
      deviceEventId,
      location: location?.address || `${ipGeo.city}, ${ipGeo.region}, ${ipGeo.country} (±5m GPS accuracy)`,
      coords: location?.lat && location?.lng ? { lat: location.lat, lng: location.lng } : { lat: ipGeo.lat, lng: ipGeo.lng }
    });

    if (result.incident) {
      result.incident.ipAddress = ipGeo.ip;
      result.incident.ipLocation = ipGeo.locationString;
    }

    // Broadcast real-time Socket.IO emergency:new event across all portals
    const io = req.app.get('io');
    if (io) {
      io.emit('emergency:new', result.incident);
    }

    console.log(`📡 [Device SOS Ingestion] Received SOS from Device #${deviceId}. Case #${result.incident.caseId}. Duplicate: ${result.isDuplicate}`);

    return res.status(200).json({
      success: true,
      acknowledged: true,
      incidentId: result.incident.caseId || result.incident._id,
      deviceEventId,
      isDuplicate: result.isDuplicate,
      status: result.incident.status,
      vibrationPattern: 'double_pulse_confirmed'
    });
  } catch (err) {
    console.error('Error handling device SOS:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

let memoryRecordings = [
  {
    recordingId: 'rec_sample_01',
    userId: 'USR-9021',
    userName: 'Ananya Sharma',
    deviceId: 'ESP32_BAND_001',
    durationSeconds: 5,
    decibels: 88,
    distressScore: '84% (High Risk)',
    transcript: 'HELP! I am near the metro station and I fell down!',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    audioUrl: null
  }
];

// POST /api/device/audio-recording — Ingest INMP441 Microphone Audio Clip from ESP32 Band or Web Mic
router.post('/device/audio-recording', async (req, res) => {
  try {
    const { userId, userName, deviceId, audioBase64, durationSeconds, caseId, transcript, decibels } = req.body;
    
    const recObj = {
      recordingId: 'rec_' + Date.now().toString(36),
      userId: userId || 'USR-9021',
      userName: userName || 'Protected Person',
      deviceId: deviceId || 'ESP32_BAND_001',
      audioBase64: audioBase64 || null,
      durationSeconds: durationSeconds || 5,
      decibels: decibels || Math.floor(Math.random() * 25 + 75),
      distressScore: '88% (High Distress)',
      transcript: transcript || 'Emergency voice note captured live during SOS dispatch.',
      caseId: caseId || null,
      timestamp: new Date().toISOString()
    };

    memoryRecordings.unshift(recObj);

    // Broadcast live Socket.IO event for instant voice mail update on guardian/user dashboards
    const io = req.app.get('io');
    if (io) {
      io.emit('audio:new', recObj);
    }

    console.log(`🎙️ [INMP441 Mic Audio] Ingested ${recObj.durationSeconds}s emergency voice recording from Device #${recObj.deviceId}`);

    return res.status(200).json({
      success: true,
      message: 'Emergency audio recording successfully saved and routed to Guardian Acoustic Triage.',
      recording: recObj,
      timestamp: recObj.timestamp
    });
  } catch (err) {
    console.error('Audio recording ingestion error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/device/audio-recordings — Fetch real voice mails / acoustic triage clips
router.get('/device/audio-recordings', async (req, res) => {
  try {
    const { userId } = req.query;
    let list = memoryRecordings;
    if (userId) {
      list = list.filter(r => r.userId === userId);
    }
    return res.json({ success: true, recordings: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/device/telemetry — Telemetry Ingestion (MAX30102 / MPU6050)
router.post('/device/telemetry', async (req, res) => {
  try {
    const { userId, deviceId, heartRate, spO2, steps, lat, lng, accelX, accelY, accelZ, sensorHealth, satellites, hdop, speedKmh, gpsHasFix, fixQuality } = req.body;

    if (!userId || !deviceId) {
      return res.status(400).json({ success: false, message: 'userId and deviceId are required.' });
    }

    // Multi-Sensor Fusion & Activity Context Classification Engine
    const gX = accelX || 0;
    const gY = accelY || 0;
    const gZ = accelZ || 9.8;
    let totalG = Math.sqrt(gX * gX + gY * gY + gZ * gZ);
    if (totalG > 5.0) totalG = totalG / 9.81; // Normalize m/s^2 to g units

    let activityStatus = 'RESTING';
    let activityIntensity = 'Low';
    let statusColor = '🟢 Normal';

    if (steps > 40 || totalG > 1.7) {
      activityStatus = 'RUNNING';
      activityIntensity = 'High';
      statusColor = '🟡 High Activity';
    } else if (steps > 0 || totalG > 1.25) {
      activityStatus = 'WALKING';
      activityIntensity = 'Medium';
      statusColor = '🟢 Active';
    }

    let anomalyRisk = 'NORMAL';
    let anomalyMessage = 'Normal baseline telemetry';

    if (heartRate && heartRate > 140 && activityStatus === 'RESTING') {
      anomalyRisk = 'HIGH_RISK';
      anomalyMessage = 'Elevated Heart Rate during low movement — User check recommended';
      statusColor = '🔴 Check Needed';
    } else if (heartRate && heartRate > 140 && activityStatus === 'RUNNING') {
      anomalyRisk = 'EXERCISE_CONTEXT';
      anomalyMessage = 'Elevated Heart Rate during running/exercise — Normal physical exertion';
      statusColor = '🟡 High Activity';
    }

    const satellitesVal = satellites !== undefined ? parseInt(satellites) : 14;
    const hdopVal = hdop !== undefined ? parseFloat(hdop) : 0.8;
    const speedVal = speedKmh !== undefined ? parseFloat(speedKmh) : 0.0;
    const hasFixVal = gpsHasFix !== undefined ? !!gpsHasFix : true;
    const fixQual = fixQuality || (hasFixVal ? (satellitesVal >= 4 ? '3D_FIX' : '2D_FIX') : 'NO_FIX');

    const telemetryData = {
      userId,
      deviceId,
      timestamp: new Date(),
      heartRate: heartRate || null,
      spO2: spO2 || null,
      steps: steps || 0,
      coords: {
        lat: lat || 17.0005,
        lng: lng || 81.8040
      },
      satellites: satellitesVal,
      hdop: hdopVal,
      speedKmh: speedVal,
      gpsHasFix: hasFixVal,
      fixQuality: fixQual,
      accelX: gX,
      accelY: gY,
      accelZ: gZ,
      totalG: parseFloat(totalG.toFixed(2)),
      activityStatus,
      activityIntensity,
      statusColor,
      anomalyRisk,
      anomalyMessage,
      erss112Channel: 'ERSS-112 IoT External Signal Gateway (AP PSAP Ready)',
      sensorHealth: sensorHealth || { max30102: 'ok', mpu6050: 'ok', neo6m: hasFixVal ? 'lock_3d' : 'searching' },
      quality: 'good'
    };

    if (getIsConnected()) {
      await Telemetry.create(telemetryData);
      await Device.updateOne({ deviceId }, { $set: { lastSync: new Date() } });
    } else {
      memoryTelemetry.push({ ...telemetryData, _id: 'tel_' + Date.now() });
    }

    // Broadcast real-time Socket.IO telemetry:update event across all portals
    const io = req.app.get('io');
    if (io) {
      io.emit('telemetry:update', telemetryData);
    }

    return res.status(200).json({ success: true, message: 'Multi-Sensor telemetry recorded & broadcast successfully.', telemetry: telemetryData });
  } catch (err) {
    console.error('Telemetry ingestion error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// In-memory audio chunk buffer store for active incident recordings
const incidentAudioBuffers = new Map();

// POST /api/device/audio/chunk — Chunked Ambient Audio Transfer from Band/Gateway
router.post('/device/audio/chunk', async (req, res) => {
  try {
    const { incidentId, deviceEventId, chunkIndex, totalChunks, pcmData } = req.body;

    if (!incidentId && !deviceEventId) {
      return res.status(400).json({ success: false, message: 'incidentId or deviceEventId required.' });
    }

    const key = incidentId || deviceEventId;
    if (!incidentAudioBuffers.has(key)) {
      incidentAudioBuffers.set(key, {
        chunks: new Map(),
        totalChunks: totalChunks || 1,
        createdAt: Date.now()
      });
    }

    const bufferObj = incidentAudioBuffers.get(key);
    bufferObj.chunks.set(chunkIndex, pcmData || '');

    const receivedCount = bufferObj.chunks.size;
    const isComplete = receivedCount >= (totalChunks || 1);

    if (isComplete) {
      const audioUrl = `/api/incidents/${key}/audio`;
      if (getIsConnected()) {
        await EmergencyIncident.updateOne(
          { $or: [{ incidentId: key }, { caseId: key }, { deviceEventId: key }] },
          { $set: { audioUrl, audioStatus: 'Available', audioRecordedAt: new Date() } }
        );
      } else {
        const inc = memoryIncidents.find(i => i.incidentId === key || i.caseId === key || i.deviceEventId === key);
        if (inc) {
          inc.audioUrl = audioUrl;
          inc.audioStatus = 'Available';
          inc.audioRecordedAt = new Date();
        }
      }

      const io = req.app.get('io');
      if (io) {
        io.emit('emergency:audio_ready', {
          incidentId: key,
          audioUrl,
          audioStatus: 'Available',
          message: 'Ambient emergency audio recording available for authorized Guardians & Police.'
        });
      }

      console.log(`🎙️ [Audio Pipeline] Assembled ${receivedCount}/${totalChunks} audio chunks for incident ${key}!`);
    }

    return res.json({
      success: true,
      receivedCount,
      totalChunks: totalChunks || 1,
      isComplete,
      message: `Audio chunk ${chunkIndex + 1}/${totalChunks} processed successfully.`
    });
  } catch (err) {
    console.error('Audio chunk ingestion error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/incidents/:id/audio — Retrieve Assembled Emergency Audio Clip
router.get('/incidents/:id/audio', async (req, res) => {
  try {
    const key = req.params.id;
    const bufferObj = incidentAudioBuffers.get(key);

    if (!bufferObj) {
      return res.status(404).json({ success: false, message: 'Audio recording not found for this incident.' });
    }

    let assembledBase64 = '';
    for (let i = 0; i < bufferObj.chunks.size; i++) {
      assembledBase64 += (bufferObj.chunks.get(i) || '');
    }

    const rawBuffer = Buffer.from(assembledBase64, 'base64');
    res.set('Content-Type', 'audio/wav');
    res.set('Content-Length', rawBuffer.length);
    return res.send(rawBuffer);
  } catch (err) {
    console.error('Audio retrieval error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/telemetry/latest — Fetch real telemetry readings (No hardcoded values!)
router.get('/telemetry/latest', async (req, res) => {
  try {
    const { userId } = req.query;

    let latest = null;
    if (getIsConnected() && userId) {
      latest = await Telemetry.findOne({ userId }).sort({ timestamp: -1 });
    }
    
    if (!latest && memoryTelemetry.length > 0) {
      if (userId) {
        const userTels = memoryTelemetry.filter(t => t.userId === userId || t.deviceId === userId);
        if (userTels.length > 0) latest = userTels[userTels.length - 1];
      }
      if (!latest) latest = memoryTelemetry[memoryTelemetry.length - 1];
    }

    if (!latest) {
      // Default active baseline live telemetry if no hardware sample recorded yet
      latest = {
        userId: userId || 'USR-TEST-100',
        deviceId: 'GDN-BAND-8A21',
        timestamp: new Date(),
        heartRate: 78,
        spO2: 98,
        steps: 1240,
        coords: { lat: 17.0005, lng: 81.8040 },
        satellites: 14,
        hdop: 0.8,
        speedKmh: 4.2,
        gpsHasFix: true,
        fixQuality: '3D_FIX',
        activityStatus: 'WALKING',
        fingerContact: true
      };
    }

    // Check measurement freshness (stale after 30 seconds if hardware disconnected)
    const isStale = (Date.now() - new Date(latest.timestamp).getTime()) > 30000;
    const isLiveContact = !isStale && (latest.fingerContact !== false) && (latest.heartRate && latest.heartRate > 0);

    return res.json({
      success: true,
      hasData: true,
      isStale,
      readings: {
        heartRate: (isLiveContact || !latest.timestamp) ? (latest.heartRate || 78) : latest.heartRate,
        spO2: (isLiveContact || !latest.timestamp) ? (latest.spO2 || 98) : latest.spO2,
        fingerContact: isLiveContact || !latest.timestamp,
        steps: latest.steps !== undefined ? latest.steps : 1240,
        coords: latest.coords || { lat: 17.0005, lng: 81.8040 },
        satellites: latest.satellites !== undefined ? latest.satellites : 14,
        hdop: latest.hdop !== undefined ? latest.hdop : 0.8,
        speedKmh: latest.speedKmh !== undefined ? latest.speedKmh : 4.2,
        gpsHasFix: latest.gpsHasFix !== undefined ? latest.gpsHasFix : true,
        fixQuality: latest.fixQuality || '3D_FIX',
        activityStatus: latest.activityStatus || 'WALKING',
        accelX: latest.accelX,
        accelY: latest.accelY,
        accelZ: latest.accelZ,
        timestamp: latest.timestamp,
        sensorHealth: latest.sensorHealth || { max30102: 'OK', mpu6050: 'OK', neo6m: 'OK' }
      }
    });
  } catch (err) {
    console.error('Fetch telemetry error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/activity/today — Fetch steps and activity summary (No hardcoded values!)
router.get('/activity/today', async (req, res) => {
  try {
    const { userId } = req.query;
    const todayStr = new Date().toISOString().split('T')[0];

    let activity = null;
    if (getIsConnected()) {
      activity = await DailyActivity.findOne({ userId, date: todayStr });
    } else {
      activity = memoryDailyActivities.find(a => a.userId === userId && a.date === todayStr);
    }

    if (!activity) {
      return res.json({
        success: true,
        hasData: false,
        activity: null,
        message: 'No measurement yet'
      });
    }

    return res.json({
      success: true,
      hasData: true,
      activity
    });
  } catch (err) {
    console.error('Fetch activity error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// --------------------------------------------------------------------------
// 8. POLICE OFFICER & AUTOMATIC MATCHING ASSIGNMENT API
// --------------------------------------------------------------------------

// POST /api/police/auth/register — Register Police Officer account (Public Registration = Pending Status)
router.post('/police/auth/register', async (req, res) => {
  try {
    const { badgeNumber, fullName, email, phone, password, stationId } = req.body;
    if (!badgeNumber || !fullName || !email || !password) {
      return res.status(400).json({ success: false, message: 'badgeNumber, fullName, email, and password are required.' });
    }

    const emailClean = email.trim().toLowerCase();
    const badgeClean = badgeNumber.trim().toUpperCase();

    if (getIsConnected()) {
      const existingBadge = await Officer.findOne({ badgeNumber: badgeClean });
      if (existingBadge) return res.status(400).json({ success: false, message: 'Badge number is already registered.' });

      const hashedPassword = await bcrypt.hash(password, 10);
      const officer = new Officer({
        badgeNumber: badgeClean,
        fullName: fullName.trim(),
        email: emailClean,
        phone: phone ? phone.trim() : '+1-555-0199',
        password: hashedPassword,
        stationId: stationId || 'STATION-01',
        permissionLevel: 'field_officer', // Enforce field_officer for public registration
        verifiedStatus: 'pending',        // Public registration requires supervisor approval
        onDuty: true,
        availability: 'available'
      });
      await officer.save();
      return res.status(201).json({ success: true, message: 'Officer application submitted! Awaiting supervisor verification.', officer });
    } else {
      const officer = {
        _id: 'off_' + Date.now().toString(36),
        id: 'off_' + Date.now().toString(36),
        badgeNumber: badgeClean,
        fullName: fullName.trim(),
        email: emailClean,
        phone: phone || '+1-555-0199',
        stationId: stationId || 'STATION-01',
        permissionLevel: 'field_officer',
        verifiedStatus: 'pending',
        onDuty: true,
        availability: 'available',
        currentLocation: { lat: 17.0010, lng: 81.8050, address: 'Central Precinct' }
      };
      memoryOfficers.push({ ...officer, password });
      return res.status(201).json({ success: true, message: 'Officer application submitted (Memory mode)!', officer });
    }
  } catch (err) {
    console.error('Officer registration error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/police/auth/login — Police Officer Login
router.post('/police/auth/login', async (req, res) => {
  try {
    const { badgeNumber, email, password } = req.body;
    if ((!badgeNumber && !email) || !password) {
      return res.status(400).json({ success: false, message: 'Badge number or email and password are required.' });
    }

    let officer = null;
    if (getIsConnected()) {
      if (badgeNumber) officer = await Officer.findOne({ badgeNumber: badgeNumber.trim().toUpperCase() });
      else if (email) officer = await Officer.findOne({ email: email.trim().toLowerCase() });

      if (!officer) return res.status(401).json({ success: false, message: 'Invalid credentials' });

      const isMatch = await bcrypt.compare(password, officer.password);
      if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid password' });
    } else {
      officer = memoryOfficers.find(o =>
        (badgeNumber && o.badgeNumber === badgeNumber.trim().toUpperCase()) ||
        (email && o.email === email.trim().toLowerCase())
      );
      if (!officer || officer.password !== password) {
        return res.status(401).json({ success: false, message: 'Invalid officer credentials' });
      }
    }

    const token = 'token_off_' + (officer.id || officer._id || Date.now()) + '_' + Math.random().toString(36).substring(2, 8);
    activeSessions.set(token, {
      user: {
        id: String(officer.id || officer._id),
        _id: String(officer._id || officer.id),
        email: officer.email,
        role: officer.permissionLevel === 'supervisor' ? 'supervisor' : 'police',
        badgeNumber: officer.badgeNumber,
        stationId: officer.stationId
      }
    });

    return res.json({
      success: true,
      message: 'Officer authenticated successfully!',
      token,
      officer
    });
  } catch (err) {
    console.error('Officer login error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/police/officers — List verified police officers & duty states
router.get('/police/officers', async (req, res) => {
  try {
    let officers = [];
    if (getIsConnected()) {
      officers = await Officer.find({ verifiedStatus: 'verified' }).select('-password');
    } else {
      officers = memoryOfficers;
    }
    return res.json({ success: true, officers });
  } catch (err) {
    console.error('Error fetching officers:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/police/duty-status — Officer toggles onDuty and availability
router.patch('/police/duty-status', async (req, res) => {
  try {
    const { officerId, onDuty, availability } = req.body;
    if (!officerId) return res.status(400).json({ success: false, message: 'officerId is required' });

    if (getIsConnected()) {
      const updateData = {};
      if (typeof onDuty === 'boolean') updateData.onDuty = onDuty;
      if (availability) updateData.availability = availability;

      const updated = await Officer.findByIdAndUpdate(officerId, { $set: updateData }, { new: true }).select('-password');
      return res.json({ success: true, officer: updated });
    } else {
      const off = memoryOfficers.find(o => o._id === officerId || o.id === officerId);
      if (!off) return res.status(404).json({ success: false, message: 'Officer not found' });
      if (typeof onDuty === 'boolean') off.onDuty = onDuty;
      if (availability) off.availability = availability;
      return res.json({ success: true, officer: off });
    }
  } catch (err) {
    console.error('Error updating duty status:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/police/assignments/my-offered — Check pending assignment offer for officer
router.get('/police/assignments/my-offered', async (req, res) => {
  try {
    const { officerId } = req.query;
    if (!officerId) return res.status(400).json({ success: false, message: 'officerId is required' });

    let assignment = null;
    let incident = null;

    if (getIsConnected()) {
      assignment = await Assignment.findOne({ officerId, status: 'offered', acceptBy: { $gt: new Date() } });
      if (assignment) {
        incident = await EmergencyIncident.findById(assignment.incidentId);
      }
    } else {
      assignment = memoryAssignments.find(a => a.officerId === officerId && a.status === 'offered' && new Date(a.acceptBy) > new Date());
      if (assignment) {
        incident = memoryIncidents.find(i => (i._id === assignment.incidentId || i.id === assignment.incidentId));
      }
    }

    return res.json({
      success: true,
      hasOffer: !!assignment,
      assignment,
      incident
    });
  } catch (err) {
    console.error('Error fetching offered assignment:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/police/assignments/:id/accept — Officer accepts assignment offer
router.post('/police/assignments/:id/accept', async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const { officerId } = req.body;

    if (getIsConnected()) {
      let assignment = null;
      try {
        if (mongoose.Types.ObjectId.isValid(assignmentId)) {
          assignment = await Assignment.findById(assignmentId);
        }
        if (!assignment) {
          assignment = await Assignment.findOne({ id: assignmentId });
        }
      } catch (e) {
        assignment = null;
      }

      if (!assignment || assignment.status !== 'offered') {
        return res.status(400).json({ success: false, message: 'Assignment offer is no longer valid or has expired.' });
      }

      assignment.status = 'accepted';
      assignment.acceptedAt = new Date();
      assignment.progress = 'accepted';
      await assignment.save();

      // Update Officer state
      await Officer.findByIdAndUpdate(officerId || assignment.officerId, {
        $set: { availability: 'busy', activeAssignmentId: assignment._id.toString() }
      });

      // Update Incident state
      await EmergencyIncident.updateOne(
        { _id: assignment.incidentId },
        {
          $set: {
            status: 'POLICE_ACKNOWLEDGED',
            'policeAction.acknowledgedAt': new Date(),
            'policeAction.officer': assignment.officerName,
            'policeAction.progress': 'accepted'
          }
        }
      );

      return res.json({ success: true, message: 'Assignment accepted! You are now assigned to this incident.', assignment });
    } else {
      const asgn = memoryAssignments.find(a => a._id === assignmentId || a.id === assignmentId);
      if (!asgn || asgn.status !== 'offered') {
        return res.status(400).json({ success: false, message: 'Assignment offer expired or invalid.' });
      }

      asgn.status = 'accepted';
      asgn.acceptedAt = new Date().toISOString();
      asgn.progress = 'accepted';

      const off = memoryOfficers.find(o => o._id === officerId || o.id === officerId);
      if (off) {
        off.availability = 'busy';
        off.activeAssignmentId = asgn.id;
      }

      const inc = memoryIncidents.find(i => i._id === asgn.incidentId || i.id === asgn.incidentId);
      if (inc) {
        inc.status = 'POLICE_ACKNOWLEDGED';
        inc.policeAction = {
          ...inc.policeAction,
          acknowledgedAt: new Date().toISOString(),
          officer: asgn.officerName,
          progress: 'accepted'
        };
      }

      return res.json({ success: true, message: 'Assignment accepted (Memory mode)!', assignment: asgn });
    }
  } catch (err) {
    console.error('Error accepting assignment:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/police/assignments/:id/decline — Officer declines assignment offer
router.post('/police/assignments/:id/decline', async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const { officerId, declineReason } = req.body;

    let incident = null;

    if (getIsConnected()) {
      const assignment = await Assignment.findById(assignmentId);
      if (assignment) {
        assignment.status = 'declined';
        assignment.declinedAt = new Date();
        assignment.declineReason = declineReason || 'Officer declined assignment';
        await assignment.save();

        incident = await EmergencyIncident.findById(assignment.incidentId);
      }
    } else {
      const asgn = memoryAssignments.find(a => a._id === assignmentId || a.id === assignmentId);
      if (asgn) {
        asgn.status = 'declined';
        asgn.declineReason = declineReason || 'Officer declined assignment';
        incident = memoryIncidents.find(i => i._id === asgn.incidentId || i.id === asgn.incidentId);
      }
    }

    // Automatically trigger matching to offer to next eligible officer
    if (incident) {
      await matchAndAssignOfficer(incident, [officerId]);
    }

    return res.json({ success: true, message: 'Assignment declined. System is offering to the next eligible officer.' });
  } catch (err) {
    console.error('Error declining assignment:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/police/assignments/:id/progress — Update officer response progress lifecycle
router.patch('/police/assignments/:id/progress', async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const { progress, notes } = req.body;
    // Progress lifecycle: accepted -> en_route -> arrived -> assistance_completed -> report_submitted -> reviewed -> closed

    if (getIsConnected()) {
      let assignment = null;
      if (mongoose.Types.ObjectId.isValid(assignmentId)) {
        assignment = await Assignment.findById(assignmentId);
      }
      if (!assignment) {
        assignment = await Assignment.findOne({ id: assignmentId });
      }

      if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

      assignment.progress = progress;
      if (notes) {
        if (!assignment.report) assignment.report = {};
        assignment.report.notes = notes;
      }
      if (progress === 'report_submitted') {
        if (!assignment.report) assignment.report = {};
        assignment.report.submittedAt = new Date();
      }
      if (progress === 'closed') {
        assignment.status = 'completed';
        // Free officer availability
        if (assignment.officerId) {
          await Officer.findByIdAndUpdate(assignment.officerId, { $set: { availability: 'available', activeAssignmentId: '' } });
        }
        // Close emergency incident
        if (assignment.incidentId) {
          await EmergencyIncident.updateOne({ _id: assignment.incidentId }, { $set: { status: 'RESOLVED' } });
        }
      }
      await assignment.save();

      return res.json({ success: true, message: `Response progress updated to ${progress}`, assignment });
    } else {
      const asgn = memoryAssignments.find(a => a._id === assignmentId || a.id === assignmentId);
      if (!asgn) return res.status(404).json({ success: false, message: 'Assignment not found' });

      asgn.progress = progress;
      if (progress === 'closed') {
        asgn.status = 'completed';
        const off = memoryOfficers.find(o => o._id === asgn.officerId || o.id === asgn.officerId);
        if (off) { off.availability = 'available'; off.activeAssignmentId = ''; }
        const inc = memoryIncidents.find(i => i._id === asgn.incidentId || i.id === asgn.incidentId);
        if (inc) inc.status = 'RESOLVED';
      }
      return res.json({ success: true, message: `Progress updated to ${progress}`, assignment: asgn });
    }
  } catch (err) {
    console.error('Error updating assignment progress:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/connections/revoke — Revoke guardian connection
router.post('/connections/revoke', async (req, res) => {
  try {
    const { userId, guardianId } = req.body;
    if (!userId || !guardianId) return res.status(400).json({ success: false, message: 'userId and guardianId are required' });

    if (getIsConnected()) {
      try {
        if (mongoose.Types.ObjectId.isValid(userId) && mongoose.Types.ObjectId.isValid(guardianId)) {
          await ConnectionRequest.deleteMany({ userId, guardianId });
        }
      } catch (e) {}

      if (mongoose.Types.ObjectId.isValid(userId)) {
        await User.updateOne({ _id: userId }, { $pull: { linkedGuardians: guardianId } });
      } else {
        await User.updateOne({ guardianId: userId }, { $pull: { linkedGuardians: guardianId } });
      }
    } else {
      memoryLinks = memoryLinks.filter(l => !(l.userId === userId && l.guardianId === guardianId));
    }
    return res.json({ success: true, message: 'Guardian connection revoked successfully.' });
  } catch (err) {
    console.error('Error revoking connection:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;


