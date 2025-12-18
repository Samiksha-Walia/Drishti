// Project Drishti - Main Application JavaScript

// Firebase configuration is loaded from firebase-config.js
const firebaseConfig = window.FIREBASE_CONFIG;
let firebaseApp = null;
let db = null;
let auth = null;
let functions = null;
const API_BASE = (() => {
  if (typeof window !== 'undefined') {
    const explicit = window.DRISHTI_API_BASE || window.API_BASE;
    if (explicit) {
      return explicit.replace(/\/$/, '');
    }
    const { hostname, port } = window.location;
    if (hostname === 'localhost' && port === '3000') {
      return 'http://localhost:5000/api';
    }
  }
  return '/api';
})();
let dashboardStream = null;
window.drishtiIncidentModal = null;

function runInitializer(label, initializer) {
  try {
    initializer?.();
  } catch (error) {
    console.error(`[Init] Failed to initialize ${label}`, error);
  }
}

const ROLE_STORAGE_KEY = 'drishti-active-role';
const ROLE_DEFAULT = 'viewer';
const ROLE_OPTIONS = ['viewer', 'responder', 'dispatcher', 'analyst', 'admin'];
let currentRole = ROLE_DEFAULT;

try {
  const storedRole = localStorage.getItem(ROLE_STORAGE_KEY);
  if (storedRole) {
    currentRole = normalizeRole(storedRole);
  }
} catch (error) {
  console.warn('Unable to read stored role preference', error);
}

