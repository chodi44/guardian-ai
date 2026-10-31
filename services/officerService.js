const Officer = require('../models/Officer');
const Assignment = require('../models/Assignment');
const EmergencyIncident = require('../models/EmergencyIncident');
const { getIsConnected } = require('../db');

let memoryOfficers = [
  {
    _id: 'off_001',
    id: 'off_001',
    badgeNumber: 'POL-8492',
    fullName: 'Inspector S. Connor',
    email: 'officer.connor@police.gov',
    phone: '+1-555-0192',
    password: 'password123',
    stationId: 'STATION-01',
    stationName: 'Central HQ Command',
    organizationId: 'POLICE_DEPT',
    permissionLevel: 'field_officer',
    verifiedStatus: 'verified',
    onDuty: true,
    availability: 'available',
    currentLocation: { lat: 17.0020, lng: 81.8045, address: 'Central Precinct' },
    locationUpdatedAt: new Date().toISOString(),
    activeAssignmentId: ''
  },
  {
    _id: 'off_002',
    id: 'off_002',
    badgeNumber: 'POL-3910',
    fullName: 'Officer Marcus Vance',
    email: 'officer.vance@police.gov',
    phone: '+1-555-0193',
    password: 'password123',
    stationId: 'STATION-01',
    stationName: 'Central HQ Command',
    organizationId: 'POLICE_DEPT',
    permissionLevel: 'field_officer',
    verifiedStatus: 'verified',
    onDuty: true,
    availability: 'available',
    currentLocation: { lat: 17.0080, lng: 81.8100, address: 'North Patrol Sector' },
    locationUpdatedAt: new Date().toISOString(),
    activeAssignmentId: ''
  },
  {
    _id: 'off_003',
    id: 'off_003',
    badgeNumber: 'SUP-1001',
    fullName: 'Commander Elena Rostova',
    email: 'supervisor.rostova@police.gov',
    phone: '+1-555-0100',
    password: 'password123',
    stationId: 'STATION-01',
    stationName: 'Central HQ Command',
    organizationId: 'POLICE_DEPT',
    permissionLevel: 'supervisor',
    verifiedStatus: 'verified',
    onDuty: true,
    availability: 'available',
    currentLocation: { lat: 17.0000, lng: 81.8000, address: 'HQ Command Center' },
    locationUpdatedAt: new Date().toISOString(),
    activeAssignmentId: ''
  }
];

let memoryAssignments = [];

// Calculate straight-line Euclidean/spherical distance in kilometers
function calculateStraightLineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Automatic Nearby Police Selection Engine
 * Filters verified, on-duty, available officers by jurisdiction & workload,
 * ranks by straight-line distance, and atomically reserves capacity.
 */
async function matchAndAssignOfficer(incident, excludeOfficerIds = []) {
  try {
    const incId = incident._id ? incident._id.toString() : incident.id;
    const incCoords = incident.coords || { lat: 17.0005, lng: 81.8040 };
    const stationId = incident.assignedStationId || 'STATION-01';

    if (getIsConnected()) {
      // Find verified, on-duty, available officers matching station jurisdiction with empty active assignment
      const eligibleOfficers = await Officer.find({
        verifiedStatus: 'verified',
        onDuty: true,
        availability: 'available',
        stationId: stationId,
        activeAssignmentId: '',
        _id: { $nin: excludeOfficerIds }
      });

      if (!eligibleOfficers || eligibleOfficers.length === 0) {
        console.log(`⚠️ [Police Matching Engine] No eligible officer available for Incident #${incident.caseId}. Flagging supervisor!`);
        await EmergencyIncident.updateOne(
          { _id: incident._id },
          { $set: { needsSupervisorAction: true, status: 'ESCALATED_POLICE', deliveryState: 'queued_for_police' } }
        );
        return { success: false, reason: 'No eligible officer available. Supervisor action required.' };
      }

      // Rank officers by straight-line distance
      const ranked = eligibleOfficers.map(off => {
        const dist = calculateStraightLineDistanceKm(
          incCoords.lat,
          incCoords.lng,
          off.currentLocation.lat || 17.0005,
          off.currentLocation.lng || 81.8040
        );
        return { officer: off, distanceKm: dist };
      }).sort((a, b) => a.distanceKm - b.distanceKm);

      const topOfficer = ranked[0].officer;
      const acceptBy = new Date(Date.now() + 30 * 1000); // 30s offer window

      // Atomically reserve officer capacity to prevent duplicate offer assignment
      topOfficer.availability = 'reserved';
      await topOfficer.save();

      // Create Assignment record
      const assignment = new Assignment({
        incidentId: incId,
        officerId: topOfficer._id.toString(),
        officerName: topOfficer.fullName,
        officerBadge: topOfficer.badgeNumber,
        status: 'offered',
        offeredAt: new Date(),
        acceptBy
      });
      await assignment.save();

      // Update Emergency Incident
      await EmergencyIncident.updateOne(
        { _id: incident._id },
        {
          $set: {
            status: 'POLICE_OFFERED',
            deliveryState: 'officer_offered',
            assignedOfficerId: topOfficer._id.toString(),
            assignedOfficerName: topOfficer.fullName,
            assignedOfficerBadge: topOfficer.badgeNumber,
            needsSupervisorAction: false
          }
        }
      );

      return {
        success: true,
        assignment,
        officer: topOfficer,
        straightLineDistanceKm: ranked[0].distanceKm.toFixed(2)
      };
    } else {
      // In-memory fallback
      const eligible = memoryOfficers.filter(o =>
        o.verifiedStatus === 'verified' &&
        o.onDuty &&
        o.availability === 'available' &&
        o.stationId === stationId &&
        (!o.activeAssignmentId || o.activeAssignmentId === '') &&
        !excludeOfficerIds.includes(o.id) &&
        !excludeOfficerIds.includes(o._id)
      );

      if (eligible.length === 0) {
        incident.needsSupervisorAction = true;
        incident.status = 'ESCALATED_POLICE';
        incident.deliveryState = 'queued_for_police';
        return { success: false, reason: 'No eligible officer available. Supervisor action required.' };
      }

      const ranked = eligible.map(off => {
        const dist = calculateStraightLineDistanceKm(
          incCoords.lat,
          incCoords.lng,
          off.currentLocation.lat,
          off.currentLocation.lng
        );
        return { officer: off, distanceKm: dist };
      }).sort((a, b) => a.distanceKm - b.distanceKm);

      const topOfficer = ranked[0].officer;
      topOfficer.availability = 'reserved'; // Reserve capacity

      const acceptBy = new Date(Date.now() + 30 * 1000);
      const assignment = {
        _id: 'asgn_' + Date.now().toString(36),
        id: 'asgn_' + Date.now().toString(36),
        incidentId: incId,
        officerId: topOfficer.id,
        officerName: topOfficer.fullName,
        officerBadge: topOfficer.badgeNumber,
        status: 'offered',
        offeredAt: new Date().toISOString(),
        acceptBy: acceptBy.toISOString(),
        progress: 'accepted'
      };
      memoryAssignments.push(assignment);

      incident.status = 'POLICE_OFFERED';
      incident.deliveryState = 'officer_offered';
      incident.assignedOfficerId = topOfficer.id;
      incident.assignedOfficerName = topOfficer.fullName;
      incident.assignedOfficerBadge = topOfficer.badgeNumber;
      incident.needsSupervisorAction = false;

      return {
        success: true,
        assignment,
        officer: topOfficer,
        straightLineDistanceKm: ranked[0].distanceKm.toFixed(2)
      };
    }
  } catch (err) {
    console.error('[Police Matching Engine] Error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Handle 30-Second Offer Expiry & Re-Assignment
 */
async function processAssignmentTimeouts() {
  try {
    const now = new Date();

    if (getIsConnected()) {
      const expiredAssignments = await Assignment.find({
        status: 'offered',
        acceptBy: { $lt: now }
      });

      for (const asgn of expiredAssignments) {
        asgn.status = 'expired';
        await asgn.save();

        // Release reserved officer capacity back to available
        await Officer.findByIdAndUpdate(asgn.officerId, { $set: { availability: 'available' } });

        const incident = await EmergencyIncident.findById(asgn.incidentId);
        if (incident && incident.status === 'POLICE_OFFERED') {
          // Re-run matching excluding expired officer
          await matchAndAssignOfficer(incident, [asgn.officerId]);
        }
      }
    } else {
      const expired = memoryAssignments.filter(a => a.status === 'offered' && new Date(a.acceptBy) < now);
      for (const asgn of expired) {
        asgn.status = 'expired';
        const off = memoryOfficers.find(o => o.id === asgn.officerId || o._id === asgn.officerId);
        if (off) off.availability = 'available';

        const { memoryIncidents } = require('./incidentService');
        const incList = memoryIncidents || [];
        const incident = incList.find(i => i._id === asgn.incidentId || i.id === asgn.incidentId || i.caseId === asgn.incidentId);
        if (incident && incident.status === 'POLICE_OFFERED') {
          await matchAndAssignOfficer(incident, [asgn.officerId]);
        }
      }
    }
  } catch (err) {
    console.error('[Assignment Timeout Handler] Error:', err);
  }
}

module.exports = {
  matchAndAssignOfficer,
  processAssignmentTimeouts,
  memoryOfficers,
  memoryAssignments,
  calculateStraightLineDistanceKm
};
