// Project Drishti - Main Application JavaScript

// Firebase configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "project-drishti.firebaseapp.com",
  projectId: "project-drishti",
  storageBucket: "project-drishti.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
  console.log('Project Drishti Dashboard Initialized');
  
  // Simulate real-time data updates
  initializeDashboard();
});

// Initialize Dashboard with mock data
function initializeDashboard() {
  // Update status cards with mock data
  updateStatusCards();
  
  // Simulate real-time alerts
  simulateRealTimeAlerts();
  
  // Initialize map (would use Google Maps in production)
  // Only initialize map if the element exists
  if (document.getElementById('map-container')) {
    initializeMap();
  }
  
  // Simulate video analytics
  simulateVideoAnalytics();

  // Simulate people counts for key cameras
  simulateCameraPeopleCounts();
}

// Update status cards with mock data
function updateStatusCards() {
  // In a real application, this would fetch data from Firestore
  console.log('Updating status cards with real-time data');
  
  // Simulate attendance counter increasing
  let attendance = 2547;
  setInterval(() => {
    attendance += Math.floor(Math.random() * 5);
    const attendanceElement = document.querySelector('.status-card:nth-child(2) .status-info h3');
    if (attendanceElement) {
      attendanceElement.textContent = attendance.toLocaleString();
    }
  }, 5000);
}

// Simulate real-time alerts
function simulateRealTimeAlerts() {
  console.log('Setting up real-time alert simulation');
  
  // In a real application, this would use Firestore onSnapshot
  const alertTypes = [
    {
      type: 'crowd',
      icon: 'bi-people',
      title: 'Crowd Bottleneck Predicted',
      location: 'West Entrance - Zone 3',
      severity: 'critical'
    },
    {
      type: 'medical',
      icon: 'bi-thermometer-high',
      title: 'Medical Emergency',
      location: 'VIP Area - Zone 1',
      severity: 'high'
    },
    {
      type: 'security',
      icon: 'bi-shield-exclamation',
      title: 'Security Breach Detected',
      location: 'Perimeter Fence - South',
      severity: 'high'
    },
    {
      type: 'fire',
      icon: 'bi-fire',
      title: 'Smoke Detected',
      location: 'Food Court - Kitchen Area',
      severity: 'critical'
    }
  ];
  
  // Add a new alert every 30 seconds
  setInterval(() => {
    if (Math.random() > 0.7) { // 30% chance of new alert
      const alertList = document.querySelector('.alert-list');
      const randomAlert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
      
      const alertElement = document.createElement('div');
      alertElement.className = `alert-item ${randomAlert.severity}`;
      alertElement.innerHTML = `
        <div class="alert-icon"><i class="bi ${randomAlert.icon}"></i></div>
        <div class="alert-content">
          <h4>${randomAlert.title}</h4>
          <p>${randomAlert.location}</p>
          <div class="alert-meta">
            <span class="alert-time">Just now</span>
            <span class="alert-confidence">${Math.floor(80 + Math.random() * 19)}% confidence</span>
          </div>
        </div>
        <div class="alert-actions">
          <button class="btn btn-sm btn-outline-light">View</button>
          <button class="btn btn-sm btn-primary">Respond</button>
        </div>
      `;
      
      // Add to the top of the list
      alertList.prepend(alertElement);
      
      // Remove the last alert if there are more than 5
      if (alertList.children.length > 5) {
        alertList.removeChild(alertList.lastChild);
      }
      
      // Update the alert count in the status card
      const activeIncidents = document.querySelector('.status-card:nth-child(4) .status-info h3');
      activeIncidents.textContent = parseInt(activeIncidents.textContent) + 1;
      
      // Flash the notification icon
      const notificationBadge = document.querySelector('.notification-icon .badge');
      notificationBadge.textContent = parseInt(notificationBadge.textContent) + 1;
      notificationBadge.style.animation = 'pulse 1s';
      setTimeout(() => {
        notificationBadge.style.animation = '';
      }, 1000);
    }
  }, 30000);
  
  // Update the "time ago" on alerts every minute
  setInterval(() => {
    document.querySelectorAll('.alert-time').forEach(timeElement => {
      const text = timeElement.textContent;
      if (text === 'Just now') {
        timeElement.textContent = '1 min ago';
      } else if (text.includes('min ago')) {
        const minutes = parseInt(text.split(' ')[0]);
        timeElement.textContent = `${minutes + 1} min ago`;
      }
    });
  }, 60000);
}

