const mongoose = require('mongoose');

const userAccountSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
  },
  role: {
    type: String,
    enum: ['super_admin', 'school_admin', 'school_management', 'parent'],
    required: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  schoolName: {
    type: String,
    trim: true,
    default: null,
  },
  studentId: {
    type: String,
    trim: true,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: String,
    trim: true,
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.models.UserAccount || mongoose.model('UserAccount', userAccountSchema);
