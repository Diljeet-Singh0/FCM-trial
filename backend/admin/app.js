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
      loadCompanies(); loadDrivers();
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
    if (d.success) { companies = d.companies; renderCompanies(); }
    else showToast(d.error, true);
  } catch { showToast('Failed to load companies', true); }
}

function renderCompanies() {
  const body = document.getElementById('companiesBody');
  document.getElementById('companyCount').textContent = `${companies.length} companies registered`;
  if (!companies.length) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#64748B">No companies yet. Click "Add Company" to create one.</td></tr>';
    return;
  }
  body.innerHTML = companies.map(c => `<tr>
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

function openCompanyModal(data = null) {
  document.getElementById('companyModal').classList.remove('hidden');
  document.getElementById('companyModalTitle').textContent = data ? 'Edit Company' : 'Add Company';
  document.getElementById('companySubmitBtn').textContent = data ? 'Save Changes' : 'Add Company';
  document.getElementById('companyEditId').value = data ? data.id : '';

  let defaultId = '';
  if (!data) {
    let maxNum = 0;
    companies.forEach(c => {
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
  document.getElementById('cRoutes').value = data?.routes ? (Array.isArray(data.routes) ? data.routes.join(', ') : data.routes) : '';
}

function closeCompanyModal() {
  document.getElementById('companyModal').classList.add('hidden');
  document.getElementById('companyForm').reset();
}

function editCompany(id) {
  const c = companies.find(x => x.id === id);
  if (c) openCompanyModal(c);
}

async function handleCompanySubmit(e) {
  e.preventDefault();
  const editId = document.getElementById('companyEditId').value;
  const routesRaw = document.getElementById('cRoutes').value;
  const routes = routesRaw ? routesRaw.split(',').map(r => r.trim()).filter(Boolean) : [];

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