// Initialize map
function initializeMap() {
  console.log('Initializing venue map');
  
  // In a real application, this would initialize Google Maps
  // For now, we'll just add some interactivity to our placeholder
  
  const mapContainer = document.querySelector('.map-container');
  
  // Check if map container exists
  if (!mapContainer) {
    console.log('Map container not found on this page');
    return;
  }
  
  const markers = document.querySelectorAll('.map-marker');
  
  // Add hover effect to markers
  markers.forEach(marker => {
    marker.addEventListener('mouseover', function() {
      const title = this.getAttribute('title');
      const tooltip = document.createElement('div');
      tooltip.className = 'map-tooltip';
      tooltip.textContent = title;
      tooltip.style.position = 'absolute';
      tooltip.style.top = `${this.offsetTop - 30}px`;
      tooltip.style.left = `${this.offsetLeft}px`;
      tooltip.style.backgroundColor = 'rgba(0,0,0,0.7)';
      tooltip.style.color = 'white';
      tooltip.style.padding = '5px 10px';
      tooltip.style.borderRadius = '3px';
      tooltip.style.fontSize = '12px';
      tooltip.style.zIndex = '100';
      mapContainer.appendChild(tooltip);
      
      this.addEventListener('mouseout', function() {
        mapContainer.removeChild(tooltip);
      });
    });
  });
  
  // Add click handlers to map control buttons
  document.querySelector('.map-controls .bi-plus').parentElement.addEventListener('click', function() {
    console.log('Zoom in');
    // Would implement actual zoom in production
  });
  
  document.querySelector('.map-controls .bi-dash').parentElement.addEventListener('click', function() {
    console.log('Zoom out');
    // Would implement actual zoom in production
  });
  
  document.querySelector('.map-controls .bi-arrows-fullscreen').parentElement.addEventListener('click', function() {
    console.log('Fullscreen');
    // Would implement fullscreen in production
  });
}

function simulateCameraPeopleCounts() {
  const mainEntranceSelector = '[data-camera-count="cam-001"] .count-value';
  const mainEntranceContainer = document.querySelector(mainEntranceSelector);

  if (mainEntranceContainer) {
    let currentCount = 7;
    mainEntranceContainer.textContent = currentCount;

    setInterval(() => {
      const refreshedContainer = document.querySelector(mainEntranceSelector);
      if (!refreshedContainer) {
        return;
      }

      currentCount = currentCount === 7 ? 12 : 7;
      refreshedContainer.textContent = currentCount;
    }, 5000);
  }

  const randomConfigs = [
    { selector: 'cam-008', min: 4, max: 6, interval: 10000 },
    { selector: 'cam-023', min: 150, max: 160, interval: 2000 }
  ];

  randomConfigs.forEach(({ selector, min, max, interval }) => {
    const container = document.querySelector(`[data-camera-count="${selector}"] .count-value`);

    if (!container) {
      return;
    }

    const update = () => {
      const value = Math.floor(Math.random() * (max - min + 1)) + min;
      container.textContent = value;
    };

    update();
    setInterval(update, interval);
  });

  const mainStageContainer = document.querySelector('[data-camera-count="cam-015"] .count-value');
  if (mainStageContainer) {
    mainStageContainer.textContent = 3;
  }
}

// Simulate video analytics
function simulateVideoAnalytics() {
  console.log('Setting up video analytics simulation');
  
  // In a real application, this would connect to Vertex AI Vision
  // For now, we'll just simulate detection boxes moving around
  
  const videoFeeds = document.querySelectorAll('.video-feed');
  
  // Check if video feeds exist on this page
  if (videoFeeds.length === 0) {
    console.log('No video feeds found on this page');
    return;
  }
  
  videoFeeds.forEach(feed => {
    const overlay = feed.querySelector('.video-overlay');
    
    // Only add simulation to feeds that don't already have detection boxes
    if (!overlay || overlay.querySelector('.detection-box')) {
      return;
    }
    
    // Add a random detection box
    const detectionBox = document.createElement('div');
    detectionBox.className = 'detection-box';
    
    // Random position
    let top = 20 + Math.random() * 60; // 20-80%
    let left = 20 + Math.random() * 60; // 20-80%
    let width = 10 + Math.random() * 20; // 10-30%
    let height = 10 + Math.random() * 30; // 10-40%
    
    // Random detection type
    const detectionTypes = ['Person', 'Crowd', 'Object', 'Vehicle'];
    const detectionType = detectionTypes[Math.floor(Math.random() * detectionTypes.length)];
    
    detectionBox.style.top = `${top}%`;
    detectionBox.style.left = `${left}%`;
    detectionBox.style.width = `${width}%`;
    detectionBox.style.height = `${height}%`;
    
    const label = document.createElement('span');
    label.textContent = `${detectionType}: ${Math.floor(80 + Math.random() * 19)}%`;
    detectionBox.appendChild(label);
    
    overlay.appendChild(detectionBox);
    
    // Animate the detection box
    let directionX = Math.random() > 0.5 ? 1 : -1;
    let directionY = Math.random() > 0.5 ? 1 : -1;
    let speed = 0.2 + Math.random() * 0.3; // 0.2-0.5% per frame
    
    function animateDetection() {
      // Update position
      top += speed * directionY;
      left += speed * directionX;
      
      // Bounce off edges
      if (top <= 10 || top >= 90 - height) {
        directionY *= -1;
      }
      
      if (left <= 10 || left >= 90 - width) {
        directionX *= -1;
      }
      
      // Apply new position
      detectionBox.style.top = `${top}%`;
      detectionBox.style.left = `${left}%`;
      
      // Continue animation
      requestAnimationFrame(animateDetection);
    }
    
    // Start animation
    animateDetection();
  });
}

