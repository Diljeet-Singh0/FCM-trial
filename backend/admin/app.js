/* GoZo Admin Panel — App Logic */
const API = window.location.origin;
let authToken = sessionStorage.getItem('adminToken') || '';

// ── Auth ──
async function handleLogin() {
  const pin = document.getElementById('pinInput').value;
  if (!pin) return;
  try {
    const r = await fetch(`${API}/admin/auth`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const d = await r.json();
    if (d.success) {
      authToken = d.token;
      sessionStorage.setItem('adminToken', authToken);
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('dashboard').classList.remove('hidden');
      loadCompanies(); loadDrivers(); loadScheduledRides();
    } else {
      document.getElementById('loginError').textContent = d.error || 'Invalid PIN';
    }
  } catch { document.getElementById('loginError').textContent = 'Connection failed'; }
}

function handleLogout() {
  authToken = '';
  sessionStorage.removeItem('adminToken');
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('pinInput').value = '';
}

function authHeaders() {
  return { 'Content-Type': 'application/json', 'x-admin-token': authToken };
}

// Auto-login if token exists — validate it first
window.addEventListener('DOMContentLoaded', async () => {
  if (authToken) {
    try {
      const r = await fetch(`${API}/admin/api/companies`, { headers: authHeaders() });
      if (r.status === 401) {
        // Token is stale, force re-login
        authToken = '';
        sessionStorage.removeItem('adminToken');
      } else {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        const d = await r.json();
        if (d.success) { companies = d.companies; renderCompanies(); }
        loadDrivers();
        loadScheduledRides();
      }
    } catch {
      authToken = '';
      sessionStorage.removeItem('adminToken');
    }
  }
  document.getElementById('pinInput').addEventListener('keypress', e => {
    if (e.key === 'Enter') handleLogin();
  });
});

// ── Tabs ──
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`${tab}Tab`).classList.add('active');
  if (tab === 'scheduled') {
    loadScheduledRides();
  }
}

// ── Toast ──
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = isError ? 'toast error' : 'toast';
  setTimeout(() => t.classList.add('hidden'), 3000);
}

// ── Companies ──
let companies = [];

async function loadCompanies() {
  try {
    const r = await fetch(`${API}/admin/api/companies`, { headers: authHeaders() });
    const d = await r.json();
    if (d.success) { 
      companies = d.companies || []; 
      renderCompanies(); 
    } else {
      showToast(d.error, true);
    }
  } catch { 
    showToast('Failed to load companies', true); 
  }
}

function renderCompanies() {
  const body = document.getElementById('companiesBody');
  const comps = Array.isArray(companies) ? companies : [];
  document.getElementById('companyCount').textContent = `${comps.length} companies registered`;
  if (!comps.length) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#64748B">No companies yet. Click "Add Company" to create one.</td></tr>';
    return;
  }
  body.innerHTML = comps.map(c => `<tr>
    <td><code style="background:#1E293B;padding:3px 8px;border-radius:4px;font-size:12px">${esc(c.id)}</code></td>
    <td class="td-name">${esc(c.name)}</td>
    <td>${esc(c.location || '-')}</td>
    <td>₹${c.rate_per_kg || 0}</td>
    <td>⭐ ${c.rating || 0}</td>
    <td>${esc(c.contact_phone || '-')}</td>
    <td>
      <button class="action-btn edit-btn" onclick="editCompany('${c.id}')">Edit</button>
      <button class="action-btn del-btn" onclick="deleteCompany('${c.id}')">Delete</button>
    </td>
  </tr>`).join('');
}

let stateGroupCount = 0;

