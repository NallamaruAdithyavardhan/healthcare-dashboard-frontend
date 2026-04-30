// ─── API CONFIG ───
const API_URL = 'https://fedskillstest.coalitiontechnologies.workers.dev';
const USERNAME = 'coalition';
const PASSWORD = 'skills-test';
const AUTH = 'Basic ' + btoa(USERNAME + ':' + PASSWORD);

// ─── CHART REF ───
let bpChartInstance = null;

// ─── HELPERS ───
function statusBadge(status) {
    if (!status) return '';
    const s = status.toLowerCase();
    let cls = 'inactive';
    if (s === 'active' || s.includes('active')) cls = 'active';
    else if (s === 'resolved' || s.includes('resolved')) cls = 'resolved';
    return `<span class="status-badge ${cls}">${status}</span>`;
}

function vitalStatusClass(level) {
    if (!level) return 'normal';
    const l = level.toLowerCase();
    if (l.includes('lower')) return 'lower';
    if (l.includes('higher')) return 'higher';
    return 'normal';
}

// ─── RENDER PATIENT LIST ───
function renderPatientList(patients, selectedName) {
    const container = document.getElementById('patientList');
    container.innerHTML = patients.map(p => `
    <div class="patient-item ${p.name === selectedName ? 'selected' : ''}" data-name="${p.name}">
      <img class="patient-avatar" src="${p.profile_picture || 'https://i.pravatar.cc/44'}" alt="${p.name}" onerror="this.src='https://i.pravatar.cc/44'" />
      <div class="patient-item-info">
        <div class="patient-item-name">${p.name}</div>
        <div class="patient-item-meta">${p.gender || ''} • ${p.age || ''} years</div>
      </div>
      <button class="patient-item-dots" title="More">•••</button>
    </div>
  `).join('');
}

