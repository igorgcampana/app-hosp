document.addEventListener('DOMContentLoaded', () => {
  // CONSTANTS & STATE
  const STORAGE_KEY = 'appHospData';
  let patients = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

  // DOM Elements - Navigation
  const navBtns = document.querySelectorAll('.nav-btn');
  const screens = document.querySelectorAll('.screen');

  // DOM Elements - Screen 1 (Registro)
  const formRegistro = document.getElementById('registro-form');
  const inputNome = document.getElementById('pacienteNome');
  const pacienteSelect = document.getElementById('pacienteSelect');
  const novoPacienteGroup = document.getElementById('novoPacienteGroup');
  const inputHospital = document.getElementById('hospital');
  const inputDataVisita = document.getElementById('dataVisita');
  const inputNumeroVisitas = document.getElementById('numeroVisitas');
  const selectDoctor = document.getElementById('current-doctor');
  const suggestionsBox = document.getElementById('autocomplete-suggestions');
  const prevDayTableBody = document.querySelector('#prev-day-table tbody');
  const emptyPrevDay = document.getElementById('empty-prev-day');

  // DOM Elements - Screen 2 (Ficha)
  const patientsTableBody = document.querySelector('#patients-table tbody');
  const emptyPatients = document.getElementById('empty-patients');
  const filterHospital = document.getElementById('filter-hospital');
  const filterStatus = document.getElementById('filter-status');
  const btnExport = document.getElementById('btn-export');
  const thSortables = document.querySelectorAll('th[data-sort]');

  // DOM Elements - Screen 3 (Calendario)
  const filterMonth = document.getElementById('filter-month');
  const btnExportCalendar = document.getElementById('btn-export-calendar');
  const calendarGrid = document.getElementById('calendar-grid');

  // DOM Elements - Edit Modal
  const editModal = document.getElementById('edit-patient-modal');
  const editNome = document.getElementById('edit-nome');
  const editHospital = document.getElementById('edit-hospital');
  const btnSaveEdit = document.getElementById('btn-save-edit');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');
  let currentEditingPatientId = null;

  let currentSort = { column: 'dataUltimaVisita', dir: 'desc' };

  // INITIALIZATION
  init();

  function init() {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    inputDataVisita.value = today;
    filterMonth.value = today.substring(0, 7); // YYYY-MM

    migrateData();

    inputDataVisita.addEventListener('change', renderPrevDayTable);

    setupNavigation();
    setupPatientSelect();
    setupForm();
    setupFichaFilters();
    setupSorting();

    // Render initial views
    renderPrevDayTable();
    renderPatientsTable();
    renderCalendar();
  }

  // CORE FUNCTIONS
  function migrateData() {
    let changed = false;
    patients.forEach(p => {
      if (!p.historico) {
        p.historico = [];
        if (p.dataUltimaVisita) {
          p.historico.push({
            data: p.dataUltimaVisita,
            medico: p.medico || 'Não informado',
            visitas: p.visitas || 1
          });
        }
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
    }
  }

  function savePatients() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
    setupPatientSelect();
    renderPrevDayTable();
    renderPatientsTable();
    renderCalendar();
  }

  function parseDate(dateStr) {
    if (!dateStr) return new Date();
    // Use parts to avoid timezone issues
    const parts = dateStr.split('-');
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function getDaysDifference(date1Str, date2Str) {
    const d1 = parseDate(date1Str);
    const d2 = parseDate(date2Str);
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // Inclusive (1 for same day)
  }

  // NAVIGATION
  function setupNavigation() {
    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;

        // Update buttons
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update screens
        screens.forEach(screen => {
          if (screen.id === targetId) {
            screen.classList.add('active');
          } else {
            screen.classList.remove('active');
          }
        });
      });
    });
  }

  // SCREEN 1: REGISTRO DIÁRIO
  function setupForm() {
    formRegistro.addEventListener('submit', (e) => {
      e.preventDefault();

      const isNovo = pacienteSelect.value === 'novo';
      const nome = isNovo ? inputNome.value.trim() : '';
      const selectedId = pacienteSelect.value;
      const hospital = inputHospital.value;
      const dataVisita = inputDataVisita.value;
      let numeroVisitas = parseInt(inputNumeroVisitas.value, 10) || 1;
      if (numeroVisitas > 3) numeroVisitas = 3;
      const medico = selectDoctor.value;

      // Check if patient exists
      let existingIndex = -1;
      if (!isNovo) {
        existingIndex = patients.findIndex(p => p.id === selectedId);
      } else {
        existingIndex = patients.findIndex(p => p.pacienteNome.toLowerCase() === nome.toLowerCase());
      }

      if (existingIndex >= 0) {
        // Update existing
        const p = patients[existingIndex];

        // Find existing record for this date and doctor
        const histIndex = p.historico.findIndex(h => h.data === dataVisita && h.medico === medico);
        if (histIndex >= 0) {
          p.historico[histIndex].visitas = parseInt(p.historico[histIndex].visitas, 10) + numeroVisitas;
        } else {
          p.historico.push({ data: dataVisita, medico: medico, visitas: numeroVisitas });
        }

        p.hospital = hospital;
        p.dataUltimaVisita = p.historico.map(h => h.data).sort().pop();
        p.dataPrimeiraAvaliacao = p.historico.map(h => h.data).sort().shift();
      } else {
        // Create new
        const newPatient = {
          id: Date.now().toString(),
          pacienteNome: nome,
          hospital: hospital,
          dataPrimeiraAvaliacao: dataVisita,
          dataUltimaVisita: dataVisita,
          historico: [{ data: dataVisita, medico: medico, visitas: numeroVisitas }]
        };
        patients.push(newPatient);
      }

      savePatients();

      // Reset form but keep date and doctor
      inputNome.value = '';
      pacienteSelect.value = 'novo';
      pacienteSelect.dispatchEvent(new Event('change'));
      inputNumeroVisitas.value = '1';
    });
  }

  function setupPatientSelect() {
    // Populate select
    const today = new Date().toISOString().split('T')[0];

    // Clear and rebuild
    pacienteSelect.innerHTML = '<option value="novo">+ Novo Paciente</option>';

    // Sort active patients (last visit <= 2 days ago = diff <= 3)
    const activePatients = patients.filter(p => {
      const diff = getDaysDifference(p.dataUltimaVisita, today);
      return diff <= 3;
    }).sort((a, b) => a.pacienteNome.localeCompare(b.pacienteNome));

    activePatients.forEach(p => {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = `${p.pacienteNome} (${p.hospital} - 1ª aval: ${formatDateBR(p.dataPrimeiraAvaliacao)})`;
      pacienteSelect.appendChild(option);
    });

    // Toggle fields based on selection
    const toggleFields = () => {
      if (pacienteSelect.value === 'novo') {
        novoPacienteGroup.style.display = 'flex';
        inputNome.setAttribute('required', 'true');
      } else {
        novoPacienteGroup.style.display = 'none';
        inputNome.removeAttribute('required');

        // Auto-fill hospital for chosen patient
        const selectedId = pacienteSelect.value;
        const p = patients.find(pat => pat.id === selectedId);
        if (p) {
          inputHospital.value = p.hospital;
        }
      }
    };

    pacienteSelect.addEventListener('change', toggleFields);
    toggleFields(); // Initial run
  }

  function renderPrevDayTable() {
    prevDayTableBody.innerHTML = '';
    const selectedDateStr = inputDataVisita.value;
    if (!selectedDateStr) return;

    const parts = selectedDateStr.split('-');
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() - 1);

    const prevDayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

    // Patients whose last visit is the previous day
    const prevDayPatients = patients.filter(p => p.dataUltimaVisita === prevDayStr);

    if (prevDayPatients.length === 0) {
      emptyPrevDay.style.display = 'block';
      prevDayTableBody.parentElement.style.display = 'none';
      return;
    }

    emptyPrevDay.style.display = 'none';
    prevDayTableBody.parentElement.style.display = 'table';

    prevDayPatients.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.pacienteNome}</td>
        <td>${p.hospital}</td>
        <td>
           <button class="btn-action" title="Registrar 1 visita para a data selecionada" onclick="window.addVisitFromList('${p.id}')">➕</button>
        </td>
      `;
      prevDayTableBody.appendChild(tr);
    });
  }

  window.addVisitFromList = function (id) {
    const dataVisita = inputDataVisita.value;
    const medico = selectDoctor.value;

    const idx = patients.findIndex(p => p.id === id);
    if (idx > -1) {
      const p = patients[idx];
      const histIndex = p.historico.findIndex(h => h.data === dataVisita && h.medico === medico);
      if (histIndex >= 0) {
        p.historico[histIndex].visitas = parseInt(p.historico[histIndex].visitas, 10) + 1;
      } else {
        p.historico.push({ data: dataVisita, medico: medico, visitas: 1 });
      }
      p.dataUltimaVisita = p.historico.map(h => h.data).sort().pop();
      p.dataPrimeiraAvaliacao = p.historico.map(h => h.data).sort().shift();
      savePatients();
    }
  };

  // SCREEN 2: FICHA DE PACIENTES
  function setupFichaFilters() {
    filterHospital.addEventListener('change', renderPatientsTable);
    if (filterStatus) filterStatus.addEventListener('change', renderPatientsTable);

    btnExport.addEventListener('click', exportCSV);
  }

  function setupSorting() {
    thSortables.forEach(th => {
      th.addEventListener('click', () => {
        const column = th.dataset.sort;
        if (currentSort.column === column) {
          currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          currentSort.column = column;
          currentSort.dir = 'asc';
        }
        renderPatientsTable();
      });
    });
  }

  function renderPatientsTable() {
    patientsTableBody.innerHTML = '';

    const hospFilter = filterHospital.value;
    const statusFilter = filterStatus.value;
    const today = new Date().toISOString().split('T')[0];

    let filtered = patients.map(p => {
      const diff = getDaysDifference(p.dataUltimaVisita, today);
      const isAtivo = diff <= 3;
      return { ...p, isAtivo };
    }).filter(p => {
      const matchHosp = hospFilter === 'Todos' || p.hospital === hospFilter;
      const matchStatus = statusFilter === 'Todos' ||
        (statusFilter === 'Ativo' && p.isAtivo) ||
        (statusFilter === 'Inativo' && !p.isAtivo);
      return matchHosp && matchStatus;
    });

    // Sort
    filtered.sort((a, b) => {
      let valA = a[currentSort.column];
      let valB = b[currentSort.column];

      if (currentSort.column === 'status') {
        valA = a.isAtivo ? 0 : 1;
        valB = b.isAtivo ? 0 : 1;
      }

      if (currentSort.column === 'diasEntre') {
        valA = getDaysDifference(a.dataPrimeiraAvaliacao, a.dataUltimaVisita);
        valB = getDaysDifference(b.dataPrimeiraAvaliacao, b.dataUltimaVisita);
      }

      if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
      if (valA > valB) return currentSort.dir === 'asc' ? 1 : -1;
      return 0;
    });

    if (filtered.length === 0) {
      emptyPatients.style.display = 'block';
      patientsTableBody.parentElement.style.display = 'none';
      return;
    }

    emptyPatients.style.display = 'none';
    patientsTableBody.parentElement.style.display = 'table';

    filtered.forEach(p => {
      const dias = getDaysDifference(p.dataPrimeiraAvaliacao, p.dataUltimaVisita);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.pacienteNome}</td>
        <td>${p.hospital}</td>
        <td>
          <span class="status-badge ${p.isAtivo ? 'ativo' : 'inativo'}">
            ${p.isAtivo ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td>${formatDateBR(p.dataPrimeiraAvaliacao)}</td>
        <td>${formatDateBR(p.dataUltimaVisita)}</td>
        <td>${dias}</td>
        <td>
           <button class="btn-action" title="Editar Nome e Hospital" onclick="window.editPatientInfo('${p.id}')">✏️</button>
           <button class="btn-action" title="Excluir Paciente" onclick="window.deletePatient('${p.id}')">🗑️</button>
        </td>
      `;
      patientsTableBody.appendChild(tr);
    });
  }

  window.editPatientInfo = function (id) {
    const p = patients.find(pat => pat.id === id);
    if (!p) return;

    currentEditingPatientId = id;
    editNome.value = p.pacienteNome;
    editHospital.value = p.hospital;

    editModal.classList.add('active');
  };

  btnCancelEdit.addEventListener('click', () => {
    editModal.classList.remove('active');
    currentEditingPatientId = null;
  });

  btnSaveEdit.addEventListener('click', () => {
    if (!currentEditingPatientId) return;

    const p = patients.find(pat => pat.id === currentEditingPatientId);
    if (p) {
      const newNome = editNome.value.trim();
      const newHospital = editHospital.value;

      if (newNome) {
        p.pacienteNome = newNome;
        p.hospital = newHospital;
        savePatients();
      } else {
        alert("O nome do paciente não pode ficar vazio.");
        return;
      }
    }

    editModal.classList.remove('active');
    currentEditingPatientId = null;
  });



  window.deletePatient = function (id) {
    const p = patients.find(pat => pat.id === id);
    if (!p) return;
    if (confirm(`Tem certeza que deseja EXCLUIR o paciente ${p.pacienteNome} de TODO o sistema? Esta ação não pode ser desfeita.`)) {
      patients = patients.filter(pat => pat.id !== id);
      savePatients();
    }
  };

  function exportCSV() {
    let csvContent = "Nome,Hospital,Status,Primeira Avaliacao,Ultima Visita,Dias de Internacao\n";
    const today = new Date().toISOString().split('T')[0];
    patients.forEach(p => {
      const dias = getDaysDifference(p.dataPrimeiraAvaliacao, p.dataUltimaVisita);
      const isAtivo = getDaysDifference(p.dataUltimaVisita, today) <= 3;
      const statusStr = isAtivo ? 'Ativo' : 'Inativo';
      const row = `"${p.pacienteNome}","${p.hospital}","${statusStr}","${formatDateBR(p.dataPrimeiraAvaliacao)}","${formatDateBR(p.dataUltimaVisita)}","${dias}"`;
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "censo_hospitalar.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // SCREEN 3: VISÃO CALENDÁRIO
  filterMonth.addEventListener('change', renderCalendar);
  if (btnExportCalendar) {
    btnExportCalendar.addEventListener('click', exportCalendarCSV);
  }

  function exportCalendarCSV() {
    const monthFilter = filterMonth.value;

    // Find all patients that have history in this month
    const monthlyPatients = patients.filter(p => p.historico && p.historico.some(h => h.data.startsWith(monthFilter)));

    if (monthlyPatients.length === 0) return;

    const visitsByDate = {};
    monthlyPatients.forEach(p => {
      p.historico.forEach(h => {
        if (h.data.startsWith(monthFilter)) {
          if (!visitsByDate[h.data]) visitsByDate[h.data] = {};
          if (!visitsByDate[h.data][h.medico]) visitsByDate[h.data][h.medico] = [];
          visitsByDate[h.data][h.medico].push({
            pacienteNome: p.pacienteNome,
            visitas: h.visitas
          });
        }
      });
    });

    const sortedDates = Object.keys(visitsByDate).sort();
    const columns = [];
    let maxRows = 0;

    sortedDates.forEach(dateStr => {
      const parsed = parseDate(dateStr);
      const ddmm = String(parsed.getDate()).padStart(2, '0') + '/' + String(parsed.getMonth() + 1).padStart(2, '0');

      const docsInDate = visitsByDate[dateStr];
      const sortedDocs = Object.keys(docsInDate).sort();

      sortedDocs.forEach((doc, idx) => {
        const col = [];
        col.push(idx === 0 ? `Mês: ${monthFilter}` : ''); // Add Month to first row
        col.push(idx === 0 ? ddmm : '');
        col.push(doc);

        let docTotal = 0;
        docsInDate[doc].forEach(record => {
          docTotal += parseInt(record.visitas, 10);
          const visitStr = record.visitas > 1 ? ` (${record.visitas})` : '';
          col.push(`${record.pacienteNome}${visitStr}`);
        });

        col.push(`Total: ${docTotal}`);
        columns.push(col);

        if (col.length > maxRows) maxRows = col.length;
      });
    });

    let csvContent = "";
    for (let row = 0; row < maxRows; row++) {
      const rowData = columns.map(col => {
        const cellValue = col[row] || '';
        return `"${cellValue}"`;
      });
      csvContent += rowData.join(',') + "\n";
    }

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `calendario_${monthFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function renderCalendar() {
    calendarGrid.innerHTML = '';
    if (patients.length === 0) return;

    const monthFilter = filterMonth.value; // YYYY-MM

    // Group patients by data from historico array
    // Only for the selected month
    const visitsByDate = {};

    patients.forEach(p => {
      if (!p.historico) return;
      p.historico.forEach((h, hIdx) => {
        if (h.data.startsWith(monthFilter)) {
          if (!visitsByDate[h.data]) {
            visitsByDate[h.data] = {};
          }
          if (!visitsByDate[h.data][h.medico]) {
            visitsByDate[h.data][h.medico] = [];
          }
          visitsByDate[h.data][h.medico].push({
            patientId: p.id,
            pacienteNome: p.pacienteNome,
            hospital: p.hospital,
            visitas: h.visitas,
            hIdx: hIdx
          });
        }
      });
    });

    const sortedDates = Object.keys(visitsByDate).sort();

    if (sortedDates.length === 0) {
      calendarGrid.innerHTML = '<p class="empty-state">Nenhum evento no mês selecionado.</p>';
      return;
    }

    // Build columns for each date
    sortedDates.forEach(dateStr => {
      const colDiv = document.createElement('div');
      colDiv.className = 'cal-column';

      const parsed = parseDate(dateStr);
      const ddmm = String(parsed.getDate()).padStart(2, '0') + '/' + String(parsed.getMonth() + 1).padStart(2, '0');

      let html = `<div class="cal-header"><div class="cal-date">${ddmm}</div></div>`;
      html += `<div class="cal-body">`;

      const docsInDate = visitsByDate[dateStr];
      const sortedDocs = Object.keys(docsInDate).sort();
      let dailyTotal = 0;

      sortedDocs.forEach(doc => {
        // Find CSS class for doctor color
        const docClass = doc.split(' ')[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        html += `<div style="margin-bottom: 1rem;">`;
        html += `<span class="cal-doctor ${docClass}">${doc}</span>`;
        html += `<div style="margin-top: 0.5rem;">`;

        docsInDate[doc].forEach(record => {
          dailyTotal += parseInt(record.visitas, 10);
          const visitCountIndicator = record.visitas > 1 ? ` (${record.visitas})` : '';
          html += `<div class="cal-patient">
                     <strong>${record.pacienteNome}${visitCountIndicator}</strong>
                     <span>${record.hospital}</span>
                     <div class="cal-actions" style="margin-top: 5px; text-align: right;">
                        <button class="btn-action" title="Editar Visita" onclick="window.editVisit('${record.patientId}', ${record.hIdx})">✏️</button>
                        <button class="btn-action" title="Excluir Visita" onclick="window.deleteVisit('${record.patientId}', ${record.hIdx})">🗑️</button>
                     </div>
                   </div>`;
        });

        html += `</div></div>`;
      });

      html += `<div class="cal-daily-total" style="text-align:center; font-weight:bold; color:var(--color-primary); border-top: 1px dashed var(--color-border); padding-top: 0.5rem; margin-top: 0.5rem;">Total do dia: ${dailyTotal}</div>`;
      html += `</div>`;
      colDiv.innerHTML = html;
      calendarGrid.appendChild(colDiv);
    });
  }

  window.editVisit = function (patientId, hIdx) {
    const p = patients.find(pat => pat.id === patientId);
    if (!p || !p.historico || !p.historico[hIdx]) return;
    const h = p.historico[hIdx];

    const newVisits = prompt(`Editando visitas de ${p.pacienteNome} no dia ${h.data}.\nNovo número de visitas:`, h.visitas);
    if (newVisits !== null && newVisits !== '') {
      const parsed = parseInt(newVisits, 10);
      if (!isNaN(parsed) && parsed > 0) {
        p.historico[hIdx].visitas = parsed;
        savePatients();
      }
    }
  };

  window.deleteVisit = function (patientId, hIdx) {
    const p = patients.find(pat => pat.id === patientId);
    if (!p || !p.historico || !p.historico[hIdx]) return;
    const h = p.historico[hIdx];

    if (confirm(`Remover o registro de ${p.pacienteNome} do dia ${h.data}?`)) {
      p.historico.splice(hIdx, 1);
      if (p.historico.length === 0) {
        if (confirm(`O paciente ${p.pacienteNome} ficou sem histórico de visitas. Deseja excluí-lo do sistema também?`)) {
          patients = patients.filter(pat => pat.id !== patientId);
        } else {
          p.dataPrimeiraAvaliacao = '';
          p.dataUltimaVisita = '';
        }
      } else {
        p.dataUltimaVisita = p.historico.map(hi => hi.data).sort().pop();
        p.dataPrimeiraAvaliacao = p.historico.map(hi => hi.data).sort().shift();
      }
      savePatients();
    }
  };

  // UTILS
  function formatDateBR(dateStr) {
    if (!dateStr) return '';
    const p = dateStr.split('-');
    return `${p[2]}/${p[1]}/${p[0]}`;
  }

  // Update date automatically if it changes over midnight
  window.addEventListener('focus', () => {
    const today = new Date().toISOString().split('T')[0];
    if (inputDataVisita.value !== today) {
      // if we want to auto update "today" field on midnight change
      // inputDataVisita.value = today;
    }
  });
});
