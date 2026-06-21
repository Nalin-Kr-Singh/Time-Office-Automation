/* ══════════════════════════════════════════
   TIME OFFICE AUTOMATION — app.js
   Shared logic: helpers, auth, nav, storage,
   shifts, attendance, payroll, export
══════════════════════════════════════════ */

// ── HELPERS ──────────────────────────────
const get = id => document.getElementById(id);

const ls = {
  get:    k => JSON.parse(localStorage.getItem(k) || '[]'),
  set:    (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  getObj: k => JSON.parse(localStorage.getItem(k) || '{}'),
  setObj: (k, v) => localStorage.setItem(k, JSON.stringify(v))
};

function toast(msg, color = '#0f1923') {
  const t = get('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.background = color;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// ── TOPBAR / NAV (shared across pages) ───
function setActiveNav() {
  const path = window.location.pathname.split('/').pop();
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.getAttribute('href') === path) tab.classList.add('active');
  });
}

function loadTopbar() {
  const profile = ls.getObj('profile');
  const el = get('topbarUser');
  if (el) el.textContent = (profile.admin || 'Admin') + ' · ' + (profile.org || 'Time Office');
}

// ── AUTH ──────────────────────────────────
function getPin() { return localStorage.getItem('adminPin') || '1234'; }

function checkAuth() {
  // Redirect to login if not authenticated
  if (!sessionStorage.getItem('authenticated')) {
    window.location.href = 'index.html';
  }
}

function logout() {
  sessionStorage.removeItem('authenticated');
  window.location.href = 'index.html';
}

// ── LOGIN / PIN (index.html only) ────────
let pinBuffer = '';

function pinPress(digit) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += digit;
  updatePinDots();
  if (pinBuffer.length === 4) setTimeout(checkPin, 200);
}

function pinClear() {
  pinBuffer = pinBuffer.slice(0, -1);
  updatePinDots();
  const err = get('loginError');
  if (err) err.textContent = '';
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = get('d' + i);
    if (dot) dot.classList.toggle('filled', i < pinBuffer.length);
  }
}

function checkPin() {
  if (pinBuffer === getPin()) {
    sessionStorage.setItem('authenticated', 'true');
    window.location.href = 'dashboard.html';
  } else {
    const err = get('loginError');
    if (err) err.textContent = '✗ Incorrect PIN. Try again.';
    pinBuffer = '';
    updatePinDots();
    const card = document.querySelector('.login-card');
    if (card) {
      card.style.animation = 'none';
      card.offsetHeight;
      card.style.animation = 'shake 0.4s';
    }
  }
}

// ── SETTINGS ─────────────────────────────
function changePin() {
  const old = get('oldPin').value;
  const n   = get('newPin').value;
  const c   = get('confirmPin').value;
  const msg = get('pinMsg');
  if (old !== getPin())               { msg.style.color = 'red';   msg.textContent = '✗ Current PIN is wrong.';   return; }
  if (n.length !== 4 || !/^\d{4}$/.test(n)) { msg.style.color = 'red'; msg.textContent = '✗ PIN must be 4 digits.'; return; }
  if (n !== c)                        { msg.style.color = 'red';   msg.textContent = '✗ PINs do not match.';      return; }
  localStorage.setItem('adminPin', n);
  msg.style.color = 'green';
  msg.textContent = '✓ PIN updated successfully!';
  get('oldPin').value = ''; get('newPin').value = ''; get('confirmPin').value = '';
}

function saveProfile() {
  ls.setObj('profile', { admin: get('adminName').value, org: get('orgName').value });
  loadTopbar();
  toast('✓ Profile saved');
}

function clearData(type) {
  if (!confirm('Are you sure? This cannot be undone.')) return;
  if (type === 'all') {
    ls.set('shifts', []); ls.set('attendance', []); ls.set('payroll', []);
  } else {
    ls.set(type, []);
  }
  toast('✓ Data cleared');
}

// ── CSV EXPORT ────────────────────────────
function exportCSV(type) {
  const data = ls.get(type);
  if (!data.length) { toast('No data to export', '#e74c3c'); return; }

  const headers = {
    shifts:     ['Name', 'Department', 'Shift', 'Date'],
    attendance: ['Name', 'Date', 'Time', 'Status'],
    payroll:    ['Name', 'Base Salary', 'Days Worked', 'Total Days', 'OT Hours', 'Deductions', 'Net Pay']
  };
  const rows = {
    shifts:     data.map(r => [r.name, r.dept, r.type, r.date]),
    attendance: data.map(r => [r.name, r.date, r.time || '-', r.status]),
    payroll:    data.map(r => [r.name, r.base, r.worked, r.total, r.ot || 0, r.ded || 0, r.net])
  };

  const csv  = [headers[type], ...rows[type]].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `time-office-${type}-${today()}.csv`;
  a.click();
  toast('✓ Exported ' + type + '.csv');
}

// ── SHIFTS ────────────────────────────────
const SHIFT_SUGGESTIONS = {
  Morning:   'Best for early risers. Ideal for Production & Quality.',
  Afternoon: 'Peak hours coverage. Good for Admin & HR.',
  Night:     'Security & Maintenance recommended.'
};

function addShift() {
  const name = get('sEmp').value.trim();
  const dept = get('sDept').value;
  const type = get('sType').value;
  const date = get('sDate').value;
  if (!name || !date) { toast('⚠ Fill in employee name and date', '#e74c3c'); return; }

  const shifts = ls.get('shifts');
  shifts.push({ id: Date.now(), name, dept, type, date });
  ls.set('shifts', shifts);

  get('sEmp').value = ''; get('sDate').value = '';
  renderShifts();
  toast('✓ Shift assigned to ' + name);
}

function deleteShift(id) {
  ls.set('shifts', ls.get('shifts').filter(s => s.id !== id));
  renderShifts();
  toast('Shift removed', '#666');
}

function renderShifts() {
  const q    = (get('shiftSearch')?.value || '').toLowerCase();
  const data = ls.get('shifts').filter(s => !q || s.name.toLowerCase().includes(q));
  const body = get('shiftBody');
  if (!body) return;

  if (!data.length) {
    body.innerHTML = `<tr><td colspan="7" class="empty-msg">No shifts assigned yet. Add one above.</td></tr>`;
    return;
  }

  const shiftColor = { Morning: 'badge-blue', Afternoon: 'badge-orange', Night: 'badge-green' };
  body.innerHTML = data.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${s.name}</strong></td>
      <td>${s.dept || '-'}</td>
      <td><span class="badge ${shiftColor[s.type] || 'badge-blue'}">${s.type}</span></td>
      <td>${s.date}</td>
      <td style="font-size:0.78rem;color:#888">${SHIFT_SUGGESTIONS[s.type] || ''}</td>
      <td><button class="btn-danger" onclick="deleteShift(${s.id})">Delete</button></td>
    </tr>`).join('');
}

// ── ATTENDANCE ────────────────────────────
function addAttendance() {
  const name   = get('aEmp').value.trim();
  const date   = get('aDate').value;
  const status = get('aStatus').value;
  const time   = get('aTime').value;
  if (!name || !date) { toast('⚠ Fill in employee name and date', '#e74c3c'); return; }

  const records = ls.get('attendance');
  records.push({ id: Date.now(), name, date, status, time });
  ls.set('attendance', records);

  get('aEmp').value = ''; get('aDate').value = ''; get('aTime').value = '';
  checkAnomalies(records, name);
  renderAttendance();
  toast('✓ Attendance logged for ' + name);
}

function deleteAttendance(id) {
  ls.set('attendance', ls.get('attendance').filter(r => r.id !== id));
  renderAttendance();
  toast('Record removed', '#666');
}

function checkAnomalies(records, emp) {
  const empRec  = records.filter(r => r.name === emp);
  const absences = empRec.filter(r => r.status === 'Absent').length;
  const lates    = empRec.filter(r => r.status === 'Late').length;
  const box      = get('anomalyAlert');
  if (!box) return;

  if (absences >= 3) {
    box.style.display = 'block';
    box.innerHTML = `⚠️ <strong>Anomaly Detected:</strong> ${emp} has <strong>${absences} absences</strong>. Review recommended.`;
  } else if (lates >= 3) {
    box.style.display = 'block';
    box.innerHTML = `⚠️ <strong>Anomaly Detected:</strong> ${emp} has been <strong>late ${lates} times</strong>. Warning advised.`;
  } else {
    box.style.display = 'none';
  }
}

function renderAttendance() {
  const q      = (get('attSearch')?.value || '').toLowerCase();
  const filter = get('attFilter')?.value || '';
  const data   = ls.get('attendance').filter(r =>
    (!q || r.name.toLowerCase().includes(q)) &&
    (!filter || r.status === filter)
  );
  const body = get('attBody');
  if (!body) return;

  if (!data.length) {
    body.innerHTML = `<tr><td colspan="7" class="empty-msg">No attendance records. Log one above.</td></tr>`;
    return;
  }

  const statusBadge = { Present: 'badge-green', Absent: 'badge-red', Late: 'badge-orange', 'Half Day': 'badge-blue' };
  const flagMap     = { Present: '✅', Absent: '🚩', Late: '⏰', 'Half Day': '🌗' };

  body.innerHTML = data.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${r.name}</strong></td>
      <td>${r.date}</td>
      <td>${r.time || '-'}</td>
      <td><span class="badge ${statusBadge[r.status] || 'badge-blue'}">${r.status}</span></td>
      <td class="flag-cell">${flagMap[r.status] || '-'}</td>
      <td><button class="btn-danger" onclick="deleteAttendance(${r.id})">Delete</button></td>
    </tr>`).join('');
}

// ── PAYROLL ───────────────────────────────
function calculatePayroll() {
  const name   = get('pEmp').value.trim();
  const base   = parseFloat(get('pBase').value)   || 0;
  const worked = parseInt(get('pWorked').value)    || 0;
  const total  = parseInt(get('pTotal').value)     || 26;
  const ot     = parseFloat(get('pOT').value)      || 0;
  const ded    = parseFloat(get('pDed').value)     || 0;

  if (!name || !base) { toast('⚠ Fill employee name and base salary', '#e74c3c'); return; }

  const basicPay = (base / total) * worked;
  const otPay    = (base / total / 8) * 1.5 * ot;
  const net      = Math.max(0, basicPay + otPay - ded);

  // Show result card
  const res = get('payResult');
  if (res) {
    res.style.display = 'block';
    get('payNetDisplay').textContent  = '₹' + net.toFixed(2);
    get('payBasicDisp').textContent   = '₹' + basicPay.toFixed(2);
    get('payOTDisp').textContent      = '₹' + otPay.toFixed(2);
    get('payDedDisp').textContent     = '₹' + ded.toFixed(2);
  }

  const payrolls = ls.get('payroll');
  payrolls.push({ id: Date.now(), name, base, worked, total, ot, ded, net: net.toFixed(2) });
  ls.set('payroll', payrolls);

  get('pEmp').value = ''; get('pBase').value = ''; get('pWorked').value = '';
  get('pTotal').value = ''; get('pOT').value = ''; get('pDed').value = '';

  renderPayroll();
  toast('✓ Payroll calculated for ' + name);
}

function deletePayroll(id) {
  ls.set('payroll', ls.get('payroll').filter(p => p.id !== id));
  renderPayroll();
  toast('Record removed', '#666');
}

function renderPayroll() {
  const q    = (get('paySearch')?.value || '').toLowerCase();
  const data = ls.get('payroll').filter(p => !q || p.name.toLowerCase().includes(q));
  const body = get('payBody');
  if (!body) return;

  if (!data.length) {
    body.innerHTML = `<tr><td colspan="8" class="empty-msg">No payroll records. Calculate one above.</td></tr>`;
    return;
  }

  body.innerHTML = data.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${p.name}</strong></td>
      <td>₹${p.base.toLocaleString()}</td>
      <td>${p.worked}/${p.total}</td>
      <td>${p.ot || 0} hrs</td>
      <td>₹${p.ded || 0}</td>
      <td><strong style="color:var(--success)">₹${parseFloat(p.net).toLocaleString()}</strong></td>
      <td><button class="btn-danger" onclick="deletePayroll(${p.id})">Delete</button></td>
    </tr>`).join('');
}

// ── INIT (runs on every page) ─────────────
window.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  loadTopbar();

  // Pre-fill today's date on forms that have these fields
  const d = today();
  ['sDate', 'aDate'].forEach(id => { const el = get(id); if (el) el.value = d; });

  // Render tables if on the relevant page
  if (get('shiftBody'))  renderShifts();
  if (get('attBody'))    renderAttendance();
  if (get('payBody'))    renderPayroll();

  // Load profile fields if on settings page
  const adminNameEl = get('adminName');
  const orgNameEl   = get('orgName');
  if (adminNameEl || orgNameEl) {
    const p = ls.getObj('profile');
    if (adminNameEl && p.admin) adminNameEl.value = p.admin;
    if (orgNameEl   && p.org)   orgNameEl.value   = p.org;
  }
});
