const mongoose = require('mongoose');

const emergencyIncidentSchema = new mongoose.Schema({
  caseId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true,
    trim: true
  },
  userPhone: {
    type: String,
    default: ''
  },
  guardianId: {
    type: String,
    default: ''
  },
  guardianName: {
    type: String,
    default: ''
  },
  actionType: {
    type: String,
    enum: ['check_on_me', 'emergency_sos'],
    default: 'emergency_sos'
  },
  deliveryState: {
    type: String,
    enum: [
      'backend_persisted',         // Saved on backend
      'queued_for_police',        // Queued in emergency buffer
      'receiving_system_confirmed',// External police system acknowledged intake
      'police_staff_acknowledged',// EOC dispatcher staff acknowledged
      'officer_offered',          // Assignment offer sent to specific officer
      'officer_accepted',         // Officer explicitly accepted
      'officer_en_route',         // Officer travelling
      'delivery_not_confirmed'    // Transmitted but ACK lost
    ],
    default: 'backend_persisted'
  },
  checkInStatus: {
    type: String,
    enum: ['none', 'awaiting_user_response', 'user_confirmed_safe', 'user_requested_help', 'checkin_timeout_unresponsive'],
    default: 'none'
  },
  location: {
    type: String,
    default: 'Main Campus Gate (±5m GPS accuracy)'
  },
  locationFreshness: {
    type: String,
    default: 'Live GPS'
  },
  coords: {
    lat: { type: Number, default: 17.0005 },
    lng: { type: Number, default: 81.8040 }
  },
  reason: {
    type: String,
    default: 'Explicit Emergency SOS Activated by User'
  },
  severity: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Critical'
  },
  status: {
    type: String,
    enum: [
      'PENDING_GUARDIAN',    // Check-in window active
      'GUARDIAN_RESPONDED', // Guardian responded & assisting
      'ESCALATED_POLICE',   // Incident queued for police operation
      'POLICE_OFFERED',     // Offer sent to nearby eligible officer (Unassigned)
      'POLICE_ACKNOWLEDGED',// Officer accepted assignment
      'EN_ROUTE',           // Officer travelling
      'ARRIVED',            // Officer arrived
      'ASSISTANCE_COMPLETED',// Assistance rendered
      'REPORT_SUBMITTED',   // Incident report submitted
      'AUTHORIZED_REVIEW',  // Supervisor reviewing report
      'DISPATCHED',         // Unit dispatched
      'RESOLVED'            // Case closed
    ],
    default: 'ESCALATED_POLICE',
    index: true
  },
  triggerSource: {
    type: String,
    enum: ['MANUAL_SOS', 'CHECK_IN_MANUAL', 'SENSOR_CHECK_IN', 'band_button', 'app'],
    default: 'MANUAL_SOS'
  },
  deviceEventId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  voiceRecording: {
    hasAudio: { type: Boolean, default: false },
    audioUrl: { type: String, default: '' },
    recordedAt: { type: Date },
    durationSeconds: { type: Number, default: 0 },
    transcript: { type: String, default: '' }
  },
  cancellationRequest: {
    requested: { type: Boolean, default: false },
    requestedAt: { type: Date },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['none', 'pending_police_review', 'approved_closed', 'rejected_continued'], default: 'none' }
  },
  needsSupervisorAction: {
    type: Boolean,
    default: false
  },
  assignedOfficerId: { type: String, default: '' },
  assignedOfficerName: { type: String, default: '' },
  assignedOfficerBadge: { type: String, default: '' },
  assignedStationId: { type: String, default: 'STATION-01' },
  policeAction: {
    acknowledgedAt: { type: Date },
    officer: { type: String, default: '' },
    dispatchedUnit: { type: String, default: '' },
    dispatchedAt: { type: Date },
    eta: { type: String, default: '' },
    resolvedAt: { type: Date },
    progress: { type: String, enum: ['accepted', 'en_route', 'arrived', 'assistance_completed', 'report_submitted', 'authorized_review', 'closed', 'none'], default: 'none' },
    reportNotes: { type: String, default: '' }
  },
  auditTrail: [
    {
      step: { type: Number },
      title: { type: String },
      time: { type: String },
      desc: { type: String },
      statusClass: { type: String }
    }
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EmergencyIncident', emergencyIncidentSchema);
