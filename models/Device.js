const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  deviceSecret: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  deviceName: {
    type: String,
    default: 'Guardian Band ESP32'
  },
  status: {
    type: String,
    enum: ['paired', 'unpaired', 'revoked'],
    default: 'paired'
  },
  firmwareVersion: {
    type: String,
    default: '1.0.0'
  },
  sensorHealth: {
    max30102: { type: String, default: 'ok' },
    mpu6050: { type: String, default: 'ok' },
    battery: { type: String, default: 'ok' }
  },
  batteryLevel: {
    type: Number,
    default: 95
  },
  lastSync: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Device', deviceSchema);