function openIncidentCreateModal() {
  if (!requireRole(['dispatcher', 'responder', 'admin'], 'Creating incidents')) {
    return;
  }

  const formId = `incident-create-form-${Date.now()}`;
  const nowIso = new Date().toISOString().slice(0, 16);
  const formHtml = `
    <form id="${formId}" class="incident-create-form">
      <p class="text-muted small">ID will be auto-generated when the incident is saved.</p>
      <div class="mb-3">
        <label class="form-label">Title</label>
        <input type="text" name="title" class="form-control" placeholder="e.g., Smoke near Gate 4" required>
      </div>
      <div class="mb-3">
        <label class="form-label">Description</label>
        <textarea name="description" class="form-control" rows="3" placeholder="What happened?" required></textarea>
      </div>
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label">Type</label>
          <select name="type" class="form-select" required>
            <option value="crowd_bottleneck">Crowd Bottleneck</option>
            <option value="fire">Fire / Smoke</option>
            <option value="medical">Medical</option>
            <option value="security">Security</option>
            <option value="lost_child">Missing Person</option>
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label">Severity</label>
          <select name="severity" class="form-select" required>
            <option value="high">High</option>
            <option value="medium" selected>Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>
      <div class="row g-3 mt-1">
        <div class="col-md-6">
          <label class="form-label">Location / Zone</label>
          <input type="text" name="zone" class="form-control" placeholder="e.g., Gate 3" required>
        </div>
        <div class="col-md-6">
          <label class="form-label">Incident Time</label>
          <input type="datetime-local" name="incidentTime" class="form-control" value="${nowIso}" required>
        </div>
      </div>
      <div class="row g-3 mt-1">
        <div class="col-md-6">
          <label class="form-label">Initial Status</label>
          <select name="status" class="form-select" required>
            <option value="active" selected>Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label">Reporter</label>
          <input type="text" name="reportedBy" class="form-control" placeholder="e.g., Camera CAM-014" value="Command Center">
        </div>
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="button" class="btn btn-outline-secondary" data-action="cancel-create">Cancel</button>
        <button type="submit" class="btn btn-primary">
          <i class="bi bi-plus"></i> Submit Incident
        </button>
      </div>
    </form>`;

  showModal({
    title: 'Log New Incident',
    bodyIsHtml: true,
    body: formHtml,
    primaryAction: null
  });

  requestAnimationFrame(() => {
    const form = document.getElementById(formId);
    if (!form) {
      return;
    }

    form.querySelector('[data-action="cancel-create"]')?.addEventListener('click', () => {
      const modalEl = document.getElementById('drishtiModal');
      const modalInstance = modalEl && bootstrap?.Modal?.getInstance(modalEl);
      modalInstance?.hide();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      const inputTime = form.incidentTime.value;
      const createdAt = inputTime ? new Date(inputTime).toISOString() : new Date().toISOString();
      const payload = {
        title: form.title.value.trim(),
        description: form.description.value.trim(),
        type: form.type.value,
        severity: form.severity.value,
        location: { zone: form.zone.value.trim() },
        status: form.status.value,
        createdAt,
        reportedBy: form.reportedBy.value.trim() || 'Command Center'
      };
      if (!payload.title || !payload.description || !payload.location.zone) {
        showToast('Please fill all required fields.');
        return;
      }
      try {
        setButtonLoading(submitBtn, true, 'Submitting...');
        await fetchApi('/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        showToast('Incident created successfully');
        if (window.drishtiIncidents?.load) {
          await window.drishtiIncidents.load();
        }
        const modalEl = document.getElementById('drishtiModal');
        const modalInstance = modalEl && bootstrap?.Modal?.getInstance(modalEl);
        modalInstance?.hide();
      } catch (error) {
        console.error('Failed to create incident', error);
        showToast('Unable to create incident at this time.');
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });
  });
}

function normalizeRole(role) {
  if (!role) {
    return ROLE_DEFAULT;
  }
  const normalized = String(role).toLowerCase();
  return ROLE_OPTIONS.includes(normalized) ? normalized : ROLE_DEFAULT;
}

function describeRole(role) {
  const normalized = normalizeRole(role);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatRoleList(roles = []) {
  if (!roles.length) {
    return describeRole('admin');
  }
  return roles.map((role) => describeRole(role)).join(' / ');
}

function getCurrentRole() {
  return currentRole;
}

function syncRoleUi() {
  if (document.body) {
    document.body.dataset.activeRole = currentRole;
  }
  document.querySelectorAll('[data-role-indicator]').forEach((el) => {
    el.textContent = describeRole(currentRole);
  });
  const selector = document.getElementById('role-selector');
  if (selector && selector.value !== currentRole) {
    selector.value = currentRole;
  }
}

function setCurrentRole(role, { silent = false } = {}) {
  currentRole = normalizeRole(role);
  try {
    localStorage.setItem(ROLE_STORAGE_KEY, currentRole);
  } catch (error) {
    console.warn('Unable to persist selected role', error);
  }
  syncRoleUi();
  if (!silent) {
    showToast(`Role switched to ${describeRole(currentRole)} mode`);
  }
}

function hasRole(...roles) {
  if (!roles?.length) {
    return true;
  }
  const normalized = roles.map((role) => normalizeRole(role));
  return currentRole === 'admin' || normalized.includes(currentRole);
}

function requireRole(requiredRoles = [], actionLabel = 'This action') {
  if (hasRole(...requiredRoles)) {
    return true;
  }
  const readableRoles = formatRoleList(requiredRoles);
  showToast(`${actionLabel} requires ${readableRoles} role.`);
  return false;
}

function initRoleSelector() {
  syncRoleUi();
  const selector = document.getElementById('role-selector');
  if (!selector) {
    return;
  }
  selector.value = currentRole;
  selector.addEventListener('change', (event) => {
    setCurrentRole(event.target.value);
  });
}

function setButtonLoading(button, isLoading, loadingText = 'Working...') {
  if (!button) {
    return;
  }
  if (isLoading) {
    button.dataset.originalHtml = button.dataset.originalHtml || button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${loadingText}`;
  } else {
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
    button.disabled = false;
  }
}

function setIncidentModalState(incident) {
  window.drishtiIncidentModal = {
    id: incident.id,
    update: updateIncidentModal
  };
  updateIncidentModal(incident);
}

function updateIncidentModal(incident) {
  if (!incident || !window.drishtiIncidentModal?.id) {
    return;
  }
  const modalBody = document.querySelector('#drishtiModal .modal-body');
  if (!modalBody) {
    return;
  }
  modalBody.innerHTML = formatIncidentDetails(incident);
}

function formatEvacuationShare(plan) {
  if (!plan) {
    return 'No data';
  }
  return [
    `Hazard: ${plan.hazardType || 'N/A'}`,
    `Origin: ${plan.originZone}`,
    `Recommended Exit: ${plan.recommendedExit}`,
    `ETA: ${plan.estimatedEvacuationTime} minutes`,
    `Steps: ${(plan.steps || []).map((step) => `T+${step.minute}m ${step.action}`).join(' | ')}`
  ].join('\n');
}

if (firebaseConfig && typeof firebase !== 'undefined') {
  firebaseApp = firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
  functions = firebase.functions();
} else {
  console.warn('Firebase config missing. Running dashboard in demo mode.');
}

function setupIncidentsTable() {
  const tableBody = document.getElementById('incidents-table-body');
  const refreshBtn = document.getElementById('incidents-refresh');
  const newIncidentBtn = document.getElementById('incidents-new-btn');
  const searchInput = document.getElementById('incident-search');
  const filterBtn = document.getElementById('incident-filter-btn');
  const mapMarkersEl = document.getElementById('incident-map-markers');
  const statElements = {};
  document.querySelectorAll('[data-incident-stat]').forEach((element) => {
    if (element.dataset.incidentStat) {
      statElements[element.dataset.incidentStat] = element;
    }
  });

  if (!tableBody) {
    return;
  }

  const severityClasses = {
    high: 'bg-danger',
    medium: 'bg-warning text-dark',
    low: 'bg-success'
  };

  const state = {
    incidents: [],
    filters: {
      query: '',
      severity: 'all',
      status: 'all'
    }
  };

  const getSeverityClass = (severity) => severityClasses[severity] || 'bg-secondary';

  const setTableMessage = (message, isError = false) => {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-4 ${isError ? 'text-danger' : 'text-muted'}">
          ${message}
        </td>
      </tr>`;
  };

  const renderIncidentRows = (items = []) => {
    if (!items.length) {
      setTableMessage(state.filters.query ? 'No incidents match your filters.' : 'No active incidents.');
      return;
    }

    tableBody.innerHTML = '';
    items.forEach((incident) => {
      const row = document.createElement('tr');
      const severityClass = getSeverityClass((incident.severity || 'medium').toLowerCase());
      const typeLabel = incident.type?.replace('_', ' ') || 'Alert';
      const percent = Math.min(100, Math.round((incident.aiConfidence || 0) * 100));
      const statusValue = (incident.status || 'unknown').toLowerCase();
      const statusClass = statusValue === 'resolved' ? 'bg-success' : statusValue === 'acknowledged' ? 'bg-primary' : 'bg-warning text-dark';
      row.innerHTML = `
        <td>${incident.id?.slice(0, 8) || 'ID'}</td>
        <td><span class="badge ${severityClass}">${typeLabel}</span></td>
        <td>${incident.location?.zone || 'Unknown'}</td>
        <td>${formatTimestamp(incident.createdAt)}</td>
        <td>
          <div class="progress" style="height: 6px;">
            <div class="progress-bar ${severityClass}" role="progressbar" style="width: ${percent}%"></div>
          </div>
        </td>
        <td><span class="badge ${statusClass}">${incident.status || 'unknown'}</span></td>
        <td class="d-flex gap-1">
          <button class="btn btn-sm btn-outline-primary" data-incident-action="view" data-incident-id="${incident.id}"><i class="bi bi-eye"></i></button>
          <button class="btn btn-sm btn-outline-success" data-incident-action="resolve" data-incident-id="${incident.id}" ${statusValue === 'resolved' ? 'disabled' : ''}><i class="bi bi-check2"></i></button>
        </td>`;
      tableBody.appendChild(row);
    });
  };

  const filterIncidents = () => {
    const query = state.filters.query;
    const targetSeverity = state.filters.severity;
    const targetStatus = state.filters.status;
    return state.incidents.filter((incident) => {
      const severity = (incident.severity || 'medium').toLowerCase();
      const status = (incident.status || 'active').toLowerCase();
      const matchesSeverity = targetSeverity === 'all' || severity === targetSeverity;
      const matchesStatus = targetStatus === 'all' || status === targetStatus;
      const normalizedFields = [incident.title, incident.description, incident.location?.zone, incident.type, incident.id]
        .filter(Boolean)
        .map((value) => value.toString().toLowerCase());
      const matchesQuery = !query || normalizedFields.some((value) => value.includes(query));
      return matchesSeverity && matchesStatus && matchesQuery;
    });
  };

  const updateIncidentStats = () => {
    const counters = { fire: 0, crowd: 0, missing: 0, resolved: 0 };
    state.incidents.forEach((incident) => {
      const typeValue = (incident.type || '').toLowerCase();
      const statusValue = (incident.status || '').toLowerCase();
      if (typeValue.includes('fire')) {
        counters.fire += 1;
      }
      if (typeValue.includes('crowd')) {
        counters.crowd += 1;
      }
      if (typeValue.includes('missing') || typeValue.includes('lost')) {
        counters.missing += 1;
      }
      if (statusValue === 'resolved') {
        counters.resolved += 1;
      }
    });
    Object.entries(statElements).forEach(([key, element]) => {
      if (!element) {
        return;
      }
      const value = counters[key] ?? 0;
      element.textContent = value;
    });
  };

  const updateIncidentMap = (items = []) => {
    if (!mapMarkersEl) {
      return;
    }
    if (!items.length) {
      mapMarkersEl.innerHTML = '<div class="text-white-50 small">No incidents to plot.</div>';
      return;
    }
    const topIncidents = items.slice(0, 6);
    mapMarkersEl.innerHTML = topIncidents.map((incident) => {
      const severityClass = getSeverityClass((incident.severity || 'medium').toLowerCase());
      return `
        <div class="mb-2 p-2 rounded ${severityClass} bg-opacity-75 text-white" style="backdrop-filter: blur(2px);">
          <div class="fw-semibold">${incident.title || incident.type || 'Incident'}</div>
          <div class="small text-white-50">${incident.location?.zone || 'Unknown zone'}</div>
          <div class="small text-white-50">${formatTimestamp(incident.createdAt)}</div>
        </div>`;
    }).join('');
  };

  const applyFiltersAndRender = () => {
    const filtered = filterIncidents();
    renderIncidentRows(filtered);
    updateIncidentStats();
    updateIncidentMap(filtered);
  };

  const syncIncidents = (items = []) => {
    state.incidents = items;
    applyFiltersAndRender();
  };

  const setRefreshLoading = (isLoading) => {
    if (!refreshBtn) {
      return;
    }
    const spinner = refreshBtn.querySelector('.spinner-border');
    const label = refreshBtn.querySelector('.label');
    if (spinner) {
      spinner.classList.toggle('d-none', !isLoading);
    }
    if (label) {
      label.classList.toggle('opacity-50', isLoading);
    }
    refreshBtn.disabled = isLoading;
  };

  const loadIncidents = async () => {
    try {
      setRefreshLoading(true);
      setTableMessage('Fetching incidents...');
      const data = await fetchApi('/alerts');
      syncIncidents(data?.items || []);
    } catch (error) {
      console.error('Failed to load incidents', error);
      setTableMessage('Unable to load incidents. Please try again.', true);
      showToast('Failed to load incidents');
    } finally {
      setRefreshLoading(false);
    }
  };

  tableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-incident-action]');
    if (!button) {
      return;
    }
    const action = button.dataset.incidentAction;
    const incidentId = button.dataset.incidentId;

    if (action === 'view') {
      try {
        setButtonLoading(button, true, 'Loading...');
        const incident = await fetchApi(`/alerts/${incidentId}`);
        showModal({
          title: incident.title || `Incident ${incident.id?.slice(0, 8)}`,
          body: formatIncidentDetails(incident),
          bodyIsHtml: true
        });
        setIncidentModalState(incident);
      } catch (error) {
        console.error('Failed to load incident details', error);
        showToast('Unable to load incident details.');
      } finally {
        setButtonLoading(button, false);
      }
    }

    if (action === 'resolve') {
      if (!requireRole(['dispatcher', 'responder', 'admin'], 'Resolving incidents')) {
        return;
      }
      try {
        setButtonLoading(button, true, 'Resolving...');
        await fetchApi(`/alerts/${incidentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'resolved' })
        });
        showToast('Incident marked as resolved');
        await loadIncidents();
      } catch (error) {
        console.error('Failed to resolve incident', error);
        showToast('Unable to resolve incident right now.');
      } finally {
        setButtonLoading(button, false);
      }
    }
  });

  refreshBtn?.addEventListener('click', loadIncidents);

  const attachCreateHandlers = () => {
    const triggers = [newIncidentBtn, ...document.querySelectorAll('[data-action="incident-create"]')].filter(Boolean);
    triggers.forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        console.debug('[Incidents] New Incident button clicked', { triggerId: trigger.id, role: getCurrentRole() });
        openIncidentCreateModal();
      });
    });
  };
  attachCreateHandlers();

  searchInput?.addEventListener('input', (event) => {
    state.filters.query = event.target.value.trim().toLowerCase();
    applyFiltersAndRender();
  });

  filterBtn?.addEventListener('click', () => {
    const formId = 'incident-filter-form';
    const formHtml = `
      <form id="${formId}" class="pt-2">
        <div class="mb-3">
          <label class="form-label">Severity</label>
          <select name="severity" class="form-select">
            <option value="all" ${state.filters.severity === 'all' ? 'selected' : ''}>All severities</option>
            <option value="high" ${state.filters.severity === 'high' ? 'selected' : ''}>High</option>
            <option value="medium" ${state.filters.severity === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="low" ${state.filters.severity === 'low' ? 'selected' : ''}>Low</option>
          </select>
        </div>
        <div>
          <label class="form-label">Status</label>
          <select name="status" class="form-select">
            <option value="all" ${state.filters.status === 'all' ? 'selected' : ''}>All statuses</option>
            <option value="active" ${state.filters.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="acknowledged" ${state.filters.status === 'acknowledged' ? 'selected' : ''}>Acknowledged</option>
            <option value="resolved" ${state.filters.status === 'resolved' ? 'selected' : ''}>Resolved</option>
          </select>
        </div>
      </form>`;
    showModal({
      title: 'Filter Incidents',
      bodyIsHtml: true,
      body: formHtml,
      primaryAction: {
        label: 'Apply',
        handler: () => {
          const form = document.getElementById(formId);
          if (!form) {
            return;
          }
          state.filters.severity = form.severity.value;
          state.filters.status = form.status.value;
          applyFiltersAndRender();
        }
      }
    });
  });

  loadIncidents();

  window.drishtiIncidents = {
    load: loadIncidents,
    render: syncIncidents,
    sync: syncIncidents,
    state,
    setFilters: (filters = {}) => {
      state.filters = { ...state.filters, ...filters };
      applyFiltersAndRender();
    }
  };
}

function setupAnalyticsOverview() {
  const statElements = {};
  document.querySelectorAll('[data-analytics-stat]').forEach((element) => {
    if (element.dataset.analyticsStat) {
      statElements[element.dataset.analyticsStat] = element;
    }
  });

  const renderOverview = (data) => {
    if (statElements.total_events) statElements.total_events.textContent = data.total_events || 0;
    if (statElements.total_zones) statElements.total_zones.textContent = data.total_zones || 0;
    if (statElements.avg_predicted) statElements.avg_predicted.textContent = data.avg_predicted || 0;
    if (statElements.uptime) statElements.uptime.textContent = `${data.uptime_pct || 0}%`;
    if (statElements.cameras) statElements.cameras.textContent = data.cameras || 0;
  };

  const loadOverview = async () => {
    try {
      const data = await fetchApi('/analytics/overview');
      renderOverview(data);
    } catch (error) {
      console.error('Failed to load analytics overview', error);
    }
  };

  loadOverview();
  setInterval(loadOverview, 60_000);
}

function setupZonePredictions() {
  const container = document.getElementById('zone-predictions');
  const refreshBtn = document.querySelector('[data-action="refresh-zones"]');
  if (!container) return;

  const renderZones = (data) => {
    const html = Object.entries(data).map(([zone, count]) => `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <span class="fw-semibold">${zone}</span>
        <span class="badge bg-primary rounded-pill">${count}</span>
      </div>
    `).join('');
    container.innerHTML = html;
  };

  const loadZones = async () => {
    try {
      const data = await fetchApi('/zones/15min');
      renderZones(data);
    } catch (error) {
      console.error('Failed to load zone predictions', error);
      container.innerHTML = `<div class="text-center text-danger">Unable to load predictions.</div>`;
    }
  };

  refreshBtn?.addEventListener('click', loadZones);
  loadZones();
  setInterval(loadZones, 15 * 60 * 1000);
}

function setupIncidentDistribution() {
  const container = document.querySelector('[data-chart="incident-pie"]');
  if (!container) return;

  const renderPie = (data) => {
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    let startAngle = 0;
    const colors = {
      Fire: '#dc3545',
      Crowd: '#ffc107',
      Missing: '#17a2b8',
      Other: '#28a745'
    };
    const slices = Object.entries(data).map(([label, value]) => {
      const percentage = (value / total) * 100;
      const endAngle = startAngle + percentage * 3.6; // 360 degrees total
      const largeArcFlag = percentage > 50 ? 1 : 0;
      const x1 = 100 + 80 * Math.cos((startAngle - 90) * Math.PI / 180);
      const y1 = 100 + 80 * Math.sin((startAngle - 90) * Math.PI / 180);
      const x2 = 100 + 80 * Math.cos((endAngle - 90) * Math.PI / 180);
      const y2 = 100 + 80 * Math.sin((endAngle - 90) * Math.PI / 180);
      const path = `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
      startAngle = endAngle;
      return { label, value, path, color: colors[label] };
    });
    const svg = `
      <svg width="200" height="200" viewBox="0 0 200 200" style="display: block; margin: auto;">
        ${slices.map(s => `<path d="${s.path}" fill="${s.color}"></path>`).join('')}
        <circle cx="100" cy="100" r="40" fill="#343a40"></circle>
      </svg>
      <div class="d-flex justify-content-around mt-3">
        ${slices.map(s => `<div><span style="color: ${s.color};">●</span> ${s.label} (${s.value}%)</div>`).join('')}
      </div>`;
    container.innerHTML = svg;
  };

  const loadDistribution = async () => {
    try {
      const data = await fetchApi('/incidents/distribution');
      renderPie(data);
    } catch (error) {
      console.error('Failed to load incident distribution', error);
    }
  };

  loadDistribution();
  setInterval(loadDistribution, 120_000);
}

function setupCrowdTrendsChart() {
  const container = document.querySelector('[data-chart="crowd-trends"]');
  const btnGroup = container?.closest('.card')?.querySelector('[data-trend-range]');
  if (!container || !btnGroup) return;

  let currentRange = btnGroup.dataset.trendRange || 'week';

  const setActiveButton = (range) => {
    btnGroup.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('btn-primary', btn.dataset.range === range);
      btn.classList.toggle('btn-outline-secondary', btn.dataset.range !== range);
    });
    btnGroup.dataset.trendRange = range;
  };

  const renderChart = (points, range) => {
    console.debug(`[Trends] Rendering ${range} chart with data:`, points);
    if (!points || points.length === 0) {
      container.innerHTML = `<div style="height: 300px; background: linear-gradient(to right, #1e3c72, #2a5298); border-radius: 8px; position: relative; display: flex; align-items: center; justify-content: center; color: white;">No data available</div>`;
      console.debug('[Trends] No data to render.');
      return;
    }
    const width = 700;
    const height = 300;
    const padding = { top: 20, right: 40, bottom: 40, left: 60 };

    const maxVal = Math.max(...points.map(p => p.value), 1);
    const xScale = (i) => padding.left + (i / (points.length - 1 || 1)) * (width - padding.left - padding.right);
    const yScale = (v) => height - padding.bottom - (v / maxVal) * (height - padding.top - padding.bottom);

    const pathMain = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)},${yScale(p.value)}`).join(' ');
    const pathSecondary = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)},${yScale(Math.floor(p.value * 0.7))}`).join(' ');

    const svg = `
      <svg width="${width}" height="${height}" style="position: absolute; top: 0; left: 0;">
        <defs>
          <clipPath id="chartArea">
            <rect x="${padding.left}" y="${padding.top}" width="${width - padding.left - padding.right}" height="${height - padding.top - padding.bottom}" />
          </clipPath>
        </defs>
        <path d="${pathSecondary}" fill="none" stroke="rgba(46,204,113,0.8)" stroke-width="2" clip-path="url(#chartArea)"></path>
        <path d="${pathMain}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2" clip-path="url(#chartArea)"></path>
        ${points.map((p, i) => `<text x="${xScale(i)}" y="${height - 10}" text-anchor="middle" fill="white" font-size="12">${p.label}</text>`).join('')}
        <text x="${padding.left - 10}" y="${padding.top}" fill="white" font-size="12" text-anchor="end">${maxVal}</text>
        <text x="${padding.left - 10}" y="${height - padding.bottom}" fill="white" font-size="12" text-anchor="end">0</text>
        <text x="${width - padding.right + 10}" y="${padding.top + 20}" fill="white" font-size="12" text-anchor="start">
          <tspan fill="rgba(255,255,255,0.5)">● Forecast</tspan>
          <tspan dx="10" fill="rgba(46,204,113,0.8)">● Historical Baseline</tspan>
        </text>
      </svg>`;
    // Replace placeholder with live chart
    container.innerHTML = `<div style="height: 300px; background: linear-gradient(to right, #1e3c72, #2a5298); border-radius: 8px; position: relative;">${svg}</div>`;
    console.debug('[Trends] Chart rendered and container updated.');
  };

  const loadTrends = async (range = currentRange) => {
    try {
      console.debug('[Trends] Fetching /api/trends-past...');
      container.innerHTML = '';
      const payload = await fetchApi('/trends-past');
      console.debug('[Trends] Received payload:', payload);
      currentRange = range;
      setActiveButton(range);
      // For past trends, payload is a simple hour->count map; convert to points
      const points = Object.entries(payload).map(([hour, count]) => ({ label: `${hour}:00`, value: count }));
      renderChart(points, range);
    } catch (error) {
      console.error('Failed to load crowd trends', error);
    }
  };

  // Wire range buttons
  btnGroup.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-range]');
    if (btn) {
      const range = btn.dataset.range;
      if (range !== currentRange) {
        loadTrends(range);
      }
    }
  });

  loadTrends(currentRange);
  // Refresh every 5 minutes
  setInterval(() => loadTrends(currentRange), 300_000);
}

