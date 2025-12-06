const functions = require('firebase-functions');
const admin = require('firebase-admin');
const vision = require('@google-cloud/vision');
const vertex = require('@google-cloud/aiplatform');
const {VertexAI} = vertex;
const {helpers} = vertex;
const {PredictionServiceClient} = vertex.v1;
const {GoogleMapsClient} = require('@google/maps');
const cors = require('cors')({origin: true});
const axios = require('axios');

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

const PROJECT_ID = process.env.PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
const VERTEX_LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
const VERTEX_FORECAST_ENDPOINT_ID = process.env.VERTEX_FORECAST_ENDPOINT_ID;
const vertexForecastEndpointPath = PROJECT_ID && VERTEX_FORECAST_ENDPOINT_ID
  ? `projects/${PROJECT_ID}/locations/${VERTEX_LOCATION}/endpoints/${VERTEX_FORECAST_ENDPOINT_ID}`
  : null;
const CROWD_HISTORY_LIMIT = parseInt(process.env.CROWD_HISTORY_LIMIT || '240', 10);
const DEFAULT_BOTTLENECK_THRESHOLD = Number(process.env.CROWD_BOTTLENECK_THRESHOLD || 0.7);

const predictionServiceClient = new PredictionServiceClient({
  apiEndpoint: `${VERTEX_LOCATION}-aiplatform.googleapis.com`
});

// Initialize Vertex AI
const vertexAI = new VertexAI({project: process.env.PROJECT_ID, location: 'us-central1'});

// Initialize Google Maps client
const mapsClient = new GoogleMapsClient({
  key: process.env.GOOGLE_MAPS_API_KEY,
  Promise: Promise
});

/**
 * Analyzes video stream for smoke, fire, or panic detection
 */
exports.analyzeVideoStream = functions.https.onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const {videoUrl, venueId, zoneId} = data;
  
  try {
    // Call Vertex AI Vision API for video analysis
    // This is a placeholder for the actual implementation
    console.log(`Analyzing video stream from ${videoUrl} for venue ${venueId}, zone ${zoneId}`);
    
    // Mock detection results for demonstration
    const detections = [
      {
        type: 'smoke',
        confidence: 0.87,
        timestamp: admin.firestore.Timestamp.now(),
        boundingBox: {x1: 0.2, y1: 0.3, x2: 0.4, y2: 0.5}
      }
    ];
    
    // If detection confidence is high enough, create an alert
    if (detections.length > 0 && detections[0].confidence > 0.7) {
      const alertData = {
        id: `alert-${Date.now()}`,
        type: detections[0].type,
        severity: 'high',
        status: 'active',
        location: {
          venue: venueId,
          zone: zoneId
        },
        detectionSource: 'AI',
        aiConfidence: detections[0].confidence,
        description: `Detected ${detections[0].type} with high confidence`,
        mediaUrls: [videoUrl],
        createdAt: admin.firestore.Timestamp.now()
      };
      
      await db.collection('alerts').doc(alertData.id).set(alertData);
    }
    
    return {success: true, detections};
  } catch (error) {
    console.error('Error analyzing video stream:', error);
    throw new functions.https.HttpsError('internal', 'Error analyzing video stream', error);
  }
});

/**
 * Predicts crowd bottlenecks using Vertex AI Forecasting
 */
