// Fallback mock cases (exactly 2 cases as required)
const mockCases = [
  { id: 'GA-1024', caseId: 'GA-1024', name: 'Emily Johnson', reason: 'Impact Detection (High Velocity)', location: 'Rajahmundry Main Rd', time: '15:26', severity: 'Critical', score: 87, status: 'Incoming', bpm: 154, nodeId: 'NODE-INGRESS-04' },
  { id: 'GA-1025', caseId: 'GA-1025', name: 'Rahul Desai', reason: 'Abnormal Heart Rate & Syncope', location: 'Sector 4 Residential', time: '15:28', severity: 'High', score: 72, status: 'Active', bpm: 165 }
];

const mockUnits = [
  { id: 'Unit 01', name: 'Intercept Patrol', officer: 'K. Sharma', status: 'Available', vehicle: 'Patrol Interceptor #04' },
  { id: 'Unit 02', name: 'EMS Response', officer: 'T. Verma', status: 'Available', vehicle: 'ALS Ambulance #12' },
  { id: 'Unit 03', name: 'Med Support', officer: 'D. Rao', status: 'Available', vehicle: 'Paramedic Rapid Response #08' },
];

// Broadcast channel for real-time cross-tab synchronization
let syncChannel = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    syncChannel = new BroadcastChannel('guardian_ai_sync');
  }
} catch (e) {}

function broadcastAction(type, data = {}) {
  try {
    if (syncChannel) {
      syncChannel.postMessage({ type, ...data, timestamp: Date.now() });
    }
    localStorage.setItem('guardian_ai_event', JSON.stringify({ type, ...data, timestamp: Date.now() }));
  } catch (e) {}
}

// Automatically detect backend API location (supports port 8000, 3000, 5500 Live Server, etc.)
function getApiBase() {
  if (typeof window !== 'undefined') {
    if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port === '8000') {
      return '';
    }
    return 'http://localhost:8000';
  }
  return 'http://localhost:8000';
}
const API_BASE = getApiBase();

export const ApiService = {
  async getActiveCases() {
    try {
      const res = await fetch(`${API_BASE}/api/emergency/cases`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.cases) && data.cases.length > 0) {
          return data.cases.slice(0, 2);
        }
      }
    } catch (e) {
      console.warn('[EOC API] Could not fetch live cases from backend, using fallback:', e);
    }
    return [...mockCases].slice(0, 2);
  },

  async getUnits() {
    try {
      const res = await fetch(`${API_BASE}/api/emergency/units`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.units)) {
          return data.units;
        }
      }
    } catch (e) {}
    return [...mockUnits];
  },

  async acknowledgeCase(caseId) {
    try {
      const res = await fetch(`${API_BASE}/api/sos/police/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, officer: 'Inspector S. Connor (OP-8492)' })
      });
      broadcastAction('POLICE_ACKNOWLEDGED', { caseId, officer: 'Inspector S. Connor' });
      if (res.ok) {
        const data = await res.json();
        return data.incident;
      }
    } catch (e) {
      console.warn('[EOC API] Police acknowledge failed:', e);
    }
    
    // Local fallback update
    const cIdx = mockCases.findIndex(c => c.id === caseId || c.caseId === caseId);
    if (cIdx !== -1) {
      mockCases[cIdx] = { ...mockCases[cIdx], status: 'Active' };
      return mockCases[cIdx];
    }
    return { id: caseId, status: 'Active' };
  },

  async dispatchUnit(caseId, unitId) {
    try {
      const res = await fetch(`${API_BASE}/api/sos/police/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, unitId: unitId || 'Unit 01 (Intercept Patrol)', eta: '2m 10s' })
      });
      broadcastAction('POLICE_DISPATCHED', { caseId, unitId, eta: '2m 10s' });
      if (res.ok) {
        const data = await res.json();
        return { updatedCase: data.incident };
      }
    } catch (e) {
      console.warn('[EOC API] Police dispatch failed:', e);
    }

    const cIdx = mockCases.findIndex(c => c.id === caseId || c.caseId === caseId);
    const uIdx = mockUnits.findIndex(u => u.id === unitId);
    if (cIdx !== -1) mockCases[cIdx] = { ...mockCases[cIdx], assignedUnit: unitId, status: 'In Transit' };
    if (uIdx !== -1) mockUnits[uIdx] = { ...mockUnits[uIdx], status: 'In Transit', eta: '2m 10s' };

    return {
      updatedCase: mockCases[cIdx] || { id: caseId, assignedUnit: unitId },
      updatedUnit: mockUnits[uIdx] || { id: unitId, status: 'In Transit' }
    };
  },

  async resolveCase(caseId) {
    try {
      const res = await fetch(`${API_BASE}/api/sos/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, resolutionNotes: 'Resolved by Police Dispatch Officer' })
      });
      broadcastAction('POLICE_RESOLVED', { caseId });
      if (res.ok) {
        return caseId;
      }
    } catch (e) {
      console.warn('[EOC API] Police resolve failed:', e);
    }

    const cIdx = mockCases.findIndex(c => c.id === caseId || c.caseId === caseId);
    if (cIdx !== -1) {
      mockCases[cIdx] = { ...mockCases[cIdx], status: 'Resolved' };
    }
    return caseId;
  },
  
  async sendDirective(caseId, message) {
    return true;
  }
};
