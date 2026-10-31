const mongoose = require('mongoose');

const telemetrySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  heartRate: {
    type: Number,
    default: null
  },
  spO2: {
    type: Number,
    default: null
  },
  accelX: {
    type: Number,
    default: null
  },
  accelY: {
    type: Number,
    default: null
  },
  accelZ: {
    type: Number,
    default: null
  },
  totalG: { type: Number, default: 1.0 },
  steps: { type: Number, default: 0 },
  coords: {
    lat: { type: Number, default: 17.0005 },
    lng: { type: Number, default: 81.8040 }
  },
  satellites: { type: Number, default: 14 },
  hdop: { type: Number, default: 0.8 },
  speedKmh: { type: Number, default: 0.0 },
  gpsHasFix: { type: Boolean, default: true },
  fixQuality: { type: String, default: '3D_FIX' },
  activityStatus: { type: String, default: 'RESTING' },
  activityIntensity: { type: String, default: 'Low' },
  statusColor: { type: String, default: '🟢 Normal' },
  anomalyRisk: { type: String, default: 'NORMAL' },
  anomalyMessage: { type: String, default: 'Normal baseline telemetry' },
  erss112Channel: { type: String, default: 'ERSS-112 IoT External Signal Gateway (AP PSAP Ready)' },
  sensorHealth: {
    max30102: { type: String, default: 'ok' },
    mpu6050: { type: String, default: 'ok' }
  },
  quality: {
    type: String,
    default: 'good'
  }
});

module.exports = mongoose.model('Telemetry', telemetrySchema);