// Event Listeners for UI elements
document.addEventListener('DOMContentLoaded', function() {
  // Sidebar navigation handling
  const sidebarLinks = document.querySelectorAll('.sidebar-menu li a, .sidebar ul li a');
  const linksArray = Array.from(sidebarLinks);

  if (linksArray.length) {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    linksArray.forEach(link => {
      const href = link.getAttribute('href');
      const parentLi = link.closest('li');

      if (!parentLi) {
        return;
      }

      if (href && !href.startsWith('#') && !href.startsWith('http')) {
        if (href === currentPage) {
          parentLi.classList.add('active');
        } else {
          parentLi.classList.remove('active');
        }
      }
    });

    linksArray.forEach(link => {
      link.addEventListener('click', function(e) {
        const href = this.getAttribute('href');

        if (!href || href.startsWith('http')) {
          return;
        }

        if (href.startsWith('#')) {
          e.preventDefault();

          linksArray.forEach(otherLink => {
            const li = otherLink.closest('li');
            if (li) {
              li.classList.remove('active');
            }
          });

          const li = this.closest('li');
          if (li) {
            li.classList.add('active');
          }

          const targetSection = document.querySelector(href);
          if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    });
  }

  // User profile display across pages
  const storedUsername = localStorage.getItem('drishti_username');
  const profileNameEl = document.querySelector('.user-profile span, .user-info span');
  const avatarEl = document.querySelector('.avatar');

  if (storedUsername && profileNameEl) {
    profileNameEl.textContent = storedUsername;
  }

  if (storedUsername && avatarEl) {
    avatarEl.textContent = storedUsername.substring(0, 2).toUpperCase();
  }

  // Alert response buttons
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('btn-primary') && e.target.textContent === 'Respond') {
      const alertItem = e.target.closest('.alert-item');
      const alertTitle = alertItem.querySelector('h4').textContent;
      console.log(`Responding to alert: ${alertTitle}`);
      
      // In a real app, this would open a response dialog
      alert(`Responding to: ${alertTitle}`);
    }
  });
  
  // Video controls
  initializeDashboardInteractions();
});

function initializeDashboardInteractions() {
  setupModal();
  bindNavActions();
  bindStatusCards();
  bindMapControls();
  bindAlertActions();
  bindVideoControls();
  setupCameraPageInteractions();
}