function setupAnalyticsTable() {
  const tableBody = document.getElementById('analytics-table-body');
  const refreshBtn = document.getElementById('analytics-refresh');
  const newRecordBtn = document.getElementById('analytics-new-btn');
  const statElements = {};
  document.querySelectorAll('[data-analytics-stat]').forEach((element) => {
    if (element.dataset.analyticsStat) {
      statElements[element.dataset.analyticsStat] = element;
    }
  });

  if (!tableBody) {
    return;
  }

  const state = {
    items: [],
    filters: { venue: 'all' }
  };

  const setTableMessage = (message, isError = false) => {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center py-4 ${isError ? 'text-danger' : 'text-muted'}">
          ${message}
        </td>
      </tr>`;
  };

  const renderRows = (items = []) => {
    if (!items.length) {
      setTableMessage('No analytics records found.');
      return;
    }
    tableBody.innerHTML = '';
    items.forEach((record) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${record.id?.slice(0, 8) || 'ID'}</td>
        <td>${record.location?.venue || 'Unknown venue'}</td>
        <td>${formatTimestamp(record.timestamp)}</td>
        <td class="d-flex gap-1">
          <button class="btn btn-sm btn-outline-primary" data-analytics-action="view" data-analytics-id="${record.id}"><i class="bi bi-eye"></i></button>
        </td>`;
      tableBody.appendChild(row);
    });
  };

  const setRefreshLoading = (isLoading) => {
    if (!refreshBtn) return;
    const spinner = refreshBtn.querySelector('.spinner-border');
    const label = refreshBtn.querySelector('.label');
    if (spinner) spinner.classList.toggle('d-none', !isLoading);
    if (label) label.classList.toggle('opacity-50', isLoading);
    refreshBtn.disabled = isLoading;
  };

  const loadItems = async () => {
    try {
      setRefreshLoading(true);
      setTableMessage('Fetching analytics...');
      const data = await fetchApi('/analytics');
      state.items = data?.items || [];
      renderRows(state.items);
      updateAnalyticsStats(state.items);
    } catch (error) {
      console.error('Failed to load analytics', error);
      setTableMessage('Unable to load analytics. Please try again.', true);
      showToast('Failed to load analytics');
    } finally {
      setRefreshLoading(false);
    }
  };

  const updateAnalyticsStats = (items = []) => {
    const counters = { visitors: 0, cameras: 0, incidents: 0, uptime: '98.2%' };
    items.forEach((record) => {
      const venue = record.location?.venue?.toLowerCase() || '';
      if (venue.includes('gate') || venue.includes('entrance')) {
        counters.visitors += Math.floor(Math.random() * 200) + 50;
      }
      if (venue.includes('camera')) {
        counters.cameras += 1;
      }
      if (record.data?.some?.(d => d.metric === 'incident')) {
        counters.incidents += 1;
      }
    });
    Object.entries(statElements).forEach(([key, element]) => {
      if (element) {
        element.textContent = counters[key] ?? 0;
      }
    });
  };

  tableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-analytics-action]');
    if (!button) return;
    const action = button.dataset.analyticsAction;
    const recordId = button.dataset.analyticsId;

    if (action === 'view') {
      try {
        setButtonLoading(button, true, 'Loading...');
        const record = await fetchApi(`/analytics/${recordId}`);
        const detailsHtml = `
          <table class="table table-borderless">
            <tr><td><strong>ID</strong></td><td>${record.id?.slice(0, 8) || 'ID'}</td></tr>
            <tr><td><strong>Venue</strong></td><td>${record.location?.venue || 'Unknown venue'}</td></tr>
            <tr><td><strong>Timestamp</strong></td><td>${formatTimestamp(record.timestamp)}</td></tr>
            <tr><td><strong>Data</strong></td><td>${(record.data || []).map(d => `${d.metric}: ${d.value}`).join(', ') || 'N/A'}</td></tr>
          </table>`;
        showModal({
          title: `Analytics Record ${record.id?.slice(0, 8)}`,
          body: detailsHtml,
          bodyIsHtml: true
        });
      } catch (error) {
        console.error('Failed to load analytics details', error);
        showToast('Unable to load analytics details.');
      } finally {
        setButtonLoading(button, false);
      }
    }
  });

  refreshBtn?.addEventListener('click', loadItems);

  const attachCreateHandlers = () => {
    const triggers = [newRecordBtn, ...document.querySelectorAll('[data-action="analytics-create"]')].filter(Boolean);
    triggers.forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        openAnalyticsCreateModal();
      });
    });
    const predictTriggers = document.querySelectorAll('[data-action="crowd-predict"]');
    predictTriggers.forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        openCrowdPredictModal();
      });
    });
  };
  attachCreateHandlers();

  loadItems();

  window.drishtiAnalytics = {
    load: loadItems,
    render: renderRows,
    state
  };
}