function addRouteGroupState(stateData = null) {
  const container = document.getElementById('routeGroupsContainer');
  const cardId = 'state-group-' + (++stateGroupCount);
  
  const card = document.createElement('div');
  card.className = 'state-group-card';
  card.id = cardId;
  
  const stateName = stateData ? stateData.state : '';
  const priceMin = stateData ? (stateData.price_min ?? '') : '';
  const priceMax = stateData ? (stateData.price_max ?? '') : '';
  const deliveryDaysMin = stateData ? (stateData.delivery_days_min ?? '') : '';
  const deliveryDaysMax = stateData ? (stateData.delivery_days_max ?? '') : '';
  
  let standardCitiesStr = '';
  if (stateData && stateData.cities) {
    const stdNames = stateData.cities
      .filter(c => c.price_min == null && c.price_max == null && c.delivery_days_min == null && c.delivery_days_max == null)
      .map(c => c.name);
    standardCitiesStr = stdNames.join(', ');
  }

  card.innerHTML = `
    <div class="state-group-header">
      <span class="state-group-title">📍 State Route Group</span>
      <button type="button" class="remove-state-btn" onclick="removeRouteGroupState('${cardId}')">Remove</button>
    </div>
    <div class="state-grid">
      <div class="form-group">
        <label>State Name</label>
        <input type="text" class="state-name-input" placeholder="e.g. Punjab" value="${esc(stateName)}" required>
      </div>
      <div class="form-group">
        <label>Base Price Min (₹)</label>
        <input type="number" class="state-price-min" step="0.5" placeholder="Min Price" value="${priceMin}">
      </div>
      <div class="form-group">
        <label>Base Price Max (₹)</label>
        <input type="number" class="state-price-max" step="0.5" placeholder="Max Price" value="${priceMax}">
      </div>
      <div class="form-group">
        <label>Base Days Min</label>
        <input type="number" class="state-days-min" placeholder="Min Days" value="${deliveryDaysMin}">
      </div>
      <div class="form-group">
        <label>Base Days Max</label>
        <input type="number" class="state-days-max" placeholder="Max Days" value="${deliveryDaysMax}">
      </div>
    </div>
    <div class="form-group" style="margin-top: 10px;">
      <label>Standard Cities (comma separated)</label>
      <input type="text" class="state-cities-list" placeholder="Ludhiana, Jalandhar, Amritsar" value="${esc(standardCitiesStr)}">
    </div>
    
    <div class="custom-cities-section">
      <div class="custom-cities-header">
        <span>Custom City Override Pricing</span>
        <button type="button" class="add-city-btn" onclick="addCustomCityRow('${cardId}')">+ Add Custom City Price</button>
      </div>
      <div class="custom-cities-list-container">
        <!-- Custom city rows go here -->
      </div>
    </div>
  `;
  
  container.appendChild(card);
  
  if (stateData && stateData.cities) {
    const customCities = stateData.cities.filter(c => 
      c.price_min != null || c.price_max != null || c.delivery_days_min != null || c.delivery_days_max != null
    );
    customCities.forEach(city => {
      addCustomCityRow(cardId, city);
    });
  }
}

function removeRouteGroupState(cardId) {
  const el = document.getElementById(cardId);
  if (el) el.remove();
}

function addCustomCityRow(cardId, cityData = null) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const container = card.querySelector('.custom-cities-list-container');
  
  const row = document.createElement('div');
  row.className = 'custom-city-row';
  
  const cityName = cityData ? cityData.name : '';
  const priceMin = cityData ? (cityData.price_min ?? '') : '';
  const priceMax = cityData ? (cityData.price_max ?? '') : '';
  const daysMin = cityData ? (cityData.delivery_days_min ?? '') : '';
  const daysMax = cityData ? (cityData.delivery_days_max ?? '') : '';
  
  row.innerHTML = `
    <input type="text" class="city-name" placeholder="City Name" value="${esc(cityName)}" required style="grid-column: span 1">
    <input type="number" class="city-price-min" step="0.5" placeholder="Min ₹" value="${priceMin}">
    <input type="number" class="city-price-max" step="0.5" placeholder="Max ₹" value="${priceMax}">
    <input type="number" class="city-days-min" placeholder="Min Days" value="${daysMin}">
    <input type="number" class="city-days-max" placeholder="Max Days" value="${daysMax}">
    <button type="button" class="remove-city-btn" onclick="this.parentElement.remove()">✕</button>
  `;
  
  container.appendChild(row);
}

