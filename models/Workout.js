const mongoose = require('mongoose');

const workoutSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  type: {
    type: String,
    default: 'Walking'
  },
  avgHeartRate: {
    type: Number
  },
  maxHeartRate: {
    type: Number
  },
  caloriesBurned: {
    type: Number,
    default: 0
  },
  gpsRoute: [
    {
      lat: Number,
      lng: Number,
      timestamp: Date
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Workout', workoutSchema);