function openCrowdPredictModal() {
  if (!requireRole(['analyst', 'dispatcher', 'admin'], 'Crowd prediction')) {
    return;
  }

  const formId = `crowd-predict-form-${Date.now()}`;
  const formHtml = `
    <form id="${formId}" class="crowd-predict-form">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label">Zone</label>
          <input type="text" name="zone" class="form-control" placeholder="e.g., Gate 1" required>
        </div>
        <div class="col-md-6">
          <label class="form-label">Zone Capacity</label>
          <input type="number" name="zone_capacity" class="form-control" placeholder="1000" required>
        </div>
      </div>
      <div class="row g-3 mt-1">
        <div class="col-md-6">
          <label class="form-label">Tickets Sold</label>
          <input type="number" name="tickets_sold" class="form-control" placeholder="500" required>
        </div>
        <div class="col-md-6">
          <label class="form-label">Live Count</label>
          <input type="number" name="live_count" class="form-control" placeholder="0" required>
        </div>
      </div>
      <div class="row g-3 mt-1">
        <div class="col-md-6">
          <label class="form-label">Avg Entry Rate (people/min)</label>
          <input type="number" step="any" name="avg_entry_rate" class="form-control" placeholder="1.0" required>
        </div>
        <div class="col-md-6">
          <label class="form-label">Artist Popularity (1-10)</label>
          <input type="number" name="artist_popularity" class="form-control" placeholder="5" min="1" max="10" required>
        </div>
      </div>
      <div class="row g-3 mt-1">
        <div class="col-md-6">
          <label class="form-label">Minutes to Show</label>
          <input type="number" name="time_to_show_mins" class="form-control" placeholder="60" required>
        </div>
        <div class="col-md-6">
          <label class="form-label">Weather</label>
          <select name="weather" class="form-select" required>
            <option value="clear">Clear</option>
            <option value="rainy">Rainy</option>
            <option value="cloudy">Cloudy</option>
            <option value="windy">Windy</option>
          </select>
        </div>
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="button" class="btn btn-outline-secondary" data-action="cancel-predict">Cancel</button>
        <button type="submit" class="btn btn-primary">
          <i class="bi bi-graph-up"></i> Predict Crowd
        </button>
      </div>
    </form>`;

  showModal({
    title: 'Crowd Prediction',
    bodyIsHtml: true,
    body: formHtml,
    primaryAction: null
  });

  requestAnimationFrame(() => {
    const form = document.getElementById(formId);
    if (!form) return;

    form.querySelector('[data-action="cancel-predict"]')?.addEventListener('click', () => {
      const modalEl = document.getElementById('drishtiModal');
      const modalInstance = modalEl && bootstrap?.Modal?.getInstance(modalEl);
      modalInstance?.hide();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      const payload = {
        zone: form.zone.value.trim(),
        zone_capacity: parseInt(form.zone_capacity.value),
        tickets_sold: parseInt(form.tickets_sold.value),
        live_count: parseInt(form.live_count.value),
        avg_entry_rate: parseFloat(form.avg_entry_rate.value),
        artist_popularity: parseInt(form.artist_popularity.value),
        time_to_show_mins: parseInt(form.time_to_show_mins.value),
        weather: form.weather.value
      };
      try {
        setButtonLoading(submitBtn, true, 'Predicting...');
        const result = await fetchApi('/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const predicted = result.predicted_crowd;
        showModal({
          title: 'Prediction Result',
          body: `<p class="mb-0">Predicted crowd for <strong>${payload.zone}</strong>: <span class="badge bg-primary fs-6">${predicted}</span> people</p>`,
          bodyIsHtml: true
        });
      } catch (error) {
        console.error('Prediction failed', error);
        showToast('Unable to get prediction at this time.');
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });
  });
}

function openAnalyticsCreateModal() {
  if (!requireRole(['analyst', 'dispatcher', 'admin'], 'Creating analytics records')) {
    return;
  }

  const formId = `analytics-create-form-${Date.now()}`;
  const nowIso = new Date().toISOString().slice(0, 16);
  const formHtml = `
    <form id="${formId}" class="analytics-create-form">
      <div class="mb-3">
        <label class="form-label">Venue</label>
        <input type="text" name="venue" class="form-control" placeholder="e.g., Main Stadium" required>
      </div>
      <div class="mb-3">
        <label class="form-label">Metric</label>
        <input type="text" name="metric" class="form-control" placeholder="e.g., crowd_density" required>
      </div>
      <div class="mb-3">
        <label class="form-label">Value</label>
        <input type="number" step="any" name="value" class="form-control" placeholder="e.g., 123" required>
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="button" class="btn btn-outline-secondary" data-action="cancel-create">Cancel</button>
        <button type="submit" class="btn btn-primary">
          <i class="bi bi-plus"></i> Submit Record
        </button>
      </div>
    </form>`;

  showModal({
    title: 'Log Analytics Record',
    bodyIsHtml: true,
    body: formHtml,
    primaryAction: null
  });

  requestAnimationFrame(() => {
    const form = document.getElementById(formId);
    if (!form) return;

    form.querySelector('[data-action="cancel-create"]')?.addEventListener('click', () => {
      const modalEl = document.getElementById('drishtiModal');
      const modalInstance = modalEl && bootstrap?.Modal?.getInstance(modalEl);
      modalInstance?.hide();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      const payload = {
        location: { venue: form.venue.value.trim() },
        data: [{ metric: form.metric.value.trim(), value: parseFloat(form.value.value) }],
        snapshot: {}
      };
      try {
        setButtonLoading(submitBtn, true, 'Submitting...');
        await fetchApi('/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        showToast('Analytics record created successfully');
        if (window.drishtiAnalytics?.load) {
          await window.drishtiAnalytics.load();
        }
        const modalEl = document.getElementById('drishtiModal');
        const modalInstance = modalEl && bootstrap?.Modal?.getInstance(modalEl);
        modalInstance?.hide();
      } catch (error) {
        console.error('Failed to create analytics record', error);
        showToast('Unable to create analytics record at this time.');
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });
  });
}

async function refreshIncidentsFromApi() {
  if (!window.drishtiIncidents) {
    return;
  }
  try {
    const data = await fetchApi('/alerts');
    window.drishtiIncidents.render(data?.items || []);
  } catch (error) {
    console.error('Scheduled incident refresh failed', error);
  }
}

function startDashboardStream() {
  if (typeof EventSource === 'undefined' || dashboardStream || db) {
    return;
  }

  try {
    const streamUrl = API_BASE.replace(/\/api$/, '') + '/api/dashboard-stream';
    dashboardStream = new EventSource(streamUrl);
  } catch (error) {
    console.warn('EventSource initialization failed:', error);
    return;
  }

  dashboardStream.onmessage = (event) => {
    if (!event.data) {
      return;
    }
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === 'connected') {
        return;
      }
      if (payload.type?.startsWith('alert_')) {
        refreshAlertsFromApi();
        refreshIncidentsFromApi();
        if (window.drishtiIncidentModal?.id === payload.payload?.id) {
          updateIncidentModal(payload.payload);
        }
      }
      if (payload.type?.startsWith('lost_found')) {
        window.drishtiLostFound?.load();
      }
      if (payload.type?.startsWith('analytics')) {
        refreshAnalyticsFromApi();
      }
      if (payload.type === 'evacuation_plan_created' || payload.type === 'evacuation_plan_shared') {
        window.drishtiEvacHistory?.load();
      }
    } catch (error) {
      console.error('Failed to parse dashboard stream event', error);
    }
  };

  dashboardStream.onerror = () => {
    console.warn('Dashboard stream disconnected. Retrying shortly...');
    dashboardStream?.close();
    dashboardStream = null;
    setTimeout(() => {
      if (!db) {
        startDashboardStream();
      }
    }, 5000);
  };

  window.addEventListener('beforeunload', () => {
    dashboardStream?.close();
  });
}

function setupSettings() {
  const profileForm = document.querySelector('#profile form');
  const aiForm = document.querySelector('#ai-settings form');
  const saveAllBtn = document.querySelector('.page-header .btn-primary');

  // Load settings on page load
  fetchApi('settings')
    .then(data => {
      if (data.profile) {
        document.getElementById('fullName').value = data.profile.fullName || '';
        document.getElementById('email').value = data.profile.email || '';
        document.getElementById('phone').value = data.profile.phone || '';
        document.getElementById('timezone').value = data.profile.timezone || 'UTC+5.5';
        document.getElementById('bio').value = data.profile.bio || '';
      }
      if (data.ai) {
        document.getElementById('fireThreshold').value = data.ai.fireThreshold || 75;
        document.getElementById('crowdThreshold').value = data.ai.crowdThreshold || 65;
        document.getElementById('personThreshold').value = data.ai.personThreshold || 80;
        const modelRadio = document.querySelector(`input[name="aiModel"][value="${data.ai.model || 'standard'}"]`);
        if (modelRadio) modelRadio.checked = true;
      }
    })
    .catch(err => console.error('Failed to load settings:', err));

  // Save profile form
  if (profileForm) {
    profileForm.addEventListener('submit', e => {
      e.preventDefault();
      saveAllSettings();
    });
  }

  // Save AI settings button
  const aiSaveBtn = document.querySelector('#ai-settings button[type="button"]');
  if (aiSaveBtn) {
    aiSaveBtn.addEventListener('click', saveAllSettings);
  }

  // Save All button
  if (saveAllBtn) {
    saveAllBtn.addEventListener('click', saveAllSettings);
  }

  function saveAllSettings() {
    const settings = {
      profile: {
        fullName: document.getElementById('fullName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        timezone: document.getElementById('timezone').value,
        bio: document.getElementById('bio').value
      },
      ai: {
        fireThreshold: parseInt(document.getElementById('fireThreshold').value),
        crowdThreshold: parseInt(document.getElementById('crowdThreshold').value),
        personThreshold: parseInt(document.getElementById('personThreshold').value),
        model: document.querySelector('input[name="aiModel"]:checked')?.value || 'standard'
      }
    };
    fetchApi('settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
      .then(response => {
        if (response.status === 'ok') {
          alert('Settings saved successfully!');
        } else {
          alert('Failed to save settings.');
        }
      })
      .catch(err => {
        console.error('Failed to save settings:', err);
        alert('Failed to save settings.');
      });
  }
}

function setupVideoPeopleCount() {
  const videoCards = document.querySelectorAll('.feed-card[data-feed-type="cctv"]');
  const intervals = new Map();

  const updatePeopleCount = (videoEl, countEl) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = videoEl.videoWidth || 640;
    canvas.height = videoEl.videoHeight || 480;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    fetchApi('/analyze-frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl })
    })
      .then(response => {
        if (countEl) {
          countEl.textContent = response.people_count || 0;
        }
      })
      .catch(err => console.error('Failed to analyze video frame:', err));
  };

  const observeVideo = (card) => {
    const videoEl = card.querySelector('video');
    const countEl = card.querySelector('.feed-stats span:first-child');
    if (!videoEl || !countEl) return;

    const intervalId = setInterval(() => {
      if (videoEl.readyState >= 2) {
        updatePeopleCount(videoEl, countEl);
      }
    }, 2000);
    intervals.set(card, intervalId);
  };

  const stopVideo = (card) => {
    const intervalId = intervals.get(card);
    if (intervalId) {
      clearInterval(intervalId);
      intervals.delete(card);
    }
  };

  // Start for visible cards
  videoCards.forEach(card => {
    if (card.dataset.feedStatus === 'live') {
      observeVideo(card);
    }
  });

  // Optional: stop when card goes offline (if UI changes)
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-feed-status') {
        const card = mutation.target;
        if (card.dataset.feedStatus === 'live') {
          observeVideo(card);
        } else {
          stopVideo(card);
        }
      }
    });
  });
  videoCards.forEach(card => observer.observe(card, { attributes: true }));
}