exports.predictCrowdBottlenecks = functions.https.onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const {venueId, currentCrowdData = {}, horizonMinutes} = data;
  if (!venueId) {
    throw new functions.https.HttpsError('invalid-argument', 'venueId is required');
  }

  const forecastHorizon = Math.min(Math.max(horizonMinutes || 20, 5), 60);
  
  try {
    // Get venue information
    const venueDoc = await db.collection('venues').doc(venueId).get();
    if (!venueDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Venue not found');
    }
    
    const venue = venueDoc.data();
    if (!Array.isArray(venue.zones) || venue.zones.length === 0) {
      throw new functions.https.HttpsError('failed-precondition', 'Venue must define zones for forecasting');
    }

    await persistCrowdSnapshot(venueId, currentCrowdData);

    const zoneHistory = await getZoneCrowdHistory(venueId, venue.zones.map(z => z.id));
    const vertexForecast = await runVertexCrowdForecast({
      venueId,
      currentCrowdData,
      zoneHistory,
      horizonMinutes: forecastHorizon
    });
    
    const predictions = buildCrowdPredictionOutput({
      venue,
      currentCrowdData,
      zoneHistory,
      vertexForecast,
      horizonMinutes: forecastHorizon
    });
    
    // Filter to high-risk zones
    const highRiskZones = predictions.filter(p => p.bottleneckRisk > DEFAULT_BOTTLENECK_THRESHOLD);
    
    // Create alerts for high-risk zones
    for (const zone of highRiskZones) {
      const alertData = {
        id: `crowd-alert-${Date.now()}-${zone.zoneId}`,
        type: 'crowd_bottleneck',
        severity: zone.bottleneckRisk > 0.9 ? 'critical' : 'high',
        status: 'active',
        location: {
          venue: venueId,
          zone: zone.zoneId
        },
        detectionSource: 'AI_forecast',
        aiConfidence: zone.bottleneckRisk,
        description: `Predicted crowd bottleneck in ${zone.zoneName} in ${zone.timeToBottleneck} minutes`,
        createdAt: admin.firestore.Timestamp.now()
      };
      
      await db.collection('alerts').doc(alertData.id).set(alertData);
    }
    
    // Store analytics data
    const confidenceScore = predictions.length
      ? Math.max(...predictions.map(p => p.bottleneckRisk))
      : 0;

    await db.collection('analytics').add({
      id: `crowd-analytics-${Date.now()}`,
      type: 'crowd_density_forecast',
      timestamp: admin.firestore.Timestamp.now(),
      data: predictions,
      location: {
        venue: venueId
      },
      predictions: highRiskZones.map(z => ({
        zone: z.zoneId,
        risk: z.bottleneckRisk,
        timeToEvent: z.timeToBottleneck
      })),
      forecastConfig: {
        horizonMinutes: forecastHorizon,
        vertexUsed: Boolean(vertexForecast && vertexForecast.length),
        vertexEndpoint: vertexForecastEndpointPath
      },
      confidenceScore,
      snapshot: currentCrowdData,
      vertexRaw: vertexForecast
    });
    
    return {
      success: true,
      predictions,
      highRiskZones,
      vertexUsed: Boolean(vertexForecast && vertexForecast.length)
    };
  } catch (error) {
    console.error('Error predicting crowd bottlenecks:', error);
    throw new functions.https.HttpsError('internal', 'Error predicting crowd bottlenecks', error);
  }
});

/**
 * Finds missing persons using photo matching with Vertex AI Matching Engine
 */
exports.findMissingPerson = functions.https.onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const {photoUrl, venueId, description} = data;
  
  try {
    // Call Vertex AI Matching Engine
    // This is a placeholder for the actual implementation
    console.log(`Searching for missing person with photo ${photoUrl} at venue ${venueId}`);
    
    // Mock search results for demonstration
    const matches = [
      {
        confidence: 0.92,
        timestamp: admin.firestore.Timestamp.now().toMillis() - 300000, // 5 minutes ago
        cameraId: 'camera-east-entrance-1',
        location: {
          venue: venueId,
          zone: 'east-entrance',
          lat: 37.7749,
          lng: -122.4194
        },
        imageUrl: 'https://storage.googleapis.com/drishti-matches/match1.jpg'
      },
      {
        confidence: 0.85,
        timestamp: admin.firestore.Timestamp.now().toMillis() - 180000, // 3 minutes ago
        cameraId: 'camera-food-court-2',
        location: {
          venue: venueId,
          zone: 'food-court',
          lat: 37.7750,
          lng: -122.4195
        },
        imageUrl: 'https://storage.googleapis.com/drishti-matches/match2.jpg'
      }
    ];
    
    // Create incident for missing person
    const incidentData = {
      id: `missing-person-${Date.now()}`,
      type: 'missing_person',
      status: 'detected',
      priority: 2,
      location: matches.length > 0 ? matches[0].location : {venue: venueId},
      detectionSource: 'AI_matching',
      detectionConfidence: matches.length > 0 ? matches[0].confidence : 0,
      mediaUrls: [photoUrl, ...(matches.map(m => m.imageUrl))],
      description: description || 'Missing person reported',
      aiSummary: matches.length > 0 
        ? `Person last seen at ${matches[0].location.zone} ${Math.floor((admin.firestore.Timestamp.now().toMillis() - matches[0].timestamp) / 60000)} minutes ago` 
        : 'No recent sightings found',
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: context.auth.uid,
      assignedResponders: [],
      timeline: [{
        status: 'detected',
        timestamp: admin.firestore.Timestamp.now(),
        note: 'Missing person search initiated'
      }],
      resolved: false
    };
    
    await db.collection('incidents').doc(incidentData.id).set(incidentData);
    
    return {success: true, matches, incidentId: incidentData.id};
  } catch (error) {
    console.error('Error finding missing person:', error);
    throw new functions.https.HttpsError('internal', 'Error finding missing person', error);
  }
});

/**
 * Dispatches nearest response unit
 */