function serializeRouteBuilder() {
  const routesV2 = [];
  const cards = document.querySelectorAll('.state-group-card');
  
  cards.forEach(card => {
    const stateName = card.querySelector('.state-name-input').value.trim();
    if (!stateName) return;
    
    const priceMinVal = card.querySelector('.state-price-min').value;
    const priceMaxVal = card.querySelector('.state-price-max').value;
    const daysMinVal = card.querySelector('.state-days-min').value;
    const daysMaxVal = card.querySelector('.state-days-max').value;
    
    const stateGroup = {
      state: stateName,
      price_min: priceMinVal ? parseFloat(priceMinVal) : null,
      price_max: priceMaxVal ? parseFloat(priceMaxVal) : null,
      delivery_days_min: daysMinVal ? parseInt(daysMinVal, 10) : null,
      delivery_days_max: daysMaxVal ? parseInt(daysMaxVal, 10) : null,
      cities: []
    };
    
    const stdCitiesStr = card.querySelector('.state-cities-list').value;
    if (stdCitiesStr) {
      const names = stdCitiesStr.split(',').map(n => n.trim()).filter(Boolean);
      names.forEach(name => {
        stateGroup.cities.push({ name });
      });
    }
    
    const cityRows = card.querySelectorAll('.custom-city-row');
    cityRows.forEach(row => {
      const cityName = row.querySelector('.city-name').value.trim();
      if (!cityName) return;
      
      const cityPriceMin = row.querySelector('.city-price-min').value;
      const cityPriceMax = row.querySelector('.city-price-max').value;
      const cityDaysMin = row.querySelector('.city-days-min').value;
      const cityDaysMax = row.querySelector('.city-days-max').value;
      
      stateGroup.cities.push({
        name: cityName,
        price_min: cityPriceMin ? parseFloat(cityPriceMin) : null,
        price_max: cityPriceMax ? parseFloat(cityPriceMax) : null,
        delivery_days_min: cityDaysMin ? parseInt(cityDaysMin, 10) : null,
        delivery_days_max: cityDaysMax ? parseInt(cityDaysMax, 10) : null
      });
    });
    
    routesV2.push(stateGroup);
  });
  
  return routesV2;
}

function generateLegacyRoutes(routesV2) {
  const routes = [];
  routesV2.forEach(rg => {
    if (rg.state) {
      if (rg.cities && rg.cities.length > 0) {
        rg.cities.forEach(c => {
          routes.push(`${rg.state} - ${c.name}`);
        });
      } else {
        routes.push(rg.state);
      }
    }
  });
  return routes;
}

window.addRouteGroupState = addRouteGroupState;
window.removeRouteGroupState = removeRouteGroupState;
window.addCustomCityRow = addCustomCityRow;