function setupLiveMonitor() {
  const modal = document.getElementById('liveMonitorModal');
  const video = document.getElementById('webcamVideo');
  const canvas = document.getElementById('detectionCanvas');
  const ctx = canvas.getContext('2d');
  const peopleCountEl = document.getElementById('peopleCount');
  const fireStatusEl = document.getElementById('fireStatus');
  const stopBtn = document.getElementById('stopMonitorBtn');
  let stream = null;
  let interval = null;

  const startMonitor = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      interval = setInterval(async () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const response = await fetchApi('/analyze-frame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: dataUrl })
          });
          // Mock response for testing
          // const response = { people_count: Math.floor(Math.random() * 5), fire_detected: Math.random() > 0.8 };
          peopleCountEl.textContent = response.people_count || 0;
          fireStatusEl.textContent = response.fire_detected ? 'Yes' : 'No';
          fireStatusEl.className = response.fire_detected ? 'text-danger' : 'text-success';
        }
      }, 2000);
    } catch (error) {
      console.error('Failed to start webcam', error);
      alert('Unable to access webcam.');
    }
  };

  const stopMonitor = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    video.srcObject = null;
    peopleCountEl.textContent = '0';
    fireStatusEl.textContent = 'No';
    fireStatusEl.className = '';
  };

  // Use Bootstrap events if available; otherwise fallback to manual show/hide
  if (window.bootstrap && window.bootstrap.Modal) {
    const bsModal = new window.bootstrap.Modal(modal);
    modal.addEventListener('show.bs.modal', startMonitor);
    modal.addEventListener('hide.bs.modal', stopMonitor);
    stopBtn?.addEventListener('click', () => bsModal.hide());
  } else {
    // Manual fallback
    const showModal = () => {
      modal.style.display = 'block';
      modal.classList.add('show');
      document.body.classList.add('modal-open');
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop fade show';
      backdrop.id = 'modal-backdrop';
      document.body.appendChild(backdrop);
      startMonitor();
    };
    const hideModal = () => {
      modal.style.display = '';
      modal.classList.remove('show');
      document.body.classList.remove('modal-open');
      document.getElementById('modal-backdrop')?.remove();
      stopMonitor();
    };
    document.querySelector('[data-action="live-monitor"]')?.addEventListener('click', showModal);
    modal.querySelector('[data-bs-dismiss="modal"]')?.addEventListener('click', hideModal);
    stopBtn?.addEventListener('click', hideModal);
  }
}

function onDocumentReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

// DOM Elements
onDocumentReady(() => {
  console.log('Project Drishti Dashboard Initialized');
  initializeDashboard();
});

// Initialize Dashboard with mock data
function initializeDashboard() {
  initRoleSelector();
  if (db) {
    runInitializer('Realtime listeners', attachRealtimeListeners);
  } else {
    console.warn('Firestore unavailable, using REST API fallbacks.');
    runInitializer('API fallbacks', bootstrapApiFallbacks);
  }
  runInitializer('Map', initializeMap);
  runInitializer('Video analytics simulation', simulateVideoAnalytics);
  runInitializer('Camera count simulation', simulateCameraPeopleCounts);
  runInitializer('Forecast button', bindForecastButton);
  runInitializer('Lost & Found module', setupLostFoundModule);
  runInitializer('Evacuation module', setupEvacuationModule);
  runInitializer('Evacuation history', setupEvacuationHistory);
  runInitializer('Incidents table', setupIncidentsTable);
  runInitializer('Analytics table', setupAnalyticsTable);
  runInitializer('Analytics overview', setupAnalyticsOverview);
  runInitializer('Crowd trends chart', setupCrowdTrendsChart);
  runInitializer('Zone predictions', setupZonePredictions);
  runInitializer('Incident distribution', setupIncidentDistribution);
  runInitializer('Dashboard stream', startDashboardStream);
  runInitializer('Live monitor', setupLiveMonitor);
  runInitializer('Video people count', setupVideoPeopleCount);
  // Settings page only
  if (window.location.pathname.endsWith('settings.html')) {
    runInitializer('Settings', setupSettings);
  }
}

function bootstrapApiFallbacks() {
  refreshAlertsFromApi();
  refreshAnalyticsFromApi();
  refreshIncidentsFromApi();
  // Re-poll periodically to keep UI fresh
  setInterval(refreshAlertsFromApi, 30_000);
  setInterval(refreshAnalyticsFromApi, 45_000);
  setInterval(refreshIncidentsFromApi, 60_000);
}