exports.dispatchNearestResponder = functions.https.onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  // Check if user has dispatcher or admin role
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!userDoc.exists || (userDoc.data().role !== 'dispatcher' && userDoc.data().role !== 'admin')) {
    throw new functions.https.HttpsError('permission-denied', 'User must be a dispatcher or admin');
  }

  const {incidentId, responderType} = data;
  
  try {
    // Get incident details
    const incidentDoc = await db.collection('incidents').doc(incidentId).get();
    if (!incidentDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Incident not found');
    }
    
    const incident = incidentDoc.data();
    
    // Find available responders of the specified type
    const respondersSnapshot = await db.collection('responders')
      .where('type', '==', responderType)
      .where('status', '==', 'available')
      .get();
    
    if (respondersSnapshot.empty) {
      throw new functions.https.HttpsError('not-found', `No available ${responderType} responders`);
    }
    
    const responders = [];
    respondersSnapshot.forEach(doc => {
      responders.push(doc.data());
    });
    
    // Calculate distances using Google Maps Distance Matrix API
    const destinations = responders.map(r => ({lat: r.location.lat, lng: r.location.lng}));
    const origin = {lat: incident.location.lat, lng: incident.location.lng};
    
    // This would be a real API call in production
    // const response = await mapsClient.distanceMatrix({
    //   origins: [origin],
    //   destinations: destinations,
    //   mode: 'driving'
    // }).asPromise();
    
    // Mock distance calculation for demonstration
    const distances = responders.map((r, i) => ({
      responderId: r.id,
      distance: Math.sqrt(
        Math.pow(r.location.lat - incident.location.lat, 2) + 
        Math.pow(r.location.lng - incident.location.lng, 2)
      ) * 111000, // Rough conversion to meters
      duration: Math.floor(Math.random() * 300) + 60 // 1-6 minutes
    }));
    
    // Find nearest responder
    distances.sort((a, b) => a.distance - b.distance);
    const nearestResponder = responders.find(r => r.id === distances[0].responderId);
    
    // Update responder status
    await db.collection('responders').doc(nearestResponder.id).update({
      status: 'assigned',
      currentIncidentId: incidentId
    });
    
    // Update incident
    await db.collection('incidents').doc(incidentId).update({
      status: 'assigned',
      assignedResponders: admin.firestore.FieldValue.arrayUnion(nearestResponder.id),
      timeline: admin.firestore.FieldValue.arrayUnion({
        status: 'assigned',
        timestamp: admin.firestore.Timestamp.now(),
        note: `Assigned to ${responderType} responder ${nearestResponder.name}`
      })
    });
    
    // Send notification to responder (would use FCM in production)
    console.log(`Notifying responder ${nearestResponder.id} about incident ${incidentId}`);
    
    return {
      success: true, 
      responderId: nearestResponder.id,
      responderName: nearestResponder.name,
      estimatedArrivalTime: distances[0].duration
    };
  } catch (error) {
    console.error('Error dispatching responder:', error);
    throw new functions.https.HttpsError('internal', 'Error dispatching responder', error);
  }
});

/**
 * Generates AI summary of security concerns
 */
exports.generateSecuritySummary = functions.https.onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const {venueId, timeframe} = data;
  const hours = timeframe || 1; // Default to last hour
  
  try {
    // Get recent incidents and alerts
    const startTime = admin.firestore.Timestamp.fromMillis(
      admin.firestore.Timestamp.now().toMillis() - (hours * 60 * 60 * 1000)
    );
    
    const [incidentsSnapshot, alertsSnapshot, analyticsSnapshot] = await Promise.all([
      db.collection('incidents')
        .where('location.venue', '==', venueId)
        .where('createdAt', '>=', startTime)
        .get(),
      db.collection('alerts')
        .where('location.venue', '==', venueId)
        .where('createdAt', '>=', startTime)
        .get(),
      db.collection('analytics')
        .where('location.venue', '==', venueId)
        .where('timestamp', '>=', startTime)
        .get()
    ]);
    
    const incidents = [];
    incidentsSnapshot.forEach(doc => {
      incidents.push(doc.data());
    });
    
    const alerts = [];
    alertsSnapshot.forEach(doc => {
      alerts.push(doc.data());
    });
    
    const analytics = [];
    analyticsSnapshot.forEach(doc => {
      analytics.push(doc.data());
    });
    
    // Call Gemini API for summarization
    // This is a placeholder for the actual implementation
    console.log(`Generating security summary for venue ${venueId} over the last ${hours} hours`);
    
    // Mock summary for demonstration
    const summary = {
      overallStatus: incidents.length > 5 ? 'critical' : incidents.length > 2 ? 'elevated' : 'normal',
      incidentCount: incidents.length,
      alertCount: alerts.length,
      highPriorityCount: incidents.filter(i => i.priority <= 2).length,
      resolvedCount: incidents.filter(i => i.resolved).length,
      activeBottlenecks: alerts.filter(a => a.type === 'crowd_bottleneck' && a.status === 'active').length,
      summary: `In the past ${hours} hours, there have been ${incidents.length} incidents reported at the venue, ` +
        `with ${incidents.filter(i => i.priority <= 2).length} high-priority situations. ` +
        `${incidents.filter(i => i.resolved).length} incidents have been resolved. ` +
        `There are currently ${alerts.filter(a => a.status === 'active').length} active alerts, ` +
        `including ${alerts.filter(a => a.type === 'crowd_bottleneck' && a.status === 'active').length} potential crowd bottlenecks. ` +
        `The overall security status is ${incidents.length > 5 ? 'CRITICAL' : incidents.length > 2 ? 'ELEVATED' : 'NORMAL'}.`,
      recommendations: [
        'Increase security presence in the east entrance zone due to high crowd density',
        'Monitor the food court area for potential bottlenecks in the next 15 minutes',
        'Prepare medical team for quick response near the main stage'
      ],
      timestamp: admin.firestore.Timestamp.now()
    };
    
    // Store the summary
    await db.collection('securitySummaries').add({
      venueId,
      timeframe: hours,
      ...summary
    });
    
    return {success: true, summary};
  } catch (error) {
    console.error('Error generating security summary:', error);
    throw new functions.https.HttpsError('internal', 'Error generating security summary', error);
  }
});

