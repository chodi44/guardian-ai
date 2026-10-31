const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  id: {
    type: String,
    sparse: true,
    index: true
  },
  incidentId: {
    type: String,
    required: true,
    index: true
  },
  officerId: {
    type: String,
    required: true,
    index: true
  },
  officerName: {
    type: String,
    default: ''
  },
  officerBadge: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['offered', 'accepted', 'declined', 'expired', 'completed'],
    default: 'offered',
    index: true
  },
  offeredAt: {
    type: Date,
    default: Date.now
  },
  acceptBy: {
    type: Date,
    required: true
  },
  acceptedAt: {
    type: Date
  },
  declinedAt: {
    type: Date
  },
  declineReason: {
    type: String,
    default: ''
  },
  progress: {
    type: String,
    enum: ['accepted', 'en_route', 'arrived', 'assistance_completed', 'report_submitted', 'authorized_review', 'closed'],
    default: 'accepted'
  },
  report: {
    notes: { type: String, default: '' },
    submittedAt: { type: Date }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Assignment', assignmentSchema);