async function fetchApi(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const fetchOptions = { ...options };
  const headers = new Headers(options.headers || {});
  if (!headers.has('X-User-Role')) {
    headers.set('X-User-Role', getCurrentRole());
  }
  fetchOptions.headers = headers;

  const response = await fetch(url, fetchOptions);
  if (!response.ok) {
    const text = await response.text();
    let errorMessage = text;
    try {
      const parsed = JSON.parse(text || '{}');
      errorMessage = parsed.error || parsed.message || text;
    } catch (error) {
      // no-op, fall back to raw text
    }
    throw new Error(`API ${response.status}: ${errorMessage || 'Request failed'}`);
  }

  if (response.status === 204) {
    return null;
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength === '0') {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

function attachRealtimeListeners() {
  if (!db) {
    return;
  }
  listenToAlerts();
  listenToAnalytics();
}

function listenToAlerts() {
  if (!db) {
    return;
  }
  console.log('Subscribing to Firestore alerts...');
  db.collection('alerts')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .onSnapshot((snapshot) => {
      const alerts = snapshot.docs.map((doc) => doc.data());
      renderAlertsList(alerts);
    }, (error) => {
      console.error('Error listening to alerts:', error);
    });
}

function renderAlertsList(alerts = []) {
  const alertList = document.querySelector('.alert-list');
  if (!alertList) {
    return;
  }
  alertList.innerHTML = '';
  alerts.forEach((alert) => {
    alertList.appendChild(renderAlert(alert));
  });
  updateAlertCounters(alerts.length);
}

function renderAlert(alert) {
  const severity = alert.severity || 'medium';
  const iconMap = {
    crowd_bottleneck: 'bi-people',
    crowd: 'bi-people',
    medical: 'bi-thermometer-high',
    security: 'bi-shield-exclamation',
    fire: 'bi-fire'
  };
  const iconClass = iconMap[alert.type] || 'bi-bell';
  const timeAgo = formatTimestamp(alert.createdAt);
  const confidence = alert.aiConfidence ? `${Math.round(alert.aiConfidence * 100)}% confidence` : null;

  container.className = `alert-item ${severity}`;
  container.dataset.alertId = alert.id;
  container.innerHTML = `
    <div class="alert-icon"><i class="bi ${iconClass}"></i></div>
    <div class="alert-content">
      <h4>${alert.title || alert.description || 'New Alert'}</h4>
      <p>${alert.location?.zone ? `${alert.location.zone}` : 'Unknown Zone'}</p>
      <div class="alert-meta">
        <span class="alert-time">${timeAgo}</span>
        ${confidence ? `<span class="alert-confidence">${confidence}</span>` : ''}
      </div>
    </div>
    <div class="alert-actions">
      <button class="btn btn-sm btn-outline-light" data-action="alert-view">View</button>
      <button class="btn btn-sm btn-primary" data-action="alert-respond">Respond</button>
      <button class="btn btn-sm btn-outline-danger" data-action="alert-archive">Archive</button>
    </div>
  `;
  return container;
}

// ... (rest of the code remains the same)

function setupLostFoundModule() {
  const listEl = document.getElementById('lost-found-list');
  const formEl = document.getElementById('lost-found-form');
  const refreshBtn = document.getElementById('lost-found-refresh');

  if (!listEl || !formEl) {
    return;
  }

  const setLoadingMessage = (message) => {
    listEl.innerHTML = `<div class="p-4 text-muted">${message}</div>`;
  };

  const renderLostFoundList = (items = []) => {
    if (!items.length) {
      setLoadingMessage('No lost & found reports yet.');
      return;
    }

    listEl.innerHTML = '';
    items.forEach((item) => {
      const statusClass = item.status === 'resolved' ? 'bg-success' : item.status === 'investigating' ? 'bg-warning text-dark' : 'bg-danger';
      const element = document.createElement('div');
      element.className = 'list-group-item list-group-item-action d-flex gap-3 align-items-start';
      element.innerHTML = `
        <div class="avatar-circle bg-primary-subtle text-primary">${(item.name || '?').slice(0, 2).toUpperCase()}</div>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <strong>${item.name || 'Unknown'}</strong>
            <span class="badge ${statusClass}">${item.status || 'open'}</span>
          </div>
          <p class="mb-1 small text-muted">${item.description || 'No description'}
            ${item.age ? ` • ${item.age} yrs` : ''}
            ${item.relation ? ` • ${item.relation}` : ''}
          </p>
          <div class="small text-muted">Last seen: ${item.lastSeen?.zone || 'Unknown zone'} · ${formatTimestamp(item.lastSeen?.time || item.reportedAt)}</div>
          <div class="d-flex gap-2 mt-2">
            <button class="btn btn-sm btn-outline-secondary" data-lost-found-action="contact" data-entry-id="${item.id}">
              <i class="bi bi-telephone"></i> ${item.contact || 'Contact'}</button>
            <button class="btn btn-sm btn-outline-success" data-lost-found-action="resolve" data-entry-id="${item.id}" ${item.status === 'resolved' ? 'disabled' : ''}>
              <i class="bi bi-check2"></i> Mark Resolved</button>
            <button class="btn btn-sm btn-outline-danger" data-lost-found-action="delete" data-entry-id="${item.id}">
              <i class="bi bi-archive"></i> Archive</button>
          </div>
        </div>`;
      listEl.appendChild(element);
    });
  };

  const loadLostFound = async () => {
    try {
      setLoadingMessage('Loading lost & found records...');
      const data = await fetchApi('/lost-found');
      renderLostFoundList(data?.items || []);
    } catch (error) {
      console.error('Failed to load lost & found data', error);
      setLoadingMessage('Unable to load records. Please try again.');
    }
  };

  const createLostFound = async (payload) => {
    await fetchApi('/lost-found', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    await loadLostFound();
  };

  const updateLostFoundStatus = async (entryId, status) => {
    if (!entryId) {
      return;
    }
    await fetchApi(`/lost-found/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    await loadLostFound();
  };

  formEl.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!requireRole(['responder', 'dispatcher', 'admin'], 'Submitting lost & found reports')) {
      return;
    }
    const formData = new FormData(formEl);
    const payload = {
      name: formData.get('name'),
      age: formData.get('age') ? Number(formData.get('age')) : undefined,
      relation: formData.get('relation') || 'other',
      description: formData.get('description'),
      lastSeen: {
        zone: formData.get('zone'),
        time: new Date().toISOString()
      },
      contact: formData.get('contact'),
      notes: formData.get('notes') || ''
    };

    const submitBtn = formEl.querySelector('button[type="submit"]');
    try {
      setButtonLoading(submitBtn, true, 'Submitting...');
      await createLostFound(payload);
      formEl.reset();
      showToast('Lost & found report submitted');
    } catch (error) {
      console.error('Failed to submit lost & found report', error);
      showToast('Failed to submit report. Please try again.');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  listEl.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-lost-found-action]');
    if (!button) {
      return;
    }
    const entryId = button.dataset.entryId;
    const action = button.dataset.lostFoundAction;

    if (action === 'resolve') {
      if (!requireRole(['responder', 'dispatcher', 'admin'], 'Updating lost & found cases')) {
        return;
      }
      setButtonLoading(button, true, 'Resolving...');
      await updateLostFoundStatus(entryId, 'resolved');
      showToast('Case marked as resolved');
      setButtonLoading(button, false);
    }

    if (action === 'contact') {
      if (button.textContent.trim()) {
        showToast(`Contact: ${button.textContent.trim()}`);
      }
    }

    if (action === 'delete') {
      if (!requireRole(['dispatcher', 'admin'], 'Archiving lost & found cases')) {
        return;
      }
      showModal({
        title: 'Archive Case',
        body: 'Are you sure you want to archive this lost & found case? It will be removed from the list.',
        primaryAction: {
          label: 'Archive',
          handler: async () => {
            try {
              await fetchApi(`/lost-found/${entryId}`, { method: 'DELETE' });
              showToast('Case archived');
              await loadLostFound();
            } catch (error) {
              console.error('Failed to archive case', error);
              showToast('Unable to archive case');
            }
          }
        }
      });
    }
  });

  refreshBtn?.addEventListener('click', loadLostFound);

  loadLostFound();

  window.drishtiLostFound = {
    load: loadLostFound
  };
}

function setupEvacuationModule() {
  const formEl = document.getElementById('evacuation-form');
  const resultEl = document.getElementById('evacuation-plan-result');
  if (!formEl || !resultEl) {
    return;
  }

  formEl.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!requireRole(['analyst', 'dispatcher', 'admin'], 'Generating evacuation plans')) {
      return;
    }
    const formData = new FormData(formEl);
    const exitsRaw = formData.get('exits') || '';
    const payload = {
      hazardType: formData.get('hazard') || 'crowd',
      originZone: formData.get('origin') || 'Main Stage',
      availableExits: exitsRaw
        .split(',')
        .map((exit) => exit.trim())
        .filter(Boolean)
    };

    const submitBtn = formEl.querySelector('button[type="submit"]');
    try {
      setButtonLoading(submitBtn, true, 'Generating...');
      resultEl.textContent = 'Generating evacuation plan...';
      const plan = await fetchApi('/evacuation-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      renderEvacuationPlan(plan, resultEl);
      window.drishtiEvacHistory?.load();
    } catch (error) {
      console.error('Failed to generate evacuation plan', error);
      resultEl.innerHTML = '<span class="text-danger">Unable to generate evacuation plan. Please try again.</span>';
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

function setupEvacuationHistory() {
  const listEl = document.getElementById('evacuation-plans-list');
  const refreshBtn = document.getElementById('evacuation-history-refresh');
  if (!listEl) {
    return;
  }

  const setState = (message) => {
    listEl.innerHTML = `<div class="p-4 text-muted">${message}</div>`;
  };

  const renderList = (items = []) => {
    if (!items.length) {
      setState('No plans generated yet.');
      return;
    }
    listEl.innerHTML = '';
    items.forEach((plan) => {
      const item = document.createElement('div');
      item.className = 'list-group-item d-flex justify-content-between align-items-start gap-2 flex-column';
      item.innerHTML = `
        <div class="w-100 d-flex justify-content-between align-items-center">
          <div>
            <strong>${plan.hazardType || 'Hazard'}</strong>
            <span class="text-muted">· ${plan.originZone}</span>
          </div>
          <span class="badge bg-secondary">ETA ${plan.estimatedEvacuationTime || '--'} min</span>
        </div>
        <div class="small text-muted w-100">Recommended Exit: ${plan.recommendedExit}</div>
        <div class="d-flex w-100 justify-content-between align-items-center">
          <small class="text-muted">${formatTimestamp(plan.requestedAt)}</small>
          <button class="btn btn-sm btn-outline-secondary" data-action="share-plan" data-plan-id="${plan.planId}">
            <i class="bi bi-share"></i> Share
          </button>
        </div>`;
      listEl.appendChild(item);
    });
  };

  const loadHistory = async () => {
    try {
      setState('Loading plans...');
      const data = await fetchApi('/evacuation-plans?limit=5');
      renderList(data?.items || []);
    } catch (error) {
      console.error('Failed to load evacuation plans', error);
      setState('Unable to load evacuation plans.');
    }
  };

  listEl.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action="share-plan"]');
    if (!button) {
      return;
    }
    const planId = button.dataset.planId;
    try {
      if (!requireRole(['analyst', 'dispatcher', 'admin'], 'Sharing evacuation plans')) {
        return;
      }
      setButtonLoading(button, true, 'Sharing...');
      const plan = await fetchApi(`/evacuation-plans/${planId}`);
      const summary = formatEvacuationShare(plan);
      let recipient = prompt('Enter recipient name', 'Operations Center');
      if (!recipient) {
        recipient = 'Clipboard Share';
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary);
        showToast('Plan copied to clipboard');
      } else {
        prompt('Copy this plan summary:', summary);
      }
      try {
        await fetchApi(`/evacuation-plans/${planId}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient, method: navigator.clipboard ? 'clipboard' : 'manual_prompt' })
        });
      } catch (shareError) {
        console.warn('Failed to log share', shareError);
      }
    } catch (error) {
      console.error('Failed to share plan', error);
      showToast('Unable to share plan.');
    } finally {
      setButtonLoading(button, false);
    }
  });

  refreshBtn?.addEventListener('click', loadHistory);

  loadHistory();

  window.drishtiEvacHistory = {
    load: loadHistory
  };
}

