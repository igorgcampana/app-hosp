const SUPABASE_URL = 'https://gbcnmuppylwznhrticfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiY25tdXBweWx3em5ocnRpY2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NjcwNzUsImV4cCI6MjA4NzU0MzA3NX0.XOQfcNwZSxarlHz2D51MEqlkLJ74TYLpFOUUYVB0Ko0';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
  // Check Authentication First
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  // Bind Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  });

  // STATE
  let patients = [];
  let currentSort = { column: 'dataUltimaVisita', dir: 'desc' };

  // DOM Elements - Navigation
  const navBtns = document.querySelectorAll('.nav-btn:not(#btn-logout)');
  const screens = document.querySelectorAll('.screen');

  // DOM Elements - Screen 1 (Registro)
  const formRegistro = document.getElementById('registro-form');
  const inputNome = document.getElementById('pacienteNome');
  const pacienteSelect = document.getElementById('pacienteSelect');
  const novoPacienteGroup = document.getElementById('novoPacienteGroup');
  const inputHospital = document.getElementById('hospital');
  const inputInternacao = document.getElementById('internacao');
  const inputDataVisita = document.getElementById('dataVisita');
  const inputNumeroVisitas = document.getElementById('numeroVisitas');
  const inputMarcarAlta = document.getElementById('marcarAlta');
  const selectDoctor = document.getElementById('current-doctor');
  const prevDayTableBody = document.querySelector('#prev-day-table tbody');
  const emptyPrevDay = document.getElementById('empty-prev-day');
  const btnSubmitRegistro = formRegistro.querySelector('button[type="submit"]');

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
  const summaryTableBody = document.querySelector('#summary-table tbody');
  const emptySummary = document.getElementById('empty-summary');

  // DOM Elements - Edit Modal
  const editModal = document.getElementById('edit-patient-modal');
  const editNome = document.getElementById('edit-nome');
  const editHospital = document.getElementById('edit-hospital');
  const editInternacao = document.getElementById('edit-internacao');
  const editAlta = document.getElementById('edit-alta');
  const btnSaveEdit = document.getElementById('btn-save-edit');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');
  let currentEditingPatientId = null;

  // Set default date to today
  const todayDateObj = new Date();
  const today = todayDateObj.toISOString().split('T')[0];
  inputDataVisita.value = today;
  filterMonth.value = today.substring(0, 7); // YYYY-MM

  // Mapeia os dados do BD (minúsculo) para o formato esperado localmente
  function mapPatient(dbPat) {
    return {
      id: dbPat.id,
      pacienteNome: dbPat.pacientenome,
      hospital: dbPat.hospital,
      internacao: dbPat.internacao,
      statusManual: dbPat.statusmanual,
      dataPrimeiraAvaliacao: dbPat.dataprimeiraavaliacao,
      dataUltimaVisita: dbPat.dataultimavisita,
      historico: dbPat.historico || []
    };
  }

  async function fetchAllData() {
    const { data, error } = await supabase
      .from('patients')
      .select('*, historico(*)');

    if (error) {
      console.error(error);
      alert('Erro ao carregar os dados. Verifique a conexão.');
      return;
    }
    patients = data.map(mapPatient);
  }

  async function init() {
    await fetchAllData();

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

  // --- CORE UTILS ---
  function parseDate(dateStr) {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function getDaysDifference(date1Str, date2Str) {
    if (!date1Str || !date2Str) return 0;
    const d1 = parseDate(date1Str);
    const d2 = parseDate(date2Str);
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // Inclusive (1 for same day)
  }

  function formatDateBR(dateStr) {
    if (!dateStr) return '';
    const p = dateStr.split('-');
    return `${p[2]}/${p[1]}/${p[0]}`;
  }

  // NAVIGATION
  function setupNavigation() {
    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
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
    formRegistro.addEventListener('submit', async (e) => {
      e.preventDefault();

      btnSubmitRegistro.disabled = true;
      btnSubmitRegistro.textContent = 'Salvando...';

      const isNovo = pacienteSelect.value === 'novo';
      const nome = isNovo ? inputNome.value.trim() : '';
      const selectedId = pacienteSelect.value;
      const hospital = inputHospital.value;
      const internacao = inputInternacao.value;
      const ehAlta = inputMarcarAlta.checked;
      const dataVisita = inputDataVisita.value;
      let numeroVisitas = parseInt(inputNumeroVisitas.value, 10) || 1;
      if (numeroVisitas > 3) numeroVisitas = 3;
      const medico = selectDoctor.value;

      let targetPatientId = selectedId;
      let existingIndex = -1;

      if (!isNovo) {
        existingIndex = patients.findIndex(p => p.id === selectedId);
      }

      if (existingIndex >= 0) {
        // Update existing patient
        const p = patients[existingIndex];

        // Calcular novas datas baseando-se no novo input tb
        let allDates = p.historico.map(h => h.data);
        if (!allDates.includes(dataVisita)) allDates.push(dataVisita);

        const novaUltima = allDates.sort().pop();
        const novaPrimeira = allDates.sort().shift();

        let novoStatus = p.statusManual;
        if (ehAlta) {
          novoStatus = 'Alta';
        } else if (p.statusManual === 'Alta') {
          novoStatus = 'Internado';
        }

        const { error: errUpdate } = await supabase.from('patients').update({
          hospital: hospital,
          internacao: internacao,
          statusmanual: novoStatus,
          dataprimeiraavaliacao: novaPrimeira,
          dataultimavisita: novaUltima,
          updated_at: new Date().toISOString()
        }).eq('id', p.id);

        if (!errUpdate) {
          // Find existing record for this date and doctor
          const hist = p.historico.find(h => h.data === dataVisita && h.medico === medico);
          if (hist) {
            const novasVisitas = parseInt(hist.visitas, 10) + numeroVisitas;
            await supabase.from('historico').update({ visitas: novasVisitas }).eq('id', hist.id);
          } else {
            await supabase.from('historico').insert({
              patient_id: p.id,
              data: dataVisita,
              medico: medico,
              visitas: numeroVisitas
            });
          }
        }
      } else {
        // Create new patient
        const { data: newPat, error } = await supabase.from('patients').insert({
          pacientenome: nome,
          hospital: hospital,
          internacao: internacao,
          statusmanual: ehAlta ? 'Alta' : 'Internado',
          dataprimeiraavaliacao: dataVisita,
          dataultimavisita: dataVisita
        }).select().single();

        if (newPat && !error) {
          await supabase.from('historico').insert({
            patient_id: newPat.id,
            data: dataVisita,
            medico: medico,
            visitas: numeroVisitas
          });
        }
      }

      // Reiniciar após salvar remotamente
      await fetchAllData();

      inputNome.value = '';
      pacienteSelect.value = 'novo';
      pacienteSelect.dispatchEvent(new Event('change'));
      inputNumeroVisitas.value = '1';
      inputMarcarAlta.checked = false;

      btnSubmitRegistro.disabled = false;
      btnSubmitRegistro.textContent = 'Registrar Visita';

      setupPatientSelect();
      renderPrevDayTable();
      renderPatientsTable();
      renderCalendar();
    });
  }

  function setupPatientSelect() {
    pacienteSelect.innerHTML = '<option value="novo">+ Novo Paciente</option>';

    // Sort active patients (diff <= 3) e não alta manual
    const activePatients = patients.filter(p => {
      if (p.statusManual === 'Alta') return false;
      const diff = getDaysDifference(p.dataUltimaVisita, today);
      return diff <= 3;
    }).sort((a, b) => a.pacienteNome.localeCompare(b.pacienteNome));

    activePatients.forEach(p => {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = `${p.pacienteNome} (${p.hospital} / ${p.internacao || 'Particular'} - 1ª aval: ${formatDateBR(p.dataPrimeiraAvaliacao)})`;
      pacienteSelect.appendChild(option);
    });

    const toggleFields = () => {
      if (pacienteSelect.value === 'novo') {
        novoPacienteGroup.style.display = 'flex';
        inputNome.setAttribute('required', 'true');
      } else {
        novoPacienteGroup.style.display = 'none';
        inputNome.removeAttribute('required');

        const selectedId = pacienteSelect.value;
        const p = patients.find(pat => pat.id === selectedId);
        if (p) {
          inputHospital.value = p.hospital;
          if (p.internacao) {
            inputInternacao.value = p.internacao;
          }
        }
      }
    };

    pacienteSelect.addEventListener('change', toggleFields);
    toggleFields();
  }

  function renderPrevDayTable() {
    prevDayTableBody.innerHTML = '';
    const selectedDateStr = inputDataVisita.value;
    if (!selectedDateStr) return;

    const parts = selectedDateStr.split('-');
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() - 1);

    const prevDayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

    const prevDayPatients = patients.filter(p => p.dataUltimaVisita === prevDayStr && p.statusManual !== 'Alta');

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

  window.addVisitFromList = async function (id) {
    const dataVisita = inputDataVisita.value;
    const medico = selectDoctor.value;

    const idx = patients.findIndex(pat => pat.id === id);
    if (idx > -1) {
      const p = patients[idx];
      const hist = p.historico.find(h => h.data === dataVisita && h.medico === medico);

      if (hist) {
        await supabase.from('historico').update({ visitas: parseInt(hist.visitas, 10) + 1 }).eq('id', hist.id);
      } else {
        await supabase.from('historico').insert({ patient_id: p.id, data: dataVisita, medico: medico, visitas: 1 });
      }

      // Updated Dates
      let allDates = p.historico.map(h => h.data);
      if (!allDates.includes(dataVisita)) allDates.push(dataVisita);
      const novaUltima = allDates.sort().pop();
      const novaPrimeira = allDates.sort().shift();

      await supabase.from('patients').update({
        dataultimavisita: novaUltima,
        dataprimeiraavaliacao: novaPrimeira,
        updated_at: new Date().toISOString()
      }).eq('id', p.id);

      await fetchAllData();
      renderPrevDayTable();
      renderPatientsTable();
      renderCalendar();
      setupPatientSelect();
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

    let filtered = patients.map(p => {
      const diff = getDaysDifference(p.dataUltimaVisita, today);
      let isInternado = true;

      if (p.statusManual === 'Alta') {
        isInternado = false;
      } else if (diff > 3) {
        isInternado = false;
      }

      return { ...p, isInternado };
    }).filter(p => {
      const matchHosp = hospFilter === 'Todos' || p.hospital === hospFilter;
      const matchStatus = statusFilter === 'Todos' ||
        (statusFilter === 'Internado' && p.isInternado) ||
        (statusFilter === 'Alta' && !p.isInternado);
      return matchHosp && matchStatus;
    });

    // Sort
    filtered.sort((a, b) => {
      let valA = a[currentSort.column];
      let valB = b[currentSort.column];

      if (currentSort.column === 'status') {
        valA = a.isInternado ? 0 : 1;
        valB = b.isInternado ? 0 : 1;
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
        <td>${p.internacao || 'Particular'}</td>
        <td>${p.hospital}</td>
        <td>
          <span class="status-badge ${p.isInternado ? 'ativo' : 'inativo'}">
            ${p.isInternado ? 'Internado' : 'Alta'}
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
    if (p.internacao) {
      editInternacao.value = p.internacao;
    } else {
      editInternacao.value = 'Particular';
    }
    editAlta.checked = p.statusManual === 'Alta';

    editModal.classList.add('active');
  };

  btnCancelEdit.addEventListener('click', () => {
    editModal.classList.remove('active');
    currentEditingPatientId = null;
  });

  btnSaveEdit.addEventListener('click', async () => {
    if (!currentEditingPatientId) return;

    const p = patients.find(pat => pat.id === currentEditingPatientId);
    if (p) {
      const newNome = editNome.value.trim();
      const newHospital = editHospital.value;
      const newInternacao = editInternacao.value;
      const ehAlta = editAlta.checked;

      if (newNome) {
        let novoStatus = p.statusManual;
        if (ehAlta) {
          novoStatus = 'Alta';
        } else if (p.statusManual === 'Alta') {
          novoStatus = 'Internado';
        }

        btnSaveEdit.textContent = 'Aguarde...';
        btnSaveEdit.disabled = true;

        await supabase.from('patients').update({
          pacientenome: newNome,
          hospital: newHospital,
          internacao: newInternacao,
          statusmanual: novoStatus,
          updated_at: new Date().toISOString()
        }).eq('id', p.id);

        await fetchAllData();
        renderPatientsTable();
        setupPatientSelect();

        btnSaveEdit.textContent = 'Salvar';
        btnSaveEdit.disabled = false;
      } else {
        alert("O nome do paciente não pode ficar vazio.");
        return;
      }
    }
    editModal.classList.remove('active');
    currentEditingPatientId = null;
  });

  window.deletePatient = async function (id) {
    const p = patients.find(pat => pat.id === id);
    if (!p) return;
    if (confirm(`Tem certeza que deseja EXCLUIR o paciente ${p.pacienteNome} de TODO o sistema? Esta ação apaga os históricos remotamente.`)) {
      await supabase.from('patients').delete().eq('id', id);
      await fetchAllData();
      renderPatientsTable();
      setupPatientSelect();
      renderCalendar();
    }
  };

  function exportCSV() {
    let csvContent = "Nome,Internação,Hospital,Status,Primeira Avaliacao,Ultima Visita,Dias de Internacao\n";
    patients.forEach(p => {
      const dias = getDaysDifference(p.dataPrimeiraAvaliacao, p.dataUltimaVisita);
      let isInternado = true;
      if (p.statusManual === 'Alta') {
        isInternado = false;
      } else if (getDaysDifference(p.dataUltimaVisita, today) > 3) {
        isInternado = false;
      }
      const statusStr = isInternado ? 'Internado' : 'Alta';
      const internacaoStr = p.internacao || 'Particular';

      const row = `"${p.pacienteNome}","${internacaoStr}","${p.hospital}","${statusStr}","${formatDateBR(p.dataPrimeiraAvaliacao)}","${formatDateBR(p.dataUltimaVisita)}","${dias}"`;
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
        col.push(idx === 0 ? `Mês: ${monthFilter}` : '');
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
    summaryTableBody.innerHTML = '';

    if (patients.length === 0) return;

    const monthFilter = filterMonth.value;
    const visitsByDate = {};
    const visitsByDoctor = {}; // Para nosso novo painél de histórico mensal

    patients.forEach(p => {
      if (!p.historico) return;
      p.historico.forEach((h) => {
        if (h.data.startsWith(monthFilter)) {
          if (!visitsByDate[h.data]) {
            visitsByDate[h.data] = {};
          }
          if (!visitsByDate[h.data][h.medico]) {
            visitsByDate[h.data][h.medico] = [];
          }
          visitsByDate[h.data][h.medico].push({
            patientId: p.id,
            histId: h.id, // Supabase id
            pacienteNome: p.pacienteNome,
            hospital: p.hospital,
            visitas: h.visitas
          });

          // Computar totais para a tabela "Visitas Mensais"
          if (!visitsByDoctor[h.medico]) {
            visitsByDoctor[h.medico] = 0;
          }
          visitsByDoctor[h.medico] += parseInt(h.visitas, 10) || 0;
        }
      });
    });

    const sortedDates = Object.keys(visitsByDate).sort();

    if (sortedDates.length === 0) {
      calendarGrid.innerHTML = '<p class="empty-state">Nenhum evento no mês selecionado.</p>';
      emptySummary.style.display = 'block';
      summaryTableBody.parentElement.style.display = 'none';
      return;
    }

    // Build Calendario Main Grid
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
                        <button class="btn-action" title="Editar Visita" onclick="window.editVisit('${record.patientId}', '${record.histId}')">✏️</button>
                        <button class="btn-action" title="Excluir Visita" onclick="window.deleteVisit('${record.patientId}', '${record.histId}')">🗑️</button>
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

    // Build Totals Table
    emptySummary.style.display = 'none';
    summaryTableBody.parentElement.style.display = 'table';

    Object.keys(visitsByDoctor).sort().forEach(doc => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${doc}</strong></td>
        <td>${visitsByDoctor[doc]}</td>
      `;
      summaryTableBody.appendChild(tr);
    });
  }

  window.editVisit = async function (patientId, histId) {
    const p = patients.find(pat => pat.id === patientId);
    if (!p || !p.historico) return;
    const h = p.historico.find(hi => hi.id === histId);
    if (!h) return;

    const newVisits = prompt(`Editando visitas de ${p.pacienteNome} no dia ${h.data}.\nNovo número de visitas:`, h.visitas);
    if (newVisits !== null && newVisits !== '') {
      const parsed = parseInt(newVisits, 10);
      if (!isNaN(parsed) && parsed > 0) {
        await supabase.from('historico').update({ visitas: parsed }).eq('id', histId);
        await fetchAllData();
        renderCalendar();
      }
    }
  };

  window.deleteVisit = async function (patientId, histId) {
    const p = patients.find(pat => pat.id === patientId);
    if (!p || !p.historico) return;
    const h = p.historico.find(hi => hi.id === histId);
    if (!h) return;

    if (confirm(`Remover o registro de ${p.pacienteNome} do dia ${h.data}?`)) {
      await supabase.from('historico').delete().eq('id', histId);

      const arrayLimitado = p.historico.filter(hi => hi.id !== histId);

      if (arrayLimitado.length === 0) {
        if (confirm(`O paciente ${p.pacienteNome} ficou sem histórico de visitas. Deseja excluí-lo do sistema também?`)) {
          await supabase.from('patients').delete().eq('id', patientId);
        } else {
          await supabase.from('patients').update({
            dataprimeiraavaliacao: null,
            dataultimavisita: null
          }).eq('id', patientId);
        }
      } else {
        const dates = arrayLimitado.map(x => x.data).sort();
        const novaUltima = dates.pop() || null;
        const novaPrimeira = dates.shift() || novaUltima;

        await supabase.from('patients').update({
          dataprimeiraavaliacao: novaPrimeira,
          dataultimavisita: novaUltima
        }).eq('id', patientId);
      }

      await fetchAllData();
      renderCalendar();
      renderPatientsTable();
    }
  };

  // EXECUTE INITIALIZATION
  init();

});