function setupModal() {
  if (document.getElementById('drishtiModal')) {
    return;
  }

  const modalTemplate = `
    <div class="modal fade" id="drishtiModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"></h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-primary" data-action="modal-primary">Proceed</button>
          </div>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', modalTemplate);
}

function showModal({ title, body, primaryAction }) {
  setupModal();

  const modalEl = document.getElementById('drishtiModal');
  if (!modalEl) {
    return;
  }

  if (typeof bootstrap === 'undefined' || !bootstrap.Modal) {
    alert(`${title ? `${title}: ` : ''}${body}`.trim());
    return;
  }

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modalEl.querySelector('.modal-title').textContent = title || 'Project Drishti';
  modalEl.querySelector('.modal-body').textContent = body || '';

  const primaryButton = modalEl.querySelector('[data-action="modal-primary"]');
  primaryButton.onclick = null;

  if (primaryAction) {
    primaryButton.classList.remove('d-none');
    primaryButton.textContent = primaryAction.label || 'Proceed';
    primaryButton.onclick = () => {
      primaryAction.handler?.();
      modal.hide();
    };
  } else {
    primaryButton.classList.add('d-none');
  }

  modal.show();
}

function bindNavActions() {
  document.querySelector('[data-action="new-alert"]')?.addEventListener('click', () => {
    showModal({
      title: 'New Alert',
      body: 'Simulating alert creation. Connect to backend workflow to create a real alert.',
      primaryAction: {
        label: 'Confirm',
        handler: () => console.log('New alert confirmed')
      }
    });
  });
}

function bindStatusCards() {
  document.querySelectorAll('.status-card.actionable').forEach(card => {
    const action = card.dataset.action;
    const title = card.dataset.modalTitle;
    const body = card.dataset.modalBody;

    const navigate = () => {
      if (action === 'navigate' && card.dataset.link) {
        window.location.href = card.dataset.link;
      } else {
        showModal({ title, body });
      }
    };

    card.addEventListener('click', navigate);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        navigate();
      }
    });
  });
}

function bindMapControls() {
  const mapContainer = document.querySelector('.map-container');
  if (!mapContainer) {
    return;
  }

  const mapElement = mapContainer.querySelector('#map');
  const mapState = { zoom: 100 };

  const applyZoom = () => {
    if (mapElement) {
      mapElement.style.transformOrigin = 'center center';
      mapElement.style.transform = `scale(${mapState.zoom / 100})`;
    }
    showToast(`Map zoom: ${mapState.zoom}%`);
  };

  const zoomInBtn = document.querySelector('[data-action="map-zoom-in"]');
  const zoomOutBtn = document.querySelector('[data-action="map-zoom-out"]');
  const fullscreenBtn = document.querySelector('[data-action="map-fullscreen"]');

  zoomInBtn?.addEventListener('click', () => {
    mapState.zoom = Math.min(160, mapState.zoom + 10);
    applyZoom();
  });

  zoomOutBtn?.addEventListener('click', () => {
    mapState.zoom = Math.max(70, mapState.zoom - 10);
    applyZoom();
  });

  fullscreenBtn?.addEventListener('click', () => {
    showModal({
      title: 'Fullscreen Map',
      body: 'Simulated fullscreen map. Integrate with mapping SDK to enable fullscreen display.'
    });
  });
}

function bindAlertActions() {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-action^="alert-"]');
    const action = trigger?.dataset.action;
    if (!action || !action.startsWith('alert-')) {
      return;
    }

    const alertItem = trigger.closest('.alert-item');
    const alertTitle = alertItem?.querySelector('h4')?.textContent || 'Alert';

    if (action === 'alert-view') {
      showModal({
        title: alertTitle,
        body: 'Review details and context for this alert. Connect to backend for live data.'
      });
    }

    if (action === 'alert-respond') {
      showModal({
        title: 'Dispatch Response',
        body: `Simulated response workflow initiated for "${alertTitle}".`
      });
    }

    if (action === 'alert-update') {
      showModal({
        title: 'Update Alert',
        body: `Simulated update workflow for "${alertTitle}". Integrate with incident ticketing to save changes.`
      });
    }
  });
}

function bindVideoControls() {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('button[data-action^="video-"]');
    if (!trigger) {
      return;
    }

    const { action, camera } = trigger.dataset;
    if (!action || !camera) {
      return;
    }

    if (action === 'video-fullscreen') {
      showModal({
        title: `Fullscreen: ${camera}`,
        body: 'Fullscreen feed simulation. Integrate with streaming service to open real feed.'
      });
    }

    if (action === 'video-stream') {
      showModal({
        title: `Stream: ${camera}`,
        body: 'Stream workflow simulated. Configure WebRTC / HLS player for live streaming.'
      });
    }

    if (action === 'video-options') {
      showModal({
        title: `Options: ${camera}`,
        body: 'Camera options simulated. Hook into PTZ controls or recording management.'
      });
    }
  });
}

function setupCameraPageInteractions() {
  const liveFeedSection = document.querySelector('.live-feed-section');
  if (!liveFeedSection) {
    return;
  }

  const filterChips = Array.from(liveFeedSection.querySelectorAll('.filter-chip'));
  const feedGrid = liveFeedSection.querySelector('.feed-grid');
  const feedCards = Array.from(liveFeedSection.querySelectorAll('.feed-card'));
  const cameraItems = Array.from(liveFeedSection.querySelectorAll('.camera-item'));
  const refreshButton = liveFeedSection.querySelector('[data-action="refresh-feed"]');
  const lastUpdatedLabel = liveFeedSection.querySelector('#live-feed-last-updated');

  if (!feedGrid || feedCards.length === 0) {
    return;
  }

  const state = {
    type: 'all',
    layout: 'grid',
    camera: null
  };

  const ensureFocusable = (elements) => {
    elements.forEach((element) => {
      if (!element.hasAttribute('tabindex')) {
        element.setAttribute('tabindex', '0');
      }
    });
  };

  ensureFocusable([...filterChips, ...cameraItems, ...feedCards]);

  const setChipGroupValue = (group, value) => {
    filterChips
      .filter((chip) => chip.dataset.filterGroup === group)
      .forEach((chip) => {
        chip.classList.toggle('active', chip.dataset.filter === value);
      });

    if (group === 'type') {
      state.type = value;
    }

    if (group === 'layout') {
      state.layout = value;
    }
  };

  const getFilteredCards = () => {
    if (state.type === 'all') {
      return [...feedCards];
    }

    return feedCards.filter((card) => card.dataset.feedType === state.type);
  };

  const applyFilters = () => {
    const filteredCards = getFilteredCards();

    if (state.layout === 'single') {
      if (state.camera) {
        const hasSelected = filteredCards.some((card) => card.dataset.camera === state.camera);
        if (!hasSelected) {
          state.camera = filteredCards[0]?.dataset.camera || null;
        }
      } else {
        state.camera = filteredCards[0]?.dataset.camera || null;
      }
    } else if (state.camera) {
      const hasSelected = filteredCards.some((card) => card.dataset.camera === state.camera);
      if (!hasSelected) {
        state.camera = null;
      }
    }

    feedGrid.classList.toggle('single-layout', state.layout === 'single');

    feedCards.forEach((card) => {
      const isFiltered = filteredCards.includes(card);
      const isSelected = state.camera === card.dataset.camera;

      let shouldShow = isFiltered;

      if (state.layout === 'single') {
        shouldShow = isFiltered && isSelected;
      }

      card.classList.toggle('d-none', !shouldShow);
      card.classList.toggle('active', isSelected && (state.layout === 'grid' ? isFiltered : shouldShow));
    });

    cameraItems.forEach((item) => {
      const isSelected = state.camera === item.dataset.camera;
      item.classList.toggle('active', isSelected);
    });
  };

  const setActiveChip = (chip) => {
    const group = chip.dataset.filterGroup;
    const value = chip.dataset.filter || (group === 'type' ? 'all' : 'grid');

    setChipGroupValue(group, value);
    applyFilters();
  };

  const handleCameraSelection = (cameraId) => {
    if (!cameraId) {
      return;
    }

    const targetCard = feedCards.find((card) => card.dataset.camera === cameraId);
    if (!targetCard) {
      return;
    }

    const { feedType } = targetCard.dataset;

    if (feedType && state.type !== 'all' && state.type !== feedType) {
      setChipGroupValue('type', feedType);
    }

    state.camera = cameraId === state.camera && state.layout !== 'single' ? null : cameraId;

    if (state.layout === 'single' && !state.camera) {
      state.camera = cameraId;
    }

    applyFilters();
  };

  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => setActiveChip(chip));
    chip.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setActiveChip(chip);
      }
    });
  });

  cameraItems.forEach((item) => {
    const cameraId = item.dataset.camera;
    item.addEventListener('click', () => handleCameraSelection(cameraId));
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleCameraSelection(cameraId);
      }
    });
  });

  feedCards.forEach((card) => {
    const cameraId = card.dataset.camera;
    card.addEventListener('click', () => handleCameraSelection(cameraId));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleCameraSelection(cameraId);
      }
    });
  });

  refreshButton?.addEventListener('click', () => {
    liveFeedSection.classList.add('refreshing');

    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    if (lastUpdatedLabel) {
      lastUpdatedLabel.textContent = `Last updated: ${timestamp}`;
    }

    setTimeout(() => {
      liveFeedSection.classList.remove('refreshing');
    }, 1200);
  });

  applyFilters();
}

function showToast(message) {
  let toastContainer = document.getElementById('drishti-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'drishti-toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.bottom = '20px';
    toastContainer.style.right = '20px';
    toastContainer.style.zIndex = '2000';
    toastContainer.style.display = 'flex';
    toastContainer.style.flexDirection = 'column';
    toastContainer.style.gap = '10px';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'alert alert-dark shadow';
  toast.style.transition = 'opacity 0.3s ease';
  toast.style.opacity = '1';
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.addEventListener('transitionend', () => toast.remove());
  }, 2000);
}