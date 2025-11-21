/**
 * Project Drishti - Firestore Database Schema
 * 
 * This file defines the schema for the Firestore collections used in Project Drishti.
 */

// Users collection schema
const userSchema = {
  uid: String,          // Firebase Auth UID
  email: String,        // User email
  displayName: String,  // User display name
  role: String,         // Role: admin, dispatcher, responder, analyst
  phoneNumber: String,  // Contact phone number
  organization: String, // Organization name
  createdAt: Timestamp, // Account creation timestamp
  lastLogin: Timestamp, // Last login timestamp
  deviceTokens: Array,  // FCM tokens for push notifications
  settings: {           // User preferences
    notifications: Boolean,
    theme: String,
    language: String
  }
};

// Incidents collection schema
const incidentSchema = {
  id: String,                // Unique incident ID
  type: String,              // Incident type: fire, medical, security, etc.
  status: String,            // Status: detected, assigned, in_progress, resolved
  priority: Number,          // Priority level: 1 (highest) to 5 (lowest)
  location: {                // Incident location
    lat: Number,
    lng: Number,
    address: String,
    venue: String,
    zone: String
  },
  detectionSource: String,   // How incident was detected: AI, manual, sensor
  detectionConfidence: Number, // AI detection confidence score (0-1)
  mediaUrls: Array,          // URLs to related images/videos
  description: String,       // Incident description
  aiSummary: String,         // AI-generated summary
  createdAt: Timestamp,      // Creation timestamp
  updatedAt: Timestamp,      // Last update timestamp
  createdBy: String,         // User ID who created the incident
  assignedResponders: Array, // List of responder IDs assigned
  timeline: Array,           // Array of status updates with timestamps
  resolved: Boolean,         // Whether incident is resolved
  resolvedAt: Timestamp,     // When incident was resolved
  resolutionNotes: String    // Notes on resolution
};

// Responders collection schema
const responderSchema = {
  id: String,              // Unique responder ID
  userId: String,          // Associated user ID
  name: String,            // Responder name
  type: String,            // Type: security, medical, fire, police
  status: String,          // Status: available, assigned, unavailable
  location: {              // Current location
    lat: Number,
    lng: Number,
    lastUpdated: Timestamp
  },
  currentIncidentId: String, // ID of incident currently assigned to
  skills: Array,           // Special skills/certifications
  contactNumber: String,   // Contact number
  deviceToken: String      // FCM token for push notifications
};

// Alerts collection schema
const alertSchema = {
  id: String,              // Unique alert ID
  type: String,            // Alert type: crowd, fire, security, etc.
  severity: String,        // Severity: low, medium, high, critical
  status: String,          // Status: active, acknowledged, resolved
  location: {              // Alert location
    lat: Number,
    lng: Number,
    address: String,
    venue: String,
    zone: String
  },
  detectionSource: String, // How alert was detected: AI, manual, sensor
  aiConfidence: Number,    // AI confidence score (0-1)
  description: String,     // Alert description
  mediaUrls: Array,        // URLs to related images/videos
  createdAt: Timestamp,    // Creation timestamp
  acknowledgedAt: Timestamp, // When alert was acknowledged
  acknowledgedBy: String,  // User ID who acknowledged
  resolvedAt: Timestamp,   // When alert was resolved
  resolvedBy: String,      // User ID who resolved
  relatedIncidentId: String // ID of incident created from this alert
};

// Analytics collection schema
const analyticsSchema = {
  id: String,              // Unique analytics record ID
  type: String,            // Analytics type: crowd_density, incident_heatmap, etc.
  timestamp: Timestamp,    // When analytics were generated
  data: Object,            // Analytics data (structure varies by type)
  location: {              // Location data
    venue: String,
    zone: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  predictions: Array,      // AI predictions
  confidenceScore: Number, // Overall confidence score
  metadata: Object         // Additional metadata
};

// Venues collection schema
const venueSchema = {
  id: String,              // Unique venue ID
  name: String,            // Venue name
  address: String,         // Physical address
  type: String,            // Venue type: stadium, concert hall, etc.
  capacity: Number,        // Maximum capacity
  coordinates: {           // Geographic coordinates
    lat: Number,
    lng: Number
  },
  boundaries: Array,       // GeoJSON polygon of venue boundaries
  zones: Array,            // List of zone objects with boundaries
  entrances: Array,        // List of entrance points
  exits: Array,            // List of exit points
  cameras: Array,          // List of camera objects with locations
  sensors: Array,          // List of sensor objects with locations
  createdAt: Timestamp,    // Creation timestamp
  updatedAt: Timestamp     // Last update timestamp
};

// Export all schemas
module.exports = {
  userSchema,
  incidentSchema,
  responderSchema,
  alertSchema,
  analyticsSchema,
  venueSchema
};