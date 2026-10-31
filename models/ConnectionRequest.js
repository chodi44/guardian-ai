const mongoose = require('mongoose');

const connectionRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  guardianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Guardian',
    required: true,
    index: true
  },
  relationship: {
    type: String,
    default: 'Guardian',
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'revoked'],
    default: 'pending',
    index: true
  },
  requestDate: {
    type: Date,
    default: Date.now
  },
  approvedDate: {
    type: Date,
    default: null
  },
  permissions: {
    sosAlerts: { type: Boolean, default: true },
    location: { type: Boolean, default: false },
    incidentHistory: { type: Boolean, default: false },
    insights: { type: Boolean, default: false },
    audio: { type: Boolean, default: false }
  },
  permissionRequests: [{
    type: String
  }]
});

// Ensure a guardian can only have one active/pending connection record with a given user
connectionRequestSchema.index({ userId: 1, guardianId: 1 });

module.exports = mongoose.model('ConnectionRequest', connectionRequestSchema);
