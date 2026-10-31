const mongoose = require('mongoose');

const officerSchema = new mongoose.Schema({
  badgeNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  stationId: {
    type: String,
    default: 'STATION-01'
  },
  stationName: {
    type: String,
    default: 'Central Police Command'
  },
  organizationId: {
    type: String,
    default: 'POLICE_DEPT'
  },
  permissionLevel: {
    type: String,
    enum: ['field_officer', 'supervisor'],
    default: 'field_officer'
  },
  verifiedStatus: {
    type: String,
    enum: ['verified', 'pending', 'unverified'],
    default: 'pending' // Public registration starts pending; requires supervisor verification
  },
  onDuty: {
    type: Boolean,
    default: true
  },
  availability: {
    type: String,
    enum: ['available', 'reserved', 'busy', 'off_duty'],
    default: 'available',
    index: true
  },
  currentLocation: {
    lat: { type: Number, default: 17.0010 },
    lng: { type: Number, default: 81.8050 },
    address: { type: String, default: 'Station HQ' }
  },
  locationUpdatedAt: {
    type: Date,
    default: Date.now
  },
  activeAssignmentId: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

officerSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('Officer', officerSchema);