// HTTP API for external integrations
exports.api = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      // Simple API key validation (would use more robust auth in production)
      const apiKey = req.get('X-API-Key');
      if (!apiKey || apiKey !== process.env.EXTERNAL_API_KEY) {
        res.status(401).send({error: 'Unauthorized'});
        return;
      }
      
      if (req.path === '/incidents' && req.method === 'GET') {
        // Get recent incidents
        const snapshot = await db.collection('incidents')
          .orderBy('createdAt', 'desc')
          .limit(20)
          .get();
        
        const incidents = [];
        snapshot.forEach(doc => {
          incidents.push(doc.data());
        });
        
        res.status(200).send({incidents});
        return;
      }
      
      if (req.path === '/alerts' && req.method === 'POST') {
        // Create a new alert from external system
        const {type, severity, location, description} = req.body;
        
        if (!type || !severity || !location || !description) {
          res.status(400).send({error: 'Missing required fields'});
          return;
        }
        
        const alertData = {
          id: `ext-alert-${Date.now()}`,
          type,
          severity,
          status: 'active',
          location,
          detectionSource: 'external_api',
          description,
          createdAt: admin.firestore.Timestamp.now()
        };
        
        await db.collection('alerts').doc(alertData.id).set(alertData);
        
        res.status(201).send({success: true, alertId: alertData.id});
        return;
      }
      
      res.status(404).send({error: 'Not found'});
    }

    if (typeof vertexData.timeToBottleneckMinutes === 'number') {
      timeToBottleneckMinutes = vertexData.timeToBottleneckMinutes;
    } else if (typeof vertexData.horizonMinutes === 'number') {
      timeToBottleneckMinutes = vertexData.horizonMinutes;
    }
  } else {
    const trend = getZoneTrend(history);
    predictedDensity = clampDensity(currentDensity + trend * 0.15);
    if (predictedDensity > DEFAULT_BOTTLENECK_THRESHOLD) {
      timeToBottleneckMinutes = Math.max(5, Math.min(horizonMinutes, 20));
    }
  }

  const bottleneckRisk = deriveBottleneckRisk(predictedDensity);

  return {
    zoneId,
    zoneName: zone.name || zone.label || zoneId,
    currentDensity,
    predictedDensity,
    bottleneckRisk,
    timeToBottleneck: Math.round(timeToBottleneckMinutes),
    predictionSource
  };
}

function getZoneTrend(history = []) {
  if (!history.length) {
    return 0;
  }
  if (history.length === 1) {
    return history[0].density;
  }
  const earliest = history[0].density;
  const latest = history[history.length - 1].density;
  return clampDensity(latest - earliest);
}

function deriveBottleneckRisk(predictedDensity) {
  const density = clampDensity(predictedDensity);
  if (density <= DEFAULT_BOTTLENECK_THRESHOLD) {
    return Math.max(0, density / DEFAULT_BOTTLENECK_THRESHOLD * 0.7);
  }
  const overshoot = density - DEFAULT_BOTTLENECK_THRESHOLD;
  return Math.min(1, 0.7 + (overshoot / Math.max(0.001, 1 - DEFAULT_BOTTLENECK_THRESHOLD)) * 0.3);
}

function clampDensity(value) {
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) {
    return 0;
  }
  return Math.max(0, Math.min(1.5, num));
}