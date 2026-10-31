const EmergencyIncident = require('../models/EmergencyIncident');
const { getIsConnected } = require('../db');

let memoryIncidents = [];

function formatTime(d) {
  const date = d || new Date();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Shared Core Incident Creation Service
 * Preserves exact trigger sources: MANUAL_SOS, CHECK_IN_MANUAL, SENSOR_CHECK_IN.
 * Enforces database-level uniqueness via deviceEventId and idempotent retries.
 */
async function createCoreEmergencyIncident(params) {
  const {
    userId = 'USR-9021',
    userName = 'Protected User',
    userPhone = '9876543210',
    guardianId = '',
    guardianName = 'Primary Guardian',
    location = 'Main Campus Gate (±5m GPS accuracy)',
    coords = { lat: 17.0005, lng: 81.8040 },
    reason = '',
    severity = 'Critical',
    bpm = 0,
    triggerSource = 'MANUAL_SOS',
    deviceEventId = null,
    actionType = 'emergency_sos',
    locationFreshness = 'Live GPS',
    assignedStationId = 'STATION-01'
  } = params;

  const now = new Date();
  const nowStr = formatTime(now);

  // 1. Idempotent Deduplication Check for Device SOS (Enforces Database Event Uniqueness)
  if (deviceEventId) {
    if (getIsConnected()) {
      const existing = await EmergencyIncident.findOne({ deviceEventId });
      if (existing) {
        console.log(`ℹ️ [Incident Service] Duplicate deviceEventId ${deviceEventId} received. Returning original incident.`);
        return { incident: existing, isDuplicate: true };
      }
    } else {
      const existing = memoryIncidents.find(i => i.deviceEventId === deviceEventId);
      if (existing) {
        console.log(`ℹ️ [Incident Service (Memory)] Duplicate deviceEventId ${deviceEventId} received.`);
        return { incident: existing, isDuplicate: true };
      }
    }
  }

  const caseId = 'GA-' + (Date.now() % 8999 + 1000) + Math.floor(10 + Math.random() * 90);

  // Normalize Trigger Sources
  const normalizedTriggerSource =
    triggerSource === 'band_button' ? 'MANUAL_SOS' :
    triggerSource === 'fall_sensor' ? 'SENSOR_CHECK_IN' :
    triggerSource === 'check_in' ? 'CHECK_IN_MANUAL' :
    triggerSource;

  const isExplicitSos = actionType === 'emergency_sos' || normalizedTriggerSource === 'MANUAL_SOS';

  // Format reason without mislabeling manual requests as sensor anomalies
  const defaultReason =
    normalizedTriggerSource === 'MANUAL_SOS' ? 'Explicit Manual Emergency SOS Activated by User' :
    normalizedTriggerSource === 'CHECK_IN_MANUAL' ? 'Manual User Check-In Request' :
    normalizedTriggerSource === 'SENSOR_CHECK_IN' ? 'Unusual motion/sensor check-in initiated' :
    'Emergency Alert Activated';

  const initialAudit = [
    {
      step: 1,
      title: `Incident Initialized (${normalizedTriggerSource})`,
      time: nowStr,
      desc: `Trigger source: ${normalizedTriggerSource}. Action: ${actionType}. Location: ${location} (${locationFreshness}).`,
      statusClass: isExplicitSos ? 'error' : 'warning'
    },
    {
      step: 2,
      title: 'Backend Persisted',
      time: nowStr,
      desc: 'Incident recorded in central MongoDB storage.',
      statusClass: 'primary'
    }
  ];

  const incidentData = {
    caseId,
    userId,
    userName,
    userPhone,
    guardianId,
    guardianName,
    actionType: isExplicitSos ? 'emergency_sos' : 'check_on_me',
    deliveryState: isExplicitSos ? 'queued_for_police' : 'backend_persisted',
    checkInStatus: isExplicitSos ? 'none' : 'awaiting_user_response',
    location,
    locationFreshness,
    coords,
    reason: reason || defaultReason,
    severity,
    score: isExplicitSos ? 95 : 65,
    bpm,
    status: 'PENDING_GUARDIAN',
    triggerSource: normalizedTriggerSource,
    deviceEventId: deviceEventId || undefined,
    sosTriggeredAt: now,
    guardianTimeoutSeconds: 300, // 5 minutes (300s) Guardian response window
    guardianTimeoutAt: new Date(now.getTime() + 300 * 1000),
    guardianAcknowledgementDeadline: new Date(now.getTime() + 300 * 1000),
    assignedStationId,
    voiceRecording: {
      hasAudio: true,
      audioUrl: '/assets/audio/emergency_voice_sample.mp3',
      recordedAt: now,
      durationSeconds: 5,
      transcript: 'Distress voice note captured'
    },
    auditTrail: initialAudit
  };

  let savedIncident;

  if (getIsConnected()) {
    // Clear/resolve older active incidents for this user to keep current alert fresh
    await EmergencyIncident.updateMany(
      { userId: incidentData.userId, status: { $in: ['PENDING_GUARDIAN', 'ESCALATED_POLICE', 'POLICE_ACKNOWLEDGED', 'DISPATCHED'] } },
      { $set: { status: 'RESOLVED', 'policeAction.resolvedAt': now } }
    );
    savedIncident = await EmergencyIncident.create(incidentData);
  } else {
    memoryIncidents = memoryIncidents.map(inc => {
      if (inc.userId === incidentData.userId && ['PENDING_GUARDIAN', 'ESCALATED_POLICE', 'POLICE_ACKNOWLEDGED', 'DISPATCHED'].includes(inc.status)) {
        return { ...inc, status: 'RESOLVED' };
      }
      return inc;
    });
    savedIncident = { ...incidentData, _id: 'inc_' + Date.now() };
    memoryIncidents.push(savedIncident);
  }

  // If explicit MANUAL_SOS: Immediately trigger nearby police officer matching in parallel!
  if (isExplicitSos) {
    console.log(`⚡ [Immediate Parallel Dispatch] Triggering officer matching for Case #${caseId}`);
    const { matchAndAssignOfficer } = require('./officerService');
    await matchAndAssignOfficer(savedIncident);
  }

  return { incident: savedIncident, isDuplicate: false };
}

module.exports = {
  createCoreEmergencyIncident,
  memoryIncidents,
  formatTime
};