// ─── RENDER PATIENT DETAIL ───
function renderPatient(patient) {
    // Profile Card
    document.getElementById('profileAvatar').src = patient.profile_picture || 'https://i.pravatar.cc/100?img=47';
    document.getElementById('profileAvatar').onerror = function () { this.src = 'https://i.pravatar.cc/100?img=47'; };
    document.getElementById('profileName').textContent = patient.name || '--';
    document.getElementById('profileDob').textContent = patient.gender || '--';
    document.getElementById('profileDobVal').textContent = patient.date_of_birth || '--';
    document.getElementById('profileGender').textContent = patient.gender || '--';
    document.getElementById('profilePhone').textContent = patient.phone_number || '--';
    document.getElementById('profileEmergency').textContent = patient.emergency_contact || '--';
    document.getElementById('profileInsurance').textContent = patient.insurance_type || '--';

    // Diagnosis List
    const diags = patient.diagnostic_list || [];
    const tbody = document.getElementById('diagnosisTable');
    if (diags.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="color:var(--text-mid);padding:16px 12px;">No diagnoses on record.</td></tr>';
    } else {
        tbody.innerHTML = diags.map(d => `
      <tr>
        <td style="font-weight:700;">${d.name || '--'}</td>
        <td style="color:var(--text-mid);">${d.description || '--'}</td>
        <td>${statusBadge(d.status)}</td>
      </tr>
    `).join('');
    }

    // Lab Results
    const labs = patient.lab_results || [];
    const labContainer = document.getElementById('labResults');
    if (labs.length === 0) {
        labContainer.innerHTML = '<p style="color:var(--text-mid);font-size:14px;">No lab results.</p>';
    } else {
        labContainer.innerHTML = labs.map(lab => `
      <div class="lab-item">
        <div>
          <div class="lab-item-name">${lab}</div>
        </div>
        <button class="lab-download" title="Download">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
    `).join('');
    }

    // Blood Pressure History + Chart
    const bpHistory = patient.diagnosis_history || [];

    // Last 6 months
    const last6 = bpHistory.slice(-6);

    const labels = last6.map(h => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[h.month - 1]}, ${h.year}`;
    });

    const sysValues = last6.map(h => h.blood_pressure?.systolic?.value ?? null);
    const diaValues = last6.map(h => h.blood_pressure?.diastolic?.value ?? null);

    // Latest reading
    const latest = last6[last6.length - 1];
    if (latest) {
        const sys = latest.blood_pressure?.systolic;
        const dia = latest.blood_pressure?.diastolic;
        document.getElementById('sysReading').textContent = sys?.value ?? '--';
        document.getElementById('sysDesc').textContent = sys?.levels ?? '--';
        document.getElementById('diaReading').textContent = dia?.value ?? '--';
        document.getElementById('diaDesc').textContent = dia?.levels ?? '--';

        // Vitals from latest entry
        const rr = latest.respiratory_rate;
        const temp = latest.temperature;
        const hr = latest.heart_rate;

        document.getElementById('respRate').textContent = rr?.value ?? '--';
        const rsEl = document.getElementById('respStatus');
        rsEl.textContent = rr?.levels ?? 'Normal';
        rsEl.className = 'vital-status ' + vitalStatusClass(rr?.levels);

        document.getElementById('tempVal').textContent = temp?.value ?? '--';
        const tEl = document.getElementById('tempStatus');
        tEl.textContent = temp?.levels ?? 'Normal';
        tEl.className = 'vital-status ' + vitalStatusClass(temp?.levels);

        document.getElementById('heartRate').textContent = hr?.value ?? '--';
        const hEl = document.getElementById('heartStatus');
        hEl.textContent = hr?.levels ?? 'Normal';
        hEl.className = 'vital-status ' + vitalStatusClass(hr?.levels);
    }

    // Render Chart
    renderBPChart(labels, sysValues, diaValues);
}

// ─── CHART ───
function renderBPChart(labels, sysData, diaData) {
    const ctx = document.getElementById('bpChart').getContext('2d');
    if (bpChartInstance) bpChartInstance.destroy();

    bpChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Systolic',
                    data: sysData,
                    borderColor: '#C26EB4',
                    backgroundColor: 'rgba(194,110,180,0.15)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#C26EB4',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    tension: 0.4,
                    fill: false,
                },
                {
                    label: 'Diastolic',
                    data: diaData,
                    borderColor: '#7FBBEC',
                    backgroundColor: 'rgba(127,187,236,0.15)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#7FBBEC',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    tension: 0.4,
                    fill: false,
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} mmHg`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 12, family: 'Manrope', weight: '600' }, color: '#707070' }
                },
                y: {
                    min: 60,
                    max: 180,
                    grid: { color: '#F0F0F0' },
                    ticks: { font: { size: 12, family: 'Manrope', weight: '600' }, color: '#707070', stepSize: 20 }
                }
            }
        }
    });
}

// ─── MAIN FETCH ───
async function fetchData() {
    try {
        const res = await fetch(API_URL, {
            headers: { Authorization: AUTH }
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);

        const patients = await res.json();

        // Find Jessica Taylor
        const jessica = patients.find(p => p.name === 'Jessica Taylor');
        if (!jessica) throw new Error('Patient Jessica Taylor not found in API response.');

        // Render patient list
        renderPatientList(patients, jessica.name);

        // Render detail panel for Jessica
        renderPatient(jessica);

        // Click to switch patients
        document.getElementById('patientList').addEventListener('click', e => {
            const item = e.target.closest('.patient-item');
            if (!item) return;
            const name = item.dataset.name;
            const p = patients.find(x => x.name === name);
            if (!p) return;
            document.querySelectorAll('.patient-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            renderPatient(p);
        });

    } catch (err) {
        const banner = document.getElementById('errorBanner');
        banner.textContent = '⚠️ ' + err.message;
        banner.style.display = 'block';
        console.error(err);
    } finally {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

fetchData();