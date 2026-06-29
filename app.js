

const get = id => document.getElementById(id);
const ls = {
  get:    k => JSON.parse(localStorage.getItem(k) || '[]'),
  set:    (k,v) => localStorage.setItem(k, JSON.stringify(v)),
  getObj: k => JSON.parse(localStorage.getItem(k) || '{}'),
  setObj: (k,v) => localStorage.setItem(k, JSON.stringify(v))
};

function toast(msg, color='#0f1923'){
  const t = get('toast'); if(!t) return;
  t.textContent = msg; t.style.background = color;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2800);
}

function todayStr(){
  return new Date().toISOString().split('T')[0];
}

function nowStr(){
  return new Date().toTimeString().slice(0,5); // HH:MM
}

function fmtTime(hhmm){
  if(!hhmm) return '-';
  const [h,m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${((h%12)||12)}:${String(m).padStart(2,'0')} ${ampm}`;
}

function minutesBetween(t1, t2){
  // t1, t2 = "HH:MM"
  if(!t1||!t2) return 0;
  const [h1,m1]=t1.split(':').map(Number);
  const [h2,m2]=t2.split(':').map(Number);
  let diff = (h2*60+m2)-(h1*60+m1);
  if(diff < 0) diff += 24*60; // crossed midnight
  return diff;
}

function fmtDuration(mins){
  if(!mins||mins<=0) return '0h 0m';
  return `${Math.floor(mins/60)}h ${mins%60}m`;
}

function initials(name){
  return name.trim().split(' ').map(w=>w[0]||'').join('').toUpperCase().slice(0,2);
}

// ── SHIFT SCHEDULES ───────────────────────────────────────
const SHIFTS = {
  Morning:   { label:'🌅 Morning',   start:'06:00', end:'14:00', hours:8 },
  Afternoon: { label:'☀️ Afternoon', start:'14:00', end:'22:00', hours:8 },
  Night:     { label:'🌙 Night',     start:'22:00', end:'06:00', hours:8 },
  Custom:    { label:'🔧 Custom',    start:'',       end:'',      hours:8 }
};

// ── AUTH ──────────────────────────────────────────────────
function getPin(){ return localStorage.getItem('adminPin')||'1234'; }

function checkAuth(){
  if(!sessionStorage.getItem('auth')) window.location.href='index.html';
}

function logout(){
  sessionStorage.removeItem('auth');
  window.location.href='index.html';
}

// ── NAV ───────────────────────────────────────────────────
function setActiveNav(){
  const page = window.location.pathname.split('/').pop();
  document.querySelectorAll('.nav-tab').forEach(t=>{
    t.classList.toggle('active', t.getAttribute('href')===page);
  });
}

function loadTopbar(){
  const p = ls.getObj('profile');
  const el = get('topbarUser');
  if(el) el.textContent = (p.admin||'Admin')+' · '+(p.org||'Time Office');
}

// ── LOGIN PIN ─────────────────────────────────────────────
let _pin = '';

function pinPress(d){
  if(_pin.length>=4) return;
  _pin += d;
  updateDots();
  if(_pin.length===4) setTimeout(checkPin,200);
}

function pinClear(){
  _pin = _pin.slice(0,-1);
  updateDots();
  const e=get('pinErr'); if(e) e.textContent='';
}

function updateDots(){
  for(let i=0;i<4;i++){
    const d=get('d'+i); if(d) d.classList.toggle('on', i<_pin.length);
  }
}

function checkPin(){
  if(_pin===getPin()){
    sessionStorage.setItem('auth','1');
    window.location.href='dashboard.html';
  } else {
    const e=get('pinErr'); if(e) e.textContent='✗ Wrong PIN, try again.';
    _pin=''; updateDots();
    const c=document.querySelector('.login-card');
    if(c){c.style.animation='none';c.offsetHeight;c.style.animation='shake .4s';}
  }
}

// ── AUTOCOMPLETE EMPLOYEE SEARCH ──────────────────────────
function setupSearch(inputId, dropId, onSelect){
  const inp = get(inputId);
  const drop = get(dropId);
  if(!inp||!drop) return;

  inp.addEventListener('input', ()=>{
    const q = inp.value.trim().toLowerCase();
    if(!q){ drop.style.display='none'; return; }
    const emps = ls.get('employees');
    const filtered = emps.filter(e=>
      e.name.toLowerCase().includes(q)||
      e.empId.toLowerCase().includes(q)||
      e.dept.toLowerCase().includes(q)
    );
    if(!filtered.length){ drop.style.display='none'; return; }
    drop.innerHTML = filtered.map(e=>`
      <div class="ac-item" data-id="${e.id}" onclick="selectEmp('${inputId}','${dropId}',${e.id})">
        <strong>${e.name}</strong> <span style="color:#888;font-size:.78rem">#${e.empId}</span>
        <div class="ac-dept">${e.dept} · ${e.designation||'—'}</div>
      </div>`).join('');
    drop.style.display='block';
  });

  document.addEventListener('click', ev=>{
    if(!inp.contains(ev.target)&&!drop.contains(ev.target))
      drop.style.display='none';
  });
}

function selectEmp(inputId, dropId, id){
  const e = ls.get('employees').find(x=>x.id===id);
  if(!e) return;
  const inp = get(inputId); if(inp) inp.value=e.name;
  const drop = get(dropId); if(drop) drop.style.display='none';
  if(window.onEmpSelected) window.onEmpSelected(e);
}

// ── EMPLOYEES ─────────────────────────────────────────────
function getEmployees(){ return ls.get('employees'); }

function saveEmployee(data){
  const list = ls.get('employees');
  const idx  = list.findIndex(e=>e.id===data.id);
  if(idx>=0) list[idx]=data; else list.push(data);
  ls.set('employees', list);
}

function deleteEmployee(id){
  if(!confirm('Delete this employee? All related data will remain.')) return;
  ls.set('employees', ls.get('employees').filter(e=>e.id!==id));
  renderEmployees();
  toast('Employee removed','#666');
}

function renderEmployees(){
  const q  = (get('empSearch')?.value||'').toLowerCase();
  const df = get('deptFilter')?.value||'';
  const data = ls.get('employees').filter(e=>
    (!q||e.name.toLowerCase().includes(q)||e.empId.toLowerCase().includes(q))&&
    (!df||e.dept===df)
  );
  const body = get('empBody'); if(!body) return;
  if(!data.length){
    body.innerHTML=`<tr><td colspan="8" class="empty-msg">No employees enrolled. Add one above.</td></tr>`; return;
  }
  body.innerHTML = data.map((e,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><strong>${e.name}</strong><br><span style="font-size:.74rem;color:#888">#${e.empId}</span></td>
      <td>${e.dept}</td>
      <td>${e.designation||'—'}</td>
      <td>${e.shift||'—'}</td>
      <td>₹${Number(e.baseSalary||0).toLocaleString()}</td>
      <td>${e.phone||'—'}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-blue btn-sm" onclick="openEditModal(${e.id})">Edit</button>
        <button class="btn-danger" onclick="deleteEmployee(${e.id})">Delete</button>
      </td>
    </tr>`).join('');
}

function openEditModal(id){
  const e = ls.get('employees').find(x=>x.id===id);
  if(!e) return;
  get('mEmpId').value    = e.id;
  get('mName').value     = e.name;
  get('mEmpNo').value    = e.empId;
  get('mDept').value     = e.dept;
  get('mDesig').value    = e.designation||'';
  get('mShift').value    = e.shift||'Morning';
  get('mSalary').value   = e.baseSalary||'';
  get('mPhone').value    = e.phone||'';
  get('mEmail').value    = e.email||'';
  get('mJoin').value     = e.joinDate||'';
  get('editModal').classList.add('open');
}

function closeEditModal(){
  get('editModal').classList.remove('open');
}

function saveEditModal(){
  const id = parseInt(get('mEmpId').value);
  const emps = ls.get('employees');
  const idx  = emps.findIndex(e=>e.id===id);
  if(idx<0) return;
  emps[idx] = {
    ...emps[idx],
    name:       get('mName').value.trim(),
    empId:      get('mEmpNo').value.trim(),
    dept:       get('mDept').value,
    designation:get('mDesig').value.trim(),
    shift:      get('mShift').value,
    baseSalary: parseFloat(get('mSalary').value)||0,
    phone:      get('mPhone').value.trim(),
    email:      get('mEmail').value.trim(),
    joinDate:   get('mJoin').value
  };
  ls.set('employees', emps);
  closeEditModal();
  renderEmployees();
  toast('✓ Employee updated');
}

// ── ATTENDANCE — AUTO CHECK-IN/OUT ────────────────────────
function getAttendance(){ return ls.get('attendance'); }

function getTodayRecord(empId){
  return ls.get('attendance').find(r=>r.empId===empId && r.date===todayStr());
}

function renderEmpAttCard(emp){
  const card = get('empAttCard'); if(!card) return;
  card.style.display='block';
  get('attAvatar').textContent = initials(emp.name);
  get('attEmpName').textContent = emp.name;
  get('attEmpMeta').textContent = `#${emp.empId} · ${emp.dept} · ${emp.designation||'—'} · Shift: ${emp.shift||'—'}`;

  const shift = SHIFTS[emp.shift]||SHIFTS.Morning;
  get('attShiftInfo').textContent = `${shift.label}  ${fmtTime(shift.start)} – ${fmtTime(shift.end)}`;

  const rec = getTodayRecord(emp.empId);
  const btn  = get('checkinBtn');

  if(rec && rec.checkOut){
    // Already checked out
    btn.textContent = '✓ Done for today';
    btn.className   = 'checkin-btn';
    btn.style.background = '#888';
    btn.disabled = true;
    renderTodayLog(rec);
  } else if(rec && rec.checkIn){
    // Checked in, not out
    btn.innerHTML = '🔴 Check Out';
    btn.className = 'checkin-btn out';
    btn.disabled  = false;
    btn.onclick   = ()=>doCheckOut(emp);
    renderTodayLog(rec);
  } else {
    // Not checked in
    btn.innerHTML = '🟢 Check In';
    btn.className = 'checkin-btn';
    btn.style.background = '';
    btn.disabled  = false;
    btn.onclick   = ()=>doCheckIn(emp);
    get('todayLogWrap').innerHTML='';
  }
}

function doCheckIn(emp){
  const now   = nowStr();
  const today = todayStr();
  const shift = SHIFTS[emp.shift]||SHIFTS.Morning;
  const late  = minutesBetween(shift.start, now) > 10; // >10 min late
  const rec   = {
    id:       Date.now(),
    empId:    emp.empId,
    empName:  emp.name,
    dept:     emp.dept,
    date:     today,
    shift:    emp.shift||'Morning',
    shiftStart: shift.start,
    shiftEnd:   shift.end,
    checkIn:  now,
    checkOut: null,
    workedMins: 0,
    otMins:   0,
    status:   late ? 'Late' : 'Present'
  };
  const att = ls.get('attendance');
  att.push(rec);
  ls.set('attendance', att);
  renderEmpAttCard(emp);
  toast(`✓ ${emp.name} checked in at ${fmtTime(now)}`+(late?' — Marked Late':''), late?'#f39c12':'#1a9e6e');
}

function doCheckOut(emp){
  const att = ls.get('attendance');
  const idx = att.findIndex(r=>r.empId===emp.empId && r.date===todayStr());
  if(idx<0) return;
  const now   = nowStr();
  const rec   = att[idx];
  const shift = SHIFTS[rec.shift]||SHIFTS.Morning;

  const workedMins = minutesBetween(rec.checkIn, now);
  const scheduledMins = shift.hours * 60;
  const otMins = Math.max(0, workedMins - scheduledMins);

  att[idx] = { ...rec, checkOut: now, workedMins, otMins,
    status: rec.status==='Late' ? 'Late' : 'Present' };
  ls.set('attendance', att);
  renderEmpAttCard(emp);
  toast(`✓ ${emp.name} checked out · Worked: ${fmtDuration(workedMins)}${otMins>0?' · OT: '+fmtDuration(otMins):''}`, '#1a9e6e');
}

function renderTodayLog(rec){
  const wrap = get('todayLogWrap'); if(!wrap) return;
  const ot = rec.otMins>0?`<span class="badge b-purple">${fmtDuration(rec.otMins)} OT</span>`:'';
  wrap.innerHTML = `
    <div class="today-log" style="margin-top:12px">
      <div style="font-size:.78rem;font-weight:600;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Today's Log</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:.83rem">
        <div>Check-in: <strong>${fmtTime(rec.checkIn)}</strong></div>
        <div>Check-out: <strong>${rec.checkOut?fmtTime(rec.checkOut):'—'}</strong></div>
        <div>Worked: <strong>${fmtDuration(rec.workedMins)}</strong></div>
        <div>${ot}</div>
        <div><span class="badge ${rec.status==='Late'?'b-orange':'b-green'}">${rec.status}</span></div>
      </div>
    </div>`;
}

function renderAttTable(){
  const q  = (get('attSearch2')?.value||'').toLowerCase();
  const df = get('attFilter')?.value||'';
  const dt = get('attDateFilter')?.value||'';
  const data = ls.get('attendance').filter(r=>
    (!q||r.empName?.toLowerCase().includes(q))&&
    (!df||r.status===df)&&
    (!dt||r.date===dt)
  ).reverse();

  const body = get('attTableBody'); if(!body) return;
  if(!data.length){
    body.innerHTML=`<tr><td colspan="9" class="empty-msg">No records found.</td></tr>`; return;
  }
  body.innerHTML = data.map((r,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><strong>${r.empName}</strong><br><span style="font-size:.73rem;color:#888">#${r.empId}</span></td>
      <td>${r.date}</td>
      <td>${r.dept||'—'}</td>
      <td>${r.shift||'—'}</td>
      <td>${fmtTime(r.checkIn)}</td>
      <td>${r.checkOut?fmtTime(r.checkOut):'—'}</td>
      <td>${fmtDuration(r.workedMins)}${r.otMins>0?` <span class="badge b-purple">${fmtDuration(r.otMins)} OT</span>`:''}</td>
      <td><span class="badge ${r.status==='Present'?'b-green':r.status==='Late'?'b-orange':'b-red'}">${r.status}</span></td>
    </tr>`).join('');
}

// ── SHIFTS ────────────────────────────────────────────────
function renderEmpShiftCard(emp){
  const card = get('empShiftCard'); if(!card) return;
  card.style.display='block';
  get('shiftAvatar').textContent  = initials(emp.name);
  get('shiftEmpName').textContent = emp.name;
  get('shiftEmpMeta').textContent = `#${emp.empId} · ${emp.dept} · ${emp.designation||'—'}`;
  get('shiftSelect').value = emp.shift||'Morning';
  updateShiftPreview(emp.shift||'Morning');
  get('saveShiftBtn').onclick = ()=>saveEmpShift(emp);
}

function updateShiftPreview(shiftKey){
  const s = SHIFTS[shiftKey]||SHIFTS.Morning;
  const p = get('shiftPreview'); if(!p) return;
  p.style.display='block';
  p.innerHTML=`
    <div class="shift-row"><span>Shift</span><span>${s.label}</span></div>
    <div class="shift-row"><span>Start</span><span>${fmtTime(s.start)}</span></div>
    <div class="shift-row"><span>End</span><span>${fmtTime(s.end)}</span></div>
    <div class="shift-row"><span>Scheduled hours</span><span>${s.hours}h</span></div>`;
}

function saveEmpShift(emp){
  const newShift = get('shiftSelect').value;
  const emps = ls.get('employees');
  const idx  = emps.findIndex(e=>e.id===emp.id);
  if(idx<0) return;
  emps[idx].shift = newShift;
  ls.set('employees', emps);
  toast(`✓ ${emp.name}'s shift updated to ${newShift}`,'#1a9e6e');
}

function renderShiftSummary(){
  const body = get('shiftTableBody'); if(!body) return;
  const emps = ls.get('employees');
  const att  = ls.get('attendance');
  const today = todayStr();

  if(!emps.length){
    body.innerHTML=`<tr><td colspan="7" class="empty-msg">No employees enrolled yet.</td></tr>`; return;
  }

  body.innerHTML = emps.map((e,i)=>{
    const todayRec = att.find(r=>r.empId===e.empId && r.date===today);
    const monthRecs = att.filter(r=>r.empId===e.empId && r.date.startsWith(today.slice(0,7)));
    const totalOT   = monthRecs.reduce((s,r)=>s+(r.otMins||0),0);
    const shift = SHIFTS[e.shift]||SHIFTS.Morning;
    return `<tr>
      <td>${i+1}</td>
      <td><strong>${e.name}</strong><br><span style="font-size:.73rem;color:#888">#${e.empId}</span></td>
      <td>${e.dept}</td>
      <td><span class="badge b-blue">${e.shift||'Morning'}</span><br><span style="font-size:.72rem;color:#888">${fmtTime(shift.start)}–${fmtTime(shift.end)}</span></td>
      <td>${todayRec ? fmtTime(todayRec.checkIn)+' → '+(todayRec.checkOut?fmtTime(todayRec.checkOut):'active') : '—'}</td>
      <td>${todayRec ? fmtDuration(todayRec.workedMins) : '—'}</td>
      <td>${totalOT>0?`<span class="badge b-purple">${fmtDuration(totalOT)}</span>`:'—'}</td>
    </tr>`;
  }).join('');
}

// ── PAYROLL AUTO-CALCULATE ────────────────────────────────
function calcPayroll(emp, month){
  // month = "YYYY-MM"
  const att = ls.get('attendance').filter(r=>r.empId===emp.empId && r.date.startsWith(month));
  const base = parseFloat(emp.baseSalary)||0;

  // Working days in month
  const year = parseInt(month.split('-')[0]);
  const mo   = parseInt(month.split('-')[1]);
  const totalDaysInMonth = new Date(year, mo, 0).getDate();

  // Count days
  const presentDays = att.filter(r=>r.status==='Present'||r.status==='Late').length;
  const absentDays  = att.filter(r=>r.status==='Absent').length;
  const lateDays    = att.filter(r=>r.status==='Late').length;
  const totalWorkedMins = att.reduce((s,r)=>s+(r.workedMins||0),0);
  const totalOTMins     = att.reduce((s,r)=>s+(r.otMins||0),0);

  // Assume 26 working days per month (standard India)
  const workingDays = 26;
  const perDay      = base / workingDays;
  const basicPay    = perDay * presentDays;
  const otHours     = totalOTMins / 60;
  const otRate      = (base / workingDays / 8) * 1.5; // 1.5x overtime
  const otPay       = otRate * otHours;
  const lateDeduct  = lateDays > 3 ? perDay * 0.5 * Math.max(0, lateDays-3) : 0; // deduct half-day for >3 lates
  const absentDeduct= perDay * absentDays;
  const grossPay    = basicPay + otPay;
  const totalDeduct = lateDeduct + absentDeduct;
  const netPay      = Math.max(0, grossPay - totalDeduct);

  return {
    empId: emp.empId, empName: emp.name, dept: emp.dept,
    month, base, workingDays, presentDays, absentDays, lateDays,
    totalWorkedHrs: (totalWorkedMins/60).toFixed(1),
    otHrs: otHours.toFixed(1),
    basicPay:     basicPay.toFixed(2),
    otPay:        otPay.toFixed(2),
    grossPay:     grossPay.toFixed(2),
    lateDeduct:   lateDeduct.toFixed(2),
    absentDeduct: absentDeduct.toFixed(2),
    totalDeduct:  totalDeduct.toFixed(2),
    netPay:       netPay.toFixed(2)
  };
}

function renderPayrollPage(){
  const month = get('payMonth')?.value || todayStr().slice(0,7);
  const q     = (get('paySearch')?.value||'').toLowerCase();
  const emps  = ls.get('employees').filter(e=>
    !q||e.name.toLowerCase().includes(q)||e.empId.toLowerCase().includes(q)
  );
  const body  = get('payTableBody'); if(!body) return;

  if(!emps.length){
    body.innerHTML=`<tr><td colspan="11" class="empty-msg">No employees enrolled.</td></tr>`; return;
  }

  let totalNet=0, totalOT=0;
  const rows = emps.map((e,i)=>{
    const p = calcPayroll(e, month);
    totalNet += parseFloat(p.netPay);
    totalOT  += parseFloat(p.otHrs);
    return `<tr>
      <td>${i+1}</td>
      <td><strong>${e.name}</strong><br><span style="font-size:.73rem;color:#888">#${e.empId}</span></td>
      <td>${e.dept}</td>
      <td>${p.presentDays}/${p.workingDays}</td>
      <td>${p.absentDays}</td>
      <td>${p.otHrs}h</td>
      <td>₹${Number(p.basicPay).toLocaleString()}</td>
      <td>₹${Number(p.otPay).toLocaleString()}</td>
      <td><span style="color:var(--red)">-₹${Number(p.totalDeduct).toLocaleString()}</span></td>
      <td><strong style="color:var(--green)">₹${Number(p.netPay).toLocaleString()}</strong></td>
      <td>
        <button class="btn btn-blue btn-sm" onclick="showPaySlip('${e.empId}','${month}')">Slip</button>
        <button class="btn btn-export btn-sm" onclick="exportSlipCSV('${e.empId}','${month}')">CSV</button>
      </td>
    </tr>`;
  });

  body.innerHTML = rows.join('') + `
    <tr style="background:#f0f4f8;font-weight:700">
      <td colspan="3">TOTALS</td>
      <td colspan="5"></td>
      <td>OT: ${totalOT.toFixed(1)}h</td>
      <td>₹${totalNet.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
      <td></td>
    </tr>`;
}

function showPaySlip(empId, month){
  const emp = ls.get('employees').find(e=>e.empId===empId);
  if(!emp) return;
  const p = calcPayroll(emp, month);
  const slip = get('paySlipModal'); if(!slip) return;
  get('slipContent').innerHTML = `
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:1.1rem;font-weight:800">${ls.getObj('profile').org||'Time Office'}</div>
      <div style="font-size:.82rem;color:#888">Pay Slip — ${month}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.83rem;margin-bottom:14px">
      <div><strong>Name:</strong> ${p.empName}</div>
      <div><strong>ID:</strong> #${p.empId}</div>
      <div><strong>Dept:</strong> ${p.dept}</div>
      <div><strong>Month:</strong> ${month}</div>
    </div>
    <table style="width:100%;font-size:.83rem;border-collapse:collapse;margin-bottom:14px">
      <tr style="background:#f0f4f8"><th style="padding:6px 10px;text-align:left">Description</th><th style="padding:6px 10px;text-align:right">Amount</th></tr>
      <tr><td style="padding:6px 10px">Basic Pay (${p.presentDays} days)</td><td style="padding:6px 10px;text-align:right">₹${Number(p.basicPay).toLocaleString()}</td></tr>
      <tr><td style="padding:6px 10px">Overtime (${p.otHrs}h @ 1.5×)</td><td style="padding:6px 10px;text-align:right">₹${Number(p.otPay).toLocaleString()}</td></tr>
      <tr style="background:#fff8e1"><td style="padding:6px 10px">Absent Deduction (${p.absentDays} days)</td><td style="padding:6px 10px;text-align:right;color:var(--red)">-₹${Number(p.absentDeduct).toLocaleString()}</td></tr>
      <tr style="background:#fff8e1"><td style="padding:6px 10px">Late Deduction</td><td style="padding:6px 10px;text-align:right;color:var(--red)">-₹${Number(p.lateDeduct).toLocaleString()}</td></tr>
      <tr style="background:#0f1923;color:#f0a500;font-weight:800"><td style="padding:8px 10px">NET PAY</td><td style="padding:8px 10px;text-align:right">₹${Number(p.netPay).toLocaleString()}</td></tr>
    </table>
    <div style="font-size:.74rem;color:#aaa;text-align:center">Generated on ${new Date().toLocaleDateString('en-IN')}</div>`;
  slip.classList.add('open');
}

function closePaySlip(){ get('paySlipModal')?.classList.remove('open'); }

function exportSlipCSV(empId, month){
  const emp = ls.get('employees').find(e=>e.empId===empId);
  if(!emp) return;
  const p = calcPayroll(emp, month);
  const rows=[
    ['Field','Value'],
    ['Name',p.empName],['ID','#'+p.empId],['Dept',p.dept],['Month',month],
    ['Days Present',p.presentDays],['Days Absent',p.absentDays],['Late Days',p.lateDays],
    ['OT Hours',p.otHrs],['Basic Pay','₹'+p.basicPay],['OT Pay','₹'+p.otPay],
    ['Deductions','-₹'+p.totalDeduct],['Net Pay','₹'+p.netPay]
  ];
  const csv=rows.map(r=>r.join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download=`payslip-${empId}-${month}.csv`;
  a.click();
  toast('✓ Pay slip exported');
}

function exportAllPayroll(){
  const month = get('payMonth')?.value || todayStr().slice(0,7);
  const emps  = ls.get('employees');
  const rows  = [['Name','ID','Dept','Days Present','Absent','OT Hrs','Basic Pay','OT Pay','Deductions','Net Pay']];
  emps.forEach(e=>{
    const p=calcPayroll(e,month);
    rows.push([p.empName,'#'+p.empId,p.dept,p.presentDays,p.absentDays,p.otHrs,p.basicPay,p.otPay,p.totalDeduct,p.netPay]);
  });
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'}));
  a.download=`payroll-${month}.csv`;
  a.click();
  toast('✓ Payroll exported');
}

// ── EXPORT ATTENDANCE CSV ─────────────────────────────────
function exportAttCSV(){
  const data = ls.get('attendance');
  if(!data.length){ toast('No data to export','#dc3545'); return; }
  const rows=[['Name','ID','Dept','Date','Shift','Check-in','Check-out','Worked','OT','Status']];
  data.forEach(r=>rows.push([r.empName,r.empId,r.dept||'',r.date,r.shift||'',fmtTime(r.checkIn),r.checkOut?fmtTime(r.checkOut):'',fmtDuration(r.workedMins),fmtDuration(r.otMins),r.status]));
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'}));
  a.download=`attendance-${todayStr()}.csv`;
  a.click();
  toast('✓ Attendance exported');
}

// ── DASHBOARD ─────────────────────────────────────────────
function refreshDashboard(){
  const emps = ls.get('employees');
  const att  = ls.get('attendance');
  const today = todayStr();

  const todayRecs = att.filter(r=>r.date===today);
  const present = todayRecs.filter(r=>r.status==='Present'||r.status==='Late').length;
  const absent  = emps.length - present;
  const anomEmps= new Set(emps.map(e=>{
    const recs=att.filter(r=>r.empId===e.empId);
    const abs=recs.filter(r=>r.status==='Absent').length;
    const late=recs.filter(r=>r.status==='Late').length;
    return (abs>=3||late>=3)?e.empId:null;
  }).filter(Boolean));

  const v=id=>get(id);
  if(v('dsTotalEmp'))  v('dsTotalEmp').textContent  = emps.length;
  if(v('dsPresentToday')) v('dsPresentToday').textContent = present;
  if(v('dsAbsent'))    v('dsAbsent').textContent    = Math.max(0,absent);
  if(v('dsAnomalies')) v('dsAnomalies').textContent = anomEmps.size;

  // Charts
  if(window.Chart){
    // Att doughnut
    const statusCounts={Present:0,Late:0,Absent:0,'Half Day':0};
    att.forEach(r=>{if(statusCounts[r.status]!==undefined) statusCounts[r.status]++;});
    if(window._cAtt) window._cAtt.destroy();
    window._cAtt = new Chart(get('chartAtt'),{
      type:'doughnut',
      data:{labels:Object.keys(statusCounts),datasets:[{data:Object.values(statusCounts),backgroundColor:['#1a9e6e','#f39c12','#dc3545','#2176ae'],borderWidth:2}]},
      options:{plugins:{legend:{position:'bottom'}},cutout:'65%'}
    });
    // Shift bar
    const sc={Morning:0,Afternoon:0,Night:0};
    emps.forEach(e=>{if(sc[e.shift]!==undefined)sc[e.shift]++;});
    if(window._cShift) window._cShift.destroy();
    window._cShift = new Chart(get('chartShift'),{
      type:'bar',
      data:{labels:Object.keys(sc),datasets:[{label:'Employees',data:Object.values(sc),backgroundColor:['#2176ae','#f39c12','#0f1923'],borderRadius:8}]},
      options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}}}}
    });
  }
}

// ── SETTINGS ─────────────────────────────────────────────
function changePin(){
  const old=get('oldPin').value, n=get('newPin').value, c=get('confirmPin').value;
  const msg=get('pinMsg');
  if(old!==getPin()){msg.style.color='red';msg.textContent='✗ Current PIN is wrong.';return;}
  if(n.length!==4||!/^\d{4}$/.test(n)){msg.style.color='red';msg.textContent='✗ PIN must be 4 digits.';return;}
  if(n!==c){msg.style.color='red';msg.textContent='✗ PINs do not match.';return;}
  localStorage.setItem('adminPin',n);
  msg.style.color='green'; msg.textContent='✓ PIN updated!';
  get('oldPin').value=get('newPin').value=get('confirmPin').value='';
}

function saveProfile(){
  ls.setObj('profile',{admin:get('adminName').value,org:get('orgName').value});
  loadTopbar();
  toast('✓ Profile saved');
}

function clearData(type){
  if(!confirm('Are you sure? This cannot be undone.')) return;
  if(type==='all'){ls.set('employees',[]);ls.set('attendance',[]);}
  else ls.set(type,[]);
  toast('✓ Data cleared');
}

// ── INIT ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', ()=>{
  setActiveNav();
  loadTopbar();
  // Set default month on payroll page
  const pm=get('payMonth'); if(pm) pm.value=todayStr().slice(0,7);
  // Set default date filters
  const adf=get('attDateFilter'); if(adf) adf.value=todayStr();
  // Render tables
  if(get('empBody'))       renderEmployees();
  if(get('attTableBody'))  renderAttTable();
  if(get('shiftTableBody'))renderShiftSummary();
  if(get('payTableBody'))  renderPayrollPage();
  // Load settings profile
  const p=ls.getObj('profile');
  const an=get('adminName'); if(an&&p.admin) an.value=p.admin;
  const on=get('orgName');   if(on&&p.org)   on.value=p.org;
});