function formatIncidentDetails(incident) {
  const fields = [
    { label: 'Type', value: (incident.type || 'N/A').replace('_', ' ') },
    { label: 'Severity', value: incident.severity || 'N/A' },
    { label: 'Status', value: incident.status || 'N/A' },
    { label: 'Location', value: incident.location?.zone || 'Unknown' },
    { label: 'Reported By', value: incident.reportedBy || 'Unknown' },
    { label: 'Confidence', value: incident.aiConfidence ? `${Math.round(incident.aiConfidence * 100)}%` : '--' },
    { label: 'Created', value: formatTimestamp(incident.createdAt) }
  ];

  const metadata = fields
    .map((field) => `<div class="d-flex justify-content-between"><span class="text-muted">${field.label}</span><strong>${field.value}</strong></div>`)
    .join('');

  const description = incident.description || 'No description provided.';

  return `
    <div class="mb-3">${metadata}</div>
    <div>
      <h6>Description</h6>
      <p class="mb-0">${description}</p>
    </div>`;
}

function renderEvacuationPlan(plan, container) {
  if (!plan) {
    container.textContent = 'No plan available.';
    return;
  }

  const stepsMarkup = (plan.steps || []).map((step) => `
    <li class="list-group-item d-flex justify-content-between align-items-center">
      <span><strong>T+${step.minute}m:</strong> ${step.action}</span>
      <span class="badge ${step.status === 'completed' ? 'bg-success' : 'bg-secondary'}">${step.status}</span>
    </li>`).join('');

  container.innerHTML = `
    <div class="mb-2">
      <strong>Hazard:</strong> ${plan.hazardType || 'N/A'} · <strong>Origin:</strong> ${plan.originZone}
    </div>
    <div class="mb-2">
      <strong>Recommended Exit:</strong> ${plan.recommendedExit} · <strong>ETA:</strong> ${plan.estimatedEvacuationTime} min
    </div>
    <div class="mb-2">${plan.notes || ''}</div>
    <ul class="list-group list-group-flush">
      ${stepsMarkup || '<li class="list-group-item">No steps defined.</li>'}
    </ul>`;
}

function renderForecastList(container, predictions = []) {
  if (!predictions.length) {
    container.innerHTML = '<p class="text-muted small mb-0">No active bottlenecks predicted.</p>';
    return;
  }

  const sorted = predictions
    .slice()
    .sort((a, b) => (b.bottleneckRisk || 0) - (a.bottleneckRisk || 0));

  container.innerHTML = '';
  sorted.forEach((prediction) => {
    const { zoneName, predictedDensity, bottleneckRisk, timeToBottleneck, predictionSource } = prediction;
    const row = document.createElement('div');
    row.className = 'forecast-row';
    row.innerHTML = `
      <div>
        <strong>${zoneName}</strong>
        <p class="text-muted small mb-0">${predictionSource === 'vertex_ai' ? 'Vertex AI' : 'Heuristic'} · ${timeToBottleneck || '--'} min</p>
      </div>
      <div class="text-end">
        <div class="fw-semibold">${formatPercent(predictedDensity)}</div>
        <span class="badge ${riskToBadgeClass(bottleneckRisk)}">${formatPercent(bottleneckRisk)} risk</span>
      </div>
    `;
    container.appendChild(row);
  });
}

function formatPercent(value) {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return '--';
  }
  return `${Math.round(num * 100)}%`;
}

function riskToBadgeClass(risk) {
  if (risk >= 0.9) {
    return 'bg-danger';
  }
  if (risk >= 0.7) {
    return 'bg-warning text-dark';
  }
  return 'bg-success';
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return 'Just now';
  }
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes <= 0) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }
  return date.toLocaleDateString();
}

function bindForecastButton() {
  const button = document.querySelector('[data-action="refresh-forecast"]');
  if (!button || !functions) {
    return;
  }

  const runForecast = functions.httpsCallable('predictCrowdBottlenecks');
  let inFlight = false;

  button.addEventListener('click', async () => {
    if (inFlight) {
      return;
    }

    const originalContent = button.innerHTML;
    const venueId = document.body.dataset.defaultVenue || 'demo-venue-001';
    const currentCrowdData = collectCrowdSnapshot();

    inFlight = true;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Requesting...';

    try {
      await runForecast({ venueId, currentCrowdData, horizonMinutes: 20 });
      showToast('Forecast requested. Awaiting Vertex AI results...');
    } catch (error) {
      console.error('Failed to trigger forecast run', error);
      showModal({
        title: 'Forecast Error',
        body: error?.message || 'Unable to request Vertex forecast. Please try again.'
      });
    } finally {
      inFlight = false;
      button.disabled = false;
      button.innerHTML = originalContent;
    }
  });
}

function collectCrowdSnapshot() {
  const snapshot = {};
  document.querySelectorAll('[data-camera-count]').forEach((container) => {
    const zoneId = container.dataset.cameraCount;
    if (!zoneId) {
      return;
    }
    const valueText = container.querySelector('.count-value')?.textContent || '';
    const numericValue = Number(valueText.replace(/[^0-9.]/g, ''));
    if (Number.isNaN(numericValue)) {
      return;
    }
    const normalized = Math.max(0, Math.min(1.5, numericValue / 100));
    snapshot[zoneId] = normalized;
  });

  if (!Object.keys(snapshot).length) {
    snapshot['default-zone'] = 0.35;
  }

  return snapshot;
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
            <button type="button" class="btn btn-primary" data-action="modal-primary">Proceed</button>
          </div>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', modalTemplate);
}

function showModal({ title, body, primaryAction, bodyIsHtml = false }) {
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
  const modalBody = modalEl.querySelector('.modal-body');
  if (bodyIsHtml) {
    modalBody.innerHTML = body || '';
  } else {
    modalBody.textContent = body || '';
  }

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
      if (!requireRole(['responder', 'dispatcher', 'admin'], 'Dispatching responses')) {
        return;
      }
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

    if (action === 'alert-archive') {
      if (!requireRole(['dispatcher', 'admin'], 'Archiving alerts')) {
        return;
      }
      const alertId = alertItem?.dataset.alertId;
      if (!alertId) {
        showToast('Unknown alert ID');
        return;
      }
      showModal({
        title: 'Archive Alert',
        body: 'Are you sure you want to archive this alert?',
        primaryAction: {
          label: 'Archive',
          handler: async () => {
            try {
              await fetchApi(`/alerts/${alertId}`, { method: 'DELETE' });
              showToast('Alert archived');
              refreshAlertsFromApi();
              window.drishtiIncidents?.load?.();
            } catch (error) {
              console.error('Failed to archive alert', error);
              showToast('Unable to archive alert');
            }
          }
        }
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