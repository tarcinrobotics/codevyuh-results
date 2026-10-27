/**
 * auth/models/UserAccount.js
 * Dual-mode user account store:
 * Seamlessly uses Mongoose when MongoDB is connected,
 * or an in-memory store with full Mongoose-compatible API when MongoDB is offline.
 */
const mongoose = require('mongoose');
const crypto = require('crypto');

// 1. Mongoose Schema definition
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
    enum: ['super_admin', 'school_admin', 'school_management', 'parent', 'event_admin'],
    required: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  eventId: {
    type: String,
    trim: true,
    default: null,
  },
  eventName: {
    type: String,
    trim: true,
    default: null,
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

const MongooseModel = mongoose.models.UserAccount || mongoose.model('UserAccount', userAccountSchema);

// 2. In-Memory Resilient Store
const memoryAccounts = new Map();

class MemoryUserDoc {
  constructor(data) {
    this._id = data._id || data.id || crypto.randomUUID();
    this.username = String(data.username || '').toLowerCase().trim();
    this.displayName = data.displayName || '';
    this.role = data.role || 'event_admin';
    this.passwordHash = data.passwordHash || '';
    this.eventId = data.eventId || null;
    this.eventName = data.eventName || null;
    this.schoolName = data.schoolName || null;
    this.studentId = data.studentId || null;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdBy = data.createdBy || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  async save() {
    this.updatedAt = new Date();
    memoryAccounts.set(this.username, this);
    return this;
  }
}

function matchesFilter(doc, filter = {}) {
  if (!filter || Object.keys(filter).length === 0) return true;

  if (filter.username) {
    if (doc.username !== String(filter.username).toLowerCase().trim()) return false;
  }
  if (filter.eventId && doc.eventId !== filter.eventId) return false;
  if (filter.role && doc.role !== filter.role) return false;

  if (Array.isArray(filter.$or)) {
    return filter.$or.some(clause => {
      for (const [k, v] of Object.entries(clause)) {
        if (doc[k] === v) return true;
      }
      return false;
    });
  }

  return true;
}

const DualUserAccount = {
  isMongooseActive() {
    return mongoose.connection && mongoose.connection.readyState === 1;
  },

  async findOne(query) {
    if (this.isMongooseActive()) {
      return await MongooseModel.findOne(query);
    }
    const username = query?.username ? String(query.username).toLowerCase().trim() : null;
    if (username) {
      return memoryAccounts.get(username) || null;
    }
    for (const doc of memoryAccounts.values()) {
      if (matchesFilter(doc, query)) return doc;
    }
    return null;
  },

  async findById(id) {
    if (this.isMongooseActive()) {
      return await MongooseModel.findById(id);
    }
    for (const doc of memoryAccounts.values()) {
      if (doc._id === id) return doc;
    }
    return null;
  },

  find(filter = {}) {
    if (this.isMongooseActive()) {
      return MongooseModel.find(filter);
    }
    // Return query-like chainable object for memory store
    const matches = Array.from(memoryAccounts.values()).filter(doc => matchesFilter(doc, filter));
    return {
      sort(sortOptions) {
        return this;
      },
      select(fields) {
        return this;
      },
      async lean() {
        return matches.map(m => ({ ...m }));
      },
      then(resolve, reject) {
        resolve(matches);
      }
    };
  },

  async create(data) {
    if (this.isMongooseActive()) {
      return await MongooseModel.create(data);
    }
    const doc = new MemoryUserDoc(data);
    memoryAccounts.set(doc.username, doc);
    return doc;
  },

  async countDocuments(filter = {}) {
    if (this.isMongooseActive()) {
      return await MongooseModel.countDocuments(filter);
    }
    return Array.from(memoryAccounts.values()).filter(doc => matchesFilter(doc, filter)).length;
  }
};

module.exports = DualUserAccount;