function openCompanyModal(data = null) {
  document.getElementById('companyModal').classList.remove('hidden');
  document.getElementById('companyModalTitle').textContent = data ? 'Edit Company' : 'Add Company';
  document.getElementById('companySubmitBtn').textContent = data ? 'Save Changes' : 'Add Company';
  document.getElementById('companyEditId').value = data ? data.id : '';

  let defaultId = '';
  if (!data) {
    let maxNum = 0;
    const comps = Array.isArray(companies) ? companies : [];
    comps.forEach(c => {
      const match = c.id.match(/^tc-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    defaultId = 'tc-' + String(maxNum + 1).padStart(3, '0');
  } else {
    defaultId = data.id;
  }

  document.getElementById('cId').value = defaultId;
  document.getElementById('cId').disabled = !!data;
  document.getElementById('cName').value = data?.name || '';
  document.getElementById('cLocation').value = data?.location || '';
  document.getElementById('cRate').value = data?.rate_per_kg || '';
  document.getElementById('cRateDisplay').value = data?.rate_display || '';
  document.getElementById('cPhone').value = data?.contact_phone || '';
  document.getElementById('cDepot').value = data?.depot_address || '';
  document.getElementById('cDesc').value = data?.description || '';
  document.getElementById('cEstablished').value = data?.established || '';
  document.getElementById('cExperience').value = data?.experience || '';
  document.getElementById('cDelivery').value = data?.delivery_time || '';
  document.getElementById('cAdditional').value = data?.additional_info || '';
  
  // Populate Images
  document.getElementById('cImages').value = data?.images ? (Array.isArray(data.images) ? data.images.join('\n') : data.images) : '';

  // Populate Route Groups
  document.getElementById('routeGroupsContainer').innerHTML = '';
  if (data && data.routes_v2 && data.routes_v2.length > 0) {
    data.routes_v2.forEach(rg => addRouteGroupState(rg));
  } else if (data && data.routes && data.routes.length > 0) {
    const statesMap = {};
    data.routes.forEach(rStr => {
      const parts = rStr.split('-').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const st = parts[0];
        const ct = parts[1];
        if (!statesMap[st]) statesMap[st] = [];
        statesMap[st].push({ name: ct });
      } else if (parts.length === 1) {
        const st = parts[0];
        if (!statesMap[st]) statesMap[st] = [];
      }
    });
    Object.entries(statesMap).forEach(([state, cities]) => {
      addRouteGroupState({ state, cities });
    });
  }
}

function closeCompanyModal() {
  document.getElementById('companyModal').classList.add('hidden');
  document.getElementById('companyForm').reset();
  document.getElementById('routeGroupsContainer').innerHTML = '';
}

function editCompany(id) {
  const c = companies.find(x => x.id === id);
  if (c) openCompanyModal(c);
}

async function handleCompanySubmit(e) {
  e.preventDefault();
  const editId = document.getElementById('companyEditId').value;
  
  const imagesRaw = document.getElementById('cImages').value;
  const images = imagesRaw ? imagesRaw.split('\n').map(img => img.trim()).filter(Boolean) : [];

  const routesV2 = serializeRouteBuilder();
  const routes = generateLegacyRoutes(routesV2);

  const body = {
    id: document.getElementById('cId').value.trim(),
    name: document.getElementById('cName').value.trim(),
    location: document.getElementById('cLocation').value.trim(),
    rate_per_kg: parseFloat(document.getElementById('cRate').value) || 0,
    rate_display: document.getElementById('cRateDisplay').value.trim(),
    contact_phone: document.getElementById('cPhone').value.trim(),
    depot_address: document.getElementById('cDepot').value.trim(),
    description: document.getElementById('cDesc').value.trim(),
    established: document.getElementById('cEstablished').value.trim(),
    experience: document.getElementById('cExperience').value.trim(),
    delivery_time: document.getElementById('cDelivery').value.trim(),
    additional_info: document.getElementById('cAdditional').value.trim(),
    routes,
    routes_v2: routesV2,
    images
  };

  try {
    const url = editId ? `${API}/admin/api/companies/${editId}` : `${API}/admin/api/companies`;
    const method = editId ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
    const d = await r.json();
    if (d.success) {
      showToast(editId ? 'Company updated!' : 'Company added!');
      closeCompanyModal(); loadCompanies();
    } else showToast(d.error, true);
  } catch { showToast('Failed to save company', true); }
}

async function deleteCompany(id) {
  if (!confirm(`Delete company ${id}?`)) return;
  try {
    const r = await fetch(`${API}/admin/api/companies/${id}`, { method: 'DELETE', headers: authHeaders() });
    const d = await r.json();
    if (d.success) { showToast('Company deleted'); loadCompanies(); }
    else showToast(d.error, true);
  } catch { showToast('Failed to delete', true); }
}

// ── Drivers ──
let drivers = [];

async function loadDrivers() {
  try {
    const r = await fetch(`${API}/admin/api/drivers`, { headers: authHeaders() });
    const d = await r.json();
    if (d.success) { drivers = d.drivers; renderDrivers(); }
    else showToast(d.error, true);
  } catch { showToast('Failed to load drivers', true); }
}

function renderDrivers() {
  const body = document.getElementById('driversBody');
  document.getElementById('driverCount').textContent = `${drivers.length} drivers registered`;
  if (!drivers.length) {
    body.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:#64748B">No drivers registered. Click "Register Driver" to add one.</td></tr>';
    return;
  }
  body.innerHTML = drivers.map(d => `<tr>
    <td class="td-name">${esc(d.name)}</td>
    <td>${esc(d.phone)}</td>
    <td>${d.created_at ? new Date(d.created_at).toLocaleDateString() : '-'}</td>
    <td>
      <button class="action-btn del-btn" onclick="deleteDriver('${d.id}')">Remove</button>
    </td>
  </tr>`).join('');
}

function openDriverModal() { document.getElementById('driverModal').classList.remove('hidden'); }
function closeDriverModal() { document.getElementById('driverModal').classList.add('hidden'); document.getElementById('driverForm').reset(); }

async function handleDriverSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('dName').value.trim();
  const phone = document.getElementById('dPhone').value.trim();
  if (!name || !phone || phone.length < 10) { showToast('Enter valid name and 10-digit phone', true); return; }
  try {
    const r = await fetch(`${API}/admin/api/drivers`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ name, phone })
    });
    const d = await r.json();
    if (d.success) { showToast('Driver registered!'); closeDriverModal(); loadDrivers(); }
    else showToast(d.error, true);
  } catch { showToast('Failed to register driver', true); }
}

