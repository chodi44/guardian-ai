const EmergencyIncident = require('../models/EmergencyIncident');
const { getIsConnected } = require('../db');
const { matchAndAssignOfficer, processAssignmentTimeouts } = require('./officerService');

/**
 * Background Escalation Engine & Deadline Scheduler
 * Evaluates Guardian 15s acknowledgement deadlines & 10m followup deadlines.
 * Automatically recovers pending timers after a backend restart.
 */
async function checkAndProcessDeadlines(memoryIncidentsRef = []) {
  try {
    const now = new Date();

    if (getIsConnected()) {
      // 1. Process 5-minute Guardian Acknowledgement Deadlines
      const unacknowledgedIncidents = await EmergencyIncident.find({
        status: 'PENDING_GUARDIAN',
        guardianAcknowledgementDeadline: { $lte: now }
      });

      for (const incident of unacknowledgedIncidents) {
        console.log(`⏱️ [Escalation Engine] 5-min Guardian Timeout reached for Incident #${incident.caseId}. Escalating to Police!`);
        
        incident.status = 'ESCALATED_POLICE';
        incident.escalatedAt = now;
        incident.escalationReason = 'Automatic 5-minute Guardian Response Timeout Expired';
        
        if (!incident.auditTrail) incident.auditTrail = [];
        incident.auditTrail.push({
          step: incident.auditTrail.length + 1,
          title: 'Auto Police Escalation (5m Timeout)',
          time: new Date().toLocaleTimeString(),
          desc: 'Guardian did not respond within 5 minutes (300s). Emergency automatically escalated to Police Command.',
          statusClass: 'bg-red-500'
        });

        await incident.save();
        
        // Trigger automatic nearby officer selection
        await matchAndAssignOfficer(incident);
      }

      // 2. Process 10-minute Guardian Followup Deadlines
      const unconfirmedFollowups = await EmergencyIncident.find({
        status: 'GUARDIAN_RESPONDED',
        guardianFollowupDeadline: { $lte: now }
      });

      for (const incident of unconfirmedFollowups) {
        console.log(`⏱️ [Escalation Engine] 10-min Guardian Followup Timeout reached for Incident #${incident.caseId}. Escalating to Police!`);

        incident.status = 'ESCALATED_POLICE';
        incident.escalatedAt = now;
        incident.escalationReason = '10-minute Guardian Followup Timeout Expired without Resolution';

        if (!incident.auditTrail) incident.auditTrail = [];
        incident.auditTrail.push({
          step: incident.auditTrail.length + 1,
          title: 'Auto Police Escalation (10m Followup Timeout)',
          time: new Date().toLocaleTimeString(),
          desc: '10 minutes elapsed without resolution confirmation. Emergency escalated to Police Command.',
          statusClass: 'bg-red-500'
        });

        await incident.save();
        await matchAndAssignOfficer(incident);
      }

      // 3. Process Police Officer assignment timeouts (30s offer expire)
      await processAssignmentTimeouts();

    } else {
      // In-memory fallback mode
      for (const incident of memoryIncidentsRef) {
        // 5-minute timeout check
        if (
          incident.status === 'PENDING_GUARDIAN' &&
          incident.guardianAcknowledgementDeadline &&
          new Date(incident.guardianAcknowledgementDeadline) <= now
        ) {
          console.log(`⏱️ [Escalation Engine (Memory)] 5m Guardian Timeout reached for Incident #${incident.caseId}`);
          incident.status = 'ESCALATED_POLICE';
          incident.escalatedAt = now.toISOString();
          incident.escalationReason = 'Automatic 5-minute Guardian Response Timeout Expired';
          
          if (!incident.auditTrail) incident.auditTrail = [];
          incident.auditTrail.push({
            step: incident.auditTrail.length + 1,
            title: 'Auto Police Escalation (5m Timeout)',
            time: new Date().toLocaleTimeString(),
            desc: 'Guardian did not respond within 5 minutes (300s). Emergency automatically escalated to Police Command.',
            statusClass: 'bg-red-500'
          });

          await matchAndAssignOfficer(incident);
        }

        // 10-minute followup timeout check
        if (
          incident.status === 'GUARDIAN_RESPONDED' &&
          incident.guardianFollowupDeadline &&
          new Date(incident.guardianFollowupDeadline) <= now
        ) {
          console.log(`⏱️ [Escalation Engine (Memory)] 10m Guardian Followup Timeout reached for Incident #${incident.caseId}`);
          incident.status = 'ESCALATED_POLICE';
          incident.escalatedAt = now.toISOString();
          incident.escalationReason = '10-minute Guardian Followup Timeout Expired without Resolution';

          if (!incident.auditTrail) incident.auditTrail = [];
          incident.auditTrail.push({
            step: incident.auditTrail.length + 1,
            title: 'Auto Police Escalation (10m Followup Timeout)',
            time: new Date().toLocaleTimeString(),
            desc: '10 minutes elapsed without resolution. Emergency escalated to Police Command.',
            statusClass: 'bg-red-500'
          });

          await matchAndAssignOfficer(incident);
        }
      }

      await processAssignmentTimeouts();
    }
  } catch (err) {
    if (err.name === 'MongoServerSelectionError' || err.code === 'ENOTFOUND' || (err.message && err.message.includes('ENOTFOUND'))) {
      // Offline / DNS error, cleanly ignored to fallback to memory
      return;
    }
    console.error('[Escalation Engine] Error processing deadlines:', err.message);
  }
}

// Start persistent background scheduler (runs every 2 seconds)
let intervalId = null;

function startEscalationScheduler(memoryIncidentsRef = []) {
  if (intervalId) clearInterval(intervalId);
  console.log('⚡ [Escalation Engine] Started persistent Guardian deadline & escalation scheduler (2s interval).');
  intervalId = setInterval(() => {
    checkAndProcessDeadlines(memoryIncidentsRef);
  }, 2000);
}

module.exports = {
  checkAndProcessDeadlines,
  startEscalationScheduler
};
