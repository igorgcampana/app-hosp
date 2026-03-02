const SUPABASE_URL = 'https://gbcnmuppylwznhrticfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiY25tdXBweWx3em5ocnRpY2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NjcwNzUsImV4cCI6MjA4NzU0MzA3NX0.XOQfcNwZSxarlHz2D51MEqlkLJ74TYLpFOUUYVB0Ko0';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
  // Check Authentication First
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.replace('login.html');
    return;
  }

  // Get User Role
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (profileError) console.error("Erro ao buscar perfil:", profileError);

  const userRole = profile?.role || 'doctor';
  console.log("Usuário logado:", session.user.email, "| Papel:", userRole);

  // Update user display
  const userEmailDisplay = document.getElementById('user-email');
  if (userEmailDisplay && session.user.email) {
    userEmailDisplay.textContent = session.user.email;
  }

  // Reveal body after successful auth
  document.body.style.visibility = 'visible';
  applyRolePermissions(userRole);

  // Bind Logout
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async (e) => {
      e.preventDefault();
      btnLogout.textContent = 'Saindo...';
      btnLogout.disabled = true;
      await supabaseClient.auth.signOut();
      window.location.replace('login.html');
    });
  }

  // --- DOMAIN CONSTANTS ---
  const DOCTORS = ['Beatriz', 'Eduardo', 'Felipe Reinaldo', 'Igor', 'Tamires'];
  const HOSPITALS = ['HVNS', 'HSL', 'H9J', 'Outro'];
  const INTERNACAO_TYPES = ['Particular', 'Retaguarda'];
  const STATUS = { INTERNADO: 'Internado', ALTA: 'Alta' };

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

  // DOM Elements - Edit Patient Modal
  const editModal = document.getElementById('edit-patient-modal');
  const editNome = document.getElementById('edit-nome');
  const editHospital = document.getElementById('edit-hospital');
  const editInternacao = document.getElementById('edit-internacao');
  const editAlta = document.getElementById('edit-alta');
  const editDataPrimeira = document.getElementById('edit-data-primeira');
  const btnSaveEdit = document.getElementById('btn-save-edit');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');
  let currentEditingPatientId = null;

  // DOM Elements - Edit Visit Modal
  const editVisitModal = document.getElementById('edit-visit-modal');
  const editVisitPatientLabel = document.getElementById('edit-visit-patient-label');
  const editVisitMedico = document.getElementById('edit-visit-medico');
  const editVisitVisitas = document.getElementById('edit-visit-visitas');
  const btnSaveVisit = document.getElementById('btn-save-visit');
  const btnCancelVisit = document.getElementById('btn-cancel-visit');
  let currentEditingVisit = null; // { patientId, histId }

  // Set default date to today
  const todayDateObj = new Date();
  const today = todayDateObj.toISOString().split('T')[0];
  inputDataVisita.value = today;
  filterMonth.value = today.substring(0, 7); // YYYY-MM

  // --- CORE UTILS ---

  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function parseDate(dateStr) {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  // Diferença em dias sem inclusão (para lógica de negócio)
  function diffEmDias(data1, data2) {
    if (!data1 || !data2) return 0;
    const d1 = parseDate(data1);
    const d2 = parseDate(data2);
    return Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
  }

  // Diferença inclusiva (para exibição de "dias de internação")
  function diasDeInternacao(dataInicio, dataFim) {
    if (!dataInicio || !dataFim) return 0;
    return diffEmDias(dataInicio, dataFim) + 1;
  }

  function formatDateBR(dateStr) {
    if (!dateStr) return '';
    const p = dateStr.split('-');
    return `${p[2]}/${p[1]}/${p[0]}`;
  }

  function populateSelect(selectEl, options, config = {}) {
    const { includeAll = false, allLabel = 'Todos', includeNovo = false, novoLabel = '+ Novo Paciente' } = config;
    selectEl.innerHTML = '';
    if (includeAll) selectEl.appendChild(new Option(allLabel, 'Todos'));
    if (includeNovo) selectEl.appendChild(new Option(novoLabel, 'novo'));
    options.forEach(opt => selectEl.appendChild(new Option(opt, opt)));
  }

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
    const { data, error } = await supabaseClient
      .from('patients')
      .select('*, historico(*)');

    if (error) {
      console.error(error);
      showToast('Erro ao carregar os dados. Verifique a conexão.');
      return;
    }
    patients = data.map(mapPatient);
  }

  async function init() {
    await fetchAllData();

    // Remover loader
    const loader = document.getElementById('app-loader');
    if (loader) loader.remove();

    inputDataVisita.addEventListener('change', () => {
      renderPrevDayTable();
      setupPatientSelect();
    });

    setupNavigation();
    setupPatientSelect();
    setupForm();
    setupFichaFilters();
    setupSorting();
    setupModalListeners();
    setupEventDelegation();

    // Render initial views
    renderPrevDayTable();
    renderPatientsTable();
    renderCalendar();
  }

  // PERMISSIONS CONTROL
  function applyRolePermissions(role) {
    if (role === 'manager') {
      const navRegistro = document.querySelector('.nav-btn[data-target="screen-registro"]');
      if (navRegistro) {
        navRegistro.style.display = 'none';
        navRegistro.classList.remove('active');
      }

      const screenRegistro = document.getElementById('screen-registro');
      const screenFicha = document.getElementById('screen-ficha');
      const btnFicha = document.querySelector('.nav-btn[data-target="screen-ficha"]');

      if (screenRegistro) screenRegistro.classList.remove('active');
      if (screenFicha) screenFicha.classList.add('active');
      if (btnFicha) btnFicha.classList.add('active');

      document.body.classList.add('role-manager');
    }
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

      // Confirmação de alta
      if (ehAlta) {
        const nomeDisplay = isNovo ? nome : patients.find(p => p.id === selectedId)?.pacienteNome || 'paciente';
        if (!confirm(`Confirma a ALTA de ${nomeDisplay}?`)) {
          return;
        }
      }

      btnSubmitRegistro.disabled = true;
      btnSubmitRegistro.textContent = 'Salvando...';

      let existingIndex = -1;
      if (!isNovo) {
        existingIndex = patients.findIndex(p => p.id === selectedId);
      }

      if (existingIndex >= 0) {
        // Update existing patient
        const p = patients[existingIndex];

        let allDates = p.historico.map(h => h.data);
        if (!allDates.includes(dataVisita)) allDates.push(dataVisita);

        const sortedDates = [...allDates].sort();
        const novaPrimeira = sortedDates[0];
        const novaUltima = sortedDates[sortedDates.length - 1];

        let novoStatus = p.statusManual;
        if (ehAlta) {
          novoStatus = STATUS.ALTA;
        } else if (p.statusManual === STATUS.ALTA) {
          novoStatus = STATUS.INTERNADO;
        }

        const { error: errUpdate } = await supabaseClient.from('patients').update({
          hospital: hospital,
          internacao: internacao,
          statusmanual: novoStatus,
          dataprimeiraavaliacao: novaPrimeira,
          dataultimavisita: novaUltima,
          updated_at: new Date().toISOString()
        }).eq('id', p.id);

        if (errUpdate) {
          console.error(errUpdate);
          showToast('Erro ao salvar. Tente novamente.');
          btnSubmitRegistro.disabled = false;
          btnSubmitRegistro.textContent = 'Registrar Visita';
          return;
        }

        const hist = p.historico.find(h => h.data === dataVisita && h.medico === medico);
        if (hist) {
          const { error: errHistUpdate } = await supabaseClient.from('historico').update({ visitas: parseInt(hist.visitas, 10) + numeroVisitas }).eq('id', hist.id);
          if (errHistUpdate) { console.error(errHistUpdate); showToast('Erro ao salvar histórico.'); }
        } else {
          const { error: errHistInsert } = await supabaseClient.from('historico').insert({
            patient_id: p.id,
            data: dataVisita,
            medico: medico,
            visitas: numeroVisitas
          });
          if (errHistInsert) { console.error(errHistInsert); showToast('Erro ao salvar histórico.'); }
        }
      } else {
        // Create new patient
        const { data: newPat, error } = await supabaseClient.from('patients').insert({
          pacientenome: nome,
          hospital: hospital,
          internacao: internacao,
          statusmanual: ehAlta ? STATUS.ALTA : STATUS.INTERNADO,
          dataprimeiraavaliacao: dataVisita,
          dataultimavisita: dataVisita
        }).select().single();

        if (error) {
          console.error(error);
          showToast('Erro ao criar paciente. Tente novamente.');
          btnSubmitRegistro.disabled = false;
          btnSubmitRegistro.textContent = 'Registrar Visita';
          return;
        }

        if (newPat) {
          const { error: errHistInsert } = await supabaseClient.from('historico').insert({
            patient_id: newPat.id,
            data: dataVisita,
            medico: medico,
            visitas: numeroVisitas
          });
          if (errHistInsert) { console.error(errHistInsert); showToast('Erro ao salvar histórico.'); }
        }
      }

      await fetchAllData();

      inputNome.value = '';
      pacienteSelect.value = 'novo';
      pacienteSelect.dispatchEvent(new Event('change'));
      inputNumeroVisitas.value = '1';
      inputMarcarAlta.checked = false;

      btnSubmitRegistro.disabled = false;
      btnSubmitRegistro.textContent = 'Registrar Visita';
      showToast('Visita registrada com sucesso!');

      setupPatientSelect();
      renderPrevDayTable();
      renderPatientsTable();
      renderCalendar();
    });
  }

  function setupPatientSelect() {
    pacienteSelect.innerHTML = '<option value="novo">+ Novo Paciente</option>';

    const dataRef = inputDataVisita.value || today;

    const activePatients = patients.filter(p => {
      if (p.statusManual === STATUS.ALTA) return false;
      return diffEmDias(p.dataUltimaVisita, dataRef) <= 3;
    });

    // Deduplicar no frontend pelo nome
    const uniqueMap = new Map();
    activePatients.forEach(p => {
      const key = p.pacienteNome.trim().toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, p);
      } else {
        const existing = uniqueMap.get(key);
        if (new Date(p.dataUltimaVisita) > new Date(existing.dataUltimaVisita)) {
          uniqueMap.set(key, p);
        }
      }
    });

    const dedupPatients = Array.from(uniqueMap.values()).sort((a, b) => a.pacienteNome.localeCompare(b.pacienteNome));

    dedupPatients.forEach(p => {
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

    // Mostrar pacientes com última visita entre 1 e 5 dias atrás (em relação à data selecionada)
    const prevDayPatients = patients.filter(p => {
      if (p.statusManual === STATUS.ALTA) return false;
      if (p.dataUltimaVisita >= selectedDateStr) return false;
      const diff = diffEmDias(p.dataUltimaVisita, selectedDateStr);
      return diff >= 1 && diff <= 5;
    });

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
        <td>${esc(p.pacienteNome)}</td>
        <td>${esc(p.hospital)}</td>
        <td>
           <button class="btn-action" title="Registrar 1 visita para a data selecionada" data-action="add-visit" data-patient-id="${p.id}">➕</button>
        </td>
      `;
      prevDayTableBody.appendChild(tr);
    });
  }

  async function addVisitFromList(id) {
    const dataVisita = inputDataVisita.value;
    const medico = selectDoctor.value;

    // Prevenir race condition: desabilitar todos os botões da tabela
    const allBtns = document.querySelectorAll('#prev-day-table .btn-action');
    allBtns.forEach(b => b.disabled = true);

    try {
      const idx = patients.findIndex(pat => pat.id === id);
      if (idx > -1) {
        const p = patients[idx];
        const hist = p.historico.find(h => h.data === dataVisita && h.medico === medico);

        if (hist) {
          const { error } = await supabaseClient.from('historico').update({ visitas: parseInt(hist.visitas, 10) + 1 }).eq('id', hist.id);
          if (error) { console.error(error); showToast('Erro ao salvar. Tente novamente.'); return; }
        } else {
          const { error } = await supabaseClient.from('historico').insert({ patient_id: p.id, data: dataVisita, medico: medico, visitas: 1 });
          if (error) { console.error(error); showToast('Erro ao salvar. Tente novamente.'); return; }
        }

        let allDates = p.historico.map(h => h.data);
        if (!allDates.includes(dataVisita)) allDates.push(dataVisita);
        const sortedDates = [...allDates].sort();
        const novaUltima = sortedDates[sortedDates.length - 1];
        const novaPrimeira = sortedDates[0];

        const { error: errPat } = await supabaseClient.from('patients').update({
          dataultimavisita: novaUltima,
          dataprimeiraavaliacao: novaPrimeira,
          updated_at: new Date().toISOString()
        }).eq('id', p.id);
        if (errPat) { console.error(errPat); showToast('Erro ao salvar. Tente novamente.'); return; }

        await fetchAllData();
        renderPrevDayTable();
        renderPatientsTable();
        renderCalendar();
        setupPatientSelect();
        showToast('Visita adicionada!');
      }
    } finally {
      allBtns.forEach(b => b.disabled = false);
    }
  }

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
      const diff = diffEmDias(p.dataUltimaVisita, today);
      let isInternado = true;

      if (p.statusManual === STATUS.ALTA) {
        isInternado = false;
      } else if (diff > 3) {
        isInternado = false;
      }

      return { ...p, isInternado };
    }).filter(p => {
      const matchHosp = hospFilter === 'Todos' || p.hospital === hospFilter;
      const matchStatus = statusFilter === 'Todos' ||
        (statusFilter === STATUS.INTERNADO && p.isInternado) ||
        (statusFilter === STATUS.ALTA && !p.isInternado);
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
        valA = diasDeInternacao(a.dataPrimeiraAvaliacao, a.dataUltimaVisita);
        valB = diasDeInternacao(b.dataPrimeiraAvaliacao, b.dataUltimaVisita);
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

    const labels = ['Nome', 'Internação', 'Hospital', 'Status', '1ª Aval.', 'Última', 'Dias', 'Ações'];

    filtered.forEach(p => {
      const dias = diasDeInternacao(p.dataPrimeiraAvaliacao, p.dataUltimaVisita);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(p.pacienteNome)}</td>
        <td>${esc(p.internacao || 'Particular')}</td>
        <td>${esc(p.hospital)}</td>
        <td>
          <span class="status-badge ${p.isInternado ? 'ativo' : 'inativo'}">
            ${p.isInternado ? STATUS.INTERNADO : STATUS.ALTA}
          </span>
        </td>
        <td>${formatDateBR(p.dataPrimeiraAvaliacao)}</td>
        <td>${formatDateBR(p.dataUltimaVisita)}</td>
        <td>${dias}</td>
        <td>
           <button class="btn-action" title="Editar Nome e Hospital" data-action="edit-patient" data-patient-id="${p.id}">✏️</button>
           <button class="btn-action" title="Excluir Paciente" data-action="delete-patient" data-patient-id="${p.id}">🗑️</button>
        </td>
      `;
      // Adicionar data-label para mobile responsivo
      tr.querySelectorAll('td').forEach((td, i) => {
        td.setAttribute('data-label', labels[i] || '');
      });
      patientsTableBody.appendChild(tr);
    });
  }

  function editPatientInfo(id) {
    const p = patients.find(pat => pat.id === id);
    if (!p) return;

    currentEditingPatientId = id;
    editNome.value = p.pacienteNome;
    editHospital.value = p.hospital;
    editInternacao.value = p.internacao || 'Particular';
    editAlta.checked = p.statusManual === STATUS.ALTA;
    editDataPrimeira.value = p.dataPrimeiraAvaliacao || '';

    editModal.classList.add('active');
  }

  async function deletePatient(id) {
    const p = patients.find(pat => pat.id === id);
    if (!p) return;
    if (confirm(`Tem certeza que deseja EXCLUIR o paciente ${p.pacienteNome} de TODO o sistema? Esta ação apaga os históricos remotamente.`)) {
      const { error } = await supabaseClient.from('patients').delete().eq('id', id);
      if (error) { console.error(error); showToast('Erro ao excluir paciente.'); return; }
      await fetchAllData();
      renderPatientsTable();
      setupPatientSelect();
      renderCalendar();
    }
  }

  function setupModalListeners() {
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
            novoStatus = STATUS.ALTA;
          } else if (p.statusManual === STATUS.ALTA) {
            novoStatus = STATUS.INTERNADO;
          }

          btnSaveEdit.textContent = 'Aguarde...';
          btnSaveEdit.disabled = true;

          const { error } = await supabaseClient.from('patients').update({
            pacientenome: newNome,
            hospital: newHospital,
            internacao: newInternacao,
            statusmanual: novoStatus,
            dataprimeiraavaliacao: editDataPrimeira.value || p.dataPrimeiraAvaliacao,
            updated_at: new Date().toISOString()
          }).eq('id', p.id);

          btnSaveEdit.textContent = 'Salvar';
          btnSaveEdit.disabled = false;

          if (error) { console.error(error); showToast('Erro ao salvar. Tente novamente.'); return; }

          await fetchAllData();
          renderPatientsTable();
          setupPatientSelect();
          showToast('Paciente atualizado com sucesso!');
        } else {
          alert("O nome do paciente não pode ficar vazio.");
          return;
        }
      }
      editModal.classList.remove('active');
      currentEditingPatientId = null;
    });

    btnCancelVisit.addEventListener('click', () => {
      editVisitModal.classList.remove('active');
      currentEditingVisit = null;
    });

    btnSaveVisit.addEventListener('click', async () => {
      if (!currentEditingVisit) return;
      const { patientId, histId } = currentEditingVisit;
      const parsed = parseInt(editVisitVisitas.value, 10);
      if (isNaN(parsed) || parsed < 1) {
        showToast('Número de visitas inválido.');
        return;
      }

      btnSaveVisit.textContent = 'Aguarde...';
      btnSaveVisit.disabled = true;

      const newMedico = editVisitMedico.value;
      const p = patients.find(pat => pat.id === patientId);
      const h = p.historico.find(hi => hi.id === histId);

      if (h.medico !== newMedico) {
        const existingForNewDoc = p.historico.find(hi => hi.data === h.data && hi.medico === newMedico && hi.id !== histId);
        if (existingForNewDoc) {
          const { error: e1 } = await supabaseClient.from('historico').update({ visitas: parseInt(existingForNewDoc.visitas, 10) + parsed }).eq('id', existingForNewDoc.id);
          if (e1) { console.error(e1); showToast('Erro ao salvar. Tente novamente.'); }
          const { error: e2 } = await supabaseClient.from('historico').delete().eq('id', histId);
          if (e2) { console.error(e2); }
        } else {
          const { error: e1 } = await supabaseClient.from('historico').insert({ patient_id: patientId, data: h.data, medico: newMedico, visitas: parsed });
          if (e1) { console.error(e1); showToast('Erro ao salvar. Tente novamente.'); }
          const { error: e2 } = await supabaseClient.from('historico').delete().eq('id', histId);
          if (e2) { console.error(e2); }
        }
      } else {
        const { error } = await supabaseClient.from('historico').update({ visitas: parsed }).eq('id', histId);
        if (error) { console.error(error); showToast('Erro ao salvar. Tente novamente.'); }
      }

      await fetchAllData();
      renderCalendar();
      showToast('Visita atualizada com sucesso!');

      btnSaveVisit.textContent = 'Salvar';
      btnSaveVisit.disabled = false;
      editVisitModal.classList.remove('active');
      currentEditingVisit = null;
    });
  }

  function exportCSV() {
    let csvContent = "Nome,Internação,Hospital,Status,Primeira Avaliacao,Ultima Visita,Dias de Internacao\n";
    patients.forEach(p => {
      const dias = diasDeInternacao(p.dataPrimeiraAvaliacao, p.dataUltimaVisita);
      let isInternado = true;
      if (p.statusManual === STATUS.ALTA) {
        isInternado = false;
      } else if (diffEmDias(p.dataUltimaVisita, today) > 3) {
        isInternado = false;
      }
      const statusStr = isInternado ? STATUS.INTERNADO : STATUS.ALTA;
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
    const visitsByDoctor = {};

    patients.forEach(p => {
      if (!p.historico) return;
      p.historico.forEach((h) => {
        if (h.data.startsWith(monthFilter)) {
          if (!visitsByDate[h.data]) visitsByDate[h.data] = {};
          if (!visitsByDate[h.data][h.medico]) visitsByDate[h.data][h.medico] = [];
          visitsByDate[h.data][h.medico].push({
            patientId: p.id,
            histId: h.id,
            pacienteNome: p.pacienteNome,
            hospital: p.hospital,
            visitas: h.visitas
          });

          if (!visitsByDoctor[h.medico]) visitsByDoctor[h.medico] = 0;
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
        html += `<span class="cal-doctor ${docClass}">${esc(doc)}</span>`;
        html += `<div style="margin-top: 0.5rem;">`;

        docsInDate[doc].forEach(record => {
          dailyTotal += parseInt(record.visitas, 10);
          const visitCountIndicator = record.visitas > 1 ? ` (${record.visitas})` : '';
          html += `<div class="cal-patient">
                     <strong>${esc(record.pacienteNome)}${visitCountIndicator}</strong>
                     <span>${esc(record.hospital)}</span>
                     <div class="cal-actions" style="margin-top: 5px; text-align: right;">
                        <button class="btn-action" title="Editar Visita" data-action="edit-visit" data-patient-id="${record.patientId}" data-hist-id="${record.histId}">✏️</button>
                        <button class="btn-action" title="Excluir Visita" data-action="delete-visit" data-patient-id="${record.patientId}" data-hist-id="${record.histId}">🗑️</button>
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
        <td><strong>${esc(doc)}</strong></td>
        <td>${visitsByDoctor[doc]}</td>
      `;
      summaryTableBody.appendChild(tr);
    });
  }

  function editVisit(patientId, histId) {
    const numericHistId = parseInt(histId, 10);
    const p = patients.find(pat => pat.id === patientId);
    if (!p || !p.historico) return;
    const h = p.historico.find(hi => hi.id === numericHistId);
    if (!h) return;

    currentEditingVisit = { patientId, histId: numericHistId };
    editVisitPatientLabel.textContent = `${p.pacienteNome} — ${h.data}`;
    editVisitMedico.value = h.medico;
    editVisitVisitas.value = h.visitas;

    editVisitModal.classList.add('active');
  }

  async function deleteVisit(patientId, histId) {
    const numericHistId = parseInt(histId, 10);
    const p = patients.find(pat => pat.id === patientId);
    if (!p || !p.historico) return;
    const h = p.historico.find(hi => hi.id === numericHistId);
    if (!h) return;

    if (confirm(`Remover o registro de ${p.pacienteNome} do dia ${h.data}?`)) {
      const { error: errDel } = await supabaseClient.from('historico').delete().eq('id', numericHistId);
      if (errDel) { console.error(errDel); showToast('Erro ao excluir visita.'); return; }

      const arrayLimitado = p.historico.filter(hi => hi.id !== numericHistId);

      if (arrayLimitado.length === 0) {
        if (confirm(`O paciente ${p.pacienteNome} ficou sem histórico de visitas. Deseja excluí-lo do sistema também?`)) {
          const { error } = await supabaseClient.from('patients').delete().eq('id', patientId);
          if (error) { console.error(error); showToast('Erro ao excluir paciente.'); }
        } else {
          await supabaseClient.from('patients').update({
            dataprimeiraavaliacao: null,
            dataultimavisita: null
          }).eq('id', patientId);
        }
      } else {
        const sortedDates = [...arrayLimitado.map(x => x.data)].sort();
        const novaUltima = sortedDates[sortedDates.length - 1] || null;
        const novaPrimeira = sortedDates[0] || novaUltima;

        const { error } = await supabaseClient.from('patients').update({
          dataprimeiraavaliacao: novaPrimeira,
          dataultimavisita: novaUltima
        }).eq('id', patientId);
        if (error) { console.error(error); showToast('Erro ao atualizar datas do paciente.'); }
      }

      await fetchAllData();
      renderCalendar();
      renderPatientsTable();
    }
  }

  // Event delegation unificada — substitui todos os onclick inline e window.*
  function setupEventDelegation() {
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const patientId = btn.dataset.patientId;
      const histId = btn.dataset.histId ? parseInt(btn.dataset.histId, 10) : null;

      switch (action) {
        case 'edit-patient': editPatientInfo(patientId); break;
        case 'delete-patient': await deletePatient(patientId); break;
        case 'add-visit': await addVisitFromList(patientId); break;
        case 'edit-visit': editVisit(patientId, histId); break;
        case 'delete-visit': await deleteVisit(patientId, histId); break;
      }
    });
  }

  // EXECUTE INITIALIZATION
  init();

});