async function deleteDriver(id) {
  if (!confirm('Remove this driver?')) return;
  try {
    const r = await fetch(`${API}/admin/api/drivers/${id}`, { method: 'DELETE', headers: authHeaders() });
    const d = await r.json();
    if (d.success) { showToast('Driver removed'); loadDrivers(); }
    else showToast(d.error, true);
  } catch { showToast('Failed to remove driver', true); }
}

// ── Util ──
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

// ── Scheduled Rides ──
let scheduledRides = [];

async function loadScheduledRides() {
  try {
    const statusFilter = document.getElementById('filterStatus').value;
    let url = `${API}/admin/scheduled-rides`;
    if (statusFilter) {
      url += `?status=${statusFilter}`;
    }
    const r = await fetch(url, { headers: authHeaders() });
    const d = await r.json();
    if (d.success) {
      scheduledRides = d.rides || [];
      renderScheduledRides();
    } else {
      showToast(d.error, true);
    }
  } catch (err) {
    showToast('Failed to load scheduled rides', true);
  }
}

function renderScheduledRides() {
  const body = document.getElementById('scheduledBody');
  document.getElementById('scheduledCount').textContent = `${scheduledRides.length} scheduled rides`;
  if (!scheduledRides.length) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#64748B">No scheduled rides found.</td></tr>';
    return;
  }
  
  body.innerHTML = scheduledRides.map(r => {
    const isPending = r.status === 'pending';
    const isCancelled = r.status === 'cancelled';
    const hasDriver = !!r.driver;
    
    // Format Date/Time
    const schedDate = new Date(r.scheduled_time);
    const dateStr = schedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = schedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    
    const driverText = hasDriver 
      ? `<strong>${esc(r.driver.name)}</strong><br><span style="font-size: 11px; color: #64748B;">${esc(r.driver.phone)}</span>`
      : '<span style="color: #EF4444; font-weight: 600;">Unassigned</span>';
      
    const statusColors = {
      pending: '#EF4444',
      assigned: '#1A56DB',
      on_the_way: '#F59E0B',
      arrived: '#7C3AED',
      picked_up: '#0369A1',
      delivered: '#059669',
      cancelled: '#64748B'
    };
    const statusBg = {
      pending: '#FEE2E2',
      assigned: '#EFF6FF',
      on_the_way: '#FEF3C7',
      arrived: '#EDE9FE',
      picked_up: '#E0F2FE',
      delivered: '#D1FAE5',
      cancelled: '#F1F5F9'
    };
    const color = statusColors[r.status] || '#64748B';
    const bg = statusBg[r.status] || '#F1F5F9';
    
    const statusBadge = `<span style="background: ${bg}; color: ${color}; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 12px; text-transform: uppercase;">${esc(r.status)}</span>`;
    
    let actionBtn = '';
    if (isPending) {
      actionBtn = `<button class="action-btn edit-btn" style="background: #10B981; color: white;" onclick="openAssignModal('${r.id}')">Assign Driver</button>`;
    } else if (!isCancelled && r.status !== 'delivered') {
      actionBtn = `<button class="action-btn del-btn" onclick="cancelScheduledRide('${r.id}')">Cancel</button>`;
    } else {
      actionBtn = '<span style="color: #94A3B8;">-</span>';
    }
    
    return `<tr>
      <td><code style="background:#1E293B;padding:3px 8px;border-radius:4px;font-size:12px">${esc(r.booking_id)}</code></td>
      <td><strong>${esc(r.user ? r.user.name : 'Unknown')}</strong><br><span style="font-size:11px;color:#64748B">${esc(r.user ? r.user.phone : '')}</span></td>
      <td style="font-size:13px;">
        <span style="color:#10B981;font-weight:600;">Pickup:</span> ${esc(r.pickup_location)}<br>
        <span style="color:#EF4444;font-weight:600;">Drop:</span> ${esc(r.drop_location)}
      </td>
      <td><strong>${esc(dateStr)}</strong><br>${esc(timeStr)}</td>
      <td>${statusBadge}</td>
      <td>${driverText}</td>
      <td>${actionBtn}</td>
    </tr>`;
  }).join('');
}

function openAssignModal(rideId) {
  document.getElementById('assignRideId').value = rideId;
  const select = document.getElementById('assignDriverSelect');
  
  if (!drivers.length) {
    select.innerHTML = '<option value="">No registered drivers available</option>';
  } else {
    select.innerHTML = drivers.map(d => `<option value="${d.id}">${esc(d.name)} (${esc(d.phone)})</option>`).join('');
  }
  
  document.getElementById('assignModal').classList.remove('hidden');
}

function closeAssignModal() {
  document.getElementById('assignModal').classList.add('hidden');
  document.getElementById('assignForm').reset();
}

async function handleAssignSubmit(e) {
  e.preventDefault();
  const rideId = document.getElementById('assignRideId').value;
  const driverId = document.getElementById('assignDriverSelect').value;
  
  if (!driverId) {
    showToast('Please select a driver', true);
    return;
  }
  
  try {
    const r = await fetch(`${API}/admin/scheduled-rides/${rideId}/assign`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ driver_id: driverId })
    });
    const d = await r.json();
    if (d.success) {
      showToast('Driver assigned successfully!');
      closeAssignModal();
      loadScheduledRides();
    } else {
      showToast(d.error, true);
    }
  } catch (err) {
    showToast('Failed to assign driver', true);
  }
}

async function cancelScheduledRide(rideId) {
  if (!confirm('Are you sure you want to cancel this scheduled ride?')) return;
  try {
    const r = await fetch(`${API}/scheduled-rides/${rideId}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancelled_by: 'admin', reason: 'Cancelled by administrator' })
    });
    const d = await r.json();
    if (d.success) {
      showToast('Scheduled ride cancelled');
      loadScheduledRides();
    } else {
      showToast(d.error, true);
    }
  } catch (err) {
    showToast('Failed to cancel ride', true);
  }
}

window.openAssignModal = openAssignModal;
window.closeAssignModal = closeAssignModal;
window.handleAssignSubmit = handleAssignSubmit;
window.cancelScheduledRide = cancelScheduledRide;
window.loadScheduledRides = loadScheduledRides;
