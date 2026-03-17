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
  const DAYS_ACTIVE_THRESHOLD = 5;

  // STATE
  let patients = [];
  let relatoriosSet = new Set(); // patient_ids com relatório salvo
  let currentSort = { column: 'dataUltimaVisita', dir: 'desc' };
  let isProcessing = false;

  // DOM Elements - Navigation
  const navBtns = document.querySelectorAll('.nav-btn:not(#btn-logout)');
  const screens = document.querySelectorAll('.screen');

  // DOM Elements - Screen 1 (Registro)
  const formRegistro = document.getElementById('registro-form');
  const pacienteInput = document.getElementById('pacienteInput');
  const suggestionsBox = document.getElementById('suggestions-box');
  const selectedPatientId = document.getElementById('selectedPatientId');
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
  const filterSearch = document.getElementById('filter-search');
  const filterInternacao = document.getElementById('filter-internacao');
  const filterHospital = document.getElementById('filter-hospital');
  const filterStatus = document.getElementById('filter-status');
  const filterStartDate = document.getElementById('filter-start-date');
  const filterEndDate = document.getElementById('filter-end-date');
  const btnExport = document.getElementById('btn-export');
  const thSortables = document.querySelectorAll('th[data-sort]');

  // DOM Elements - Screen 3 (Calendario)
  const filterCalStartDate = document.getElementById('filter-cal-start-date');
  const filterCalEndDate = document.getElementById('filter-cal-end-date');
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

  // DOM Elements - Relatório Modal
  const relatorioModal = document.getElementById('relatorio-modal');
  const relatorioModalTitle = document.getElementById('relatorio-modal-title');
  const relatorioModalSubtitle = document.getElementById('relatorio-modal-subtitle');
  const relatorioTextarea = document.getElementById('relatorio-texto');
  const relatorioCid10Input = document.getElementById('relatorio-cid10');
  const btnGerarRelatorio = document.getElementById('btn-gerar-relatorio');
  const btnCopiarRelatorio = document.getElementById('btn-copiar-relatorio');
  const btnSalvarRelatorio = document.getElementById('btn-salvar-relatorio');
  const btnExcluirRelatorio = document.getElementById('btn-excluir-relatorio');
  const btnFecharRelatorio = document.getElementById('btn-fechar-relatorio');
  let currentRelatorioPatientId = null;

  if (userRole === 'manager') {
    relatorioTextarea.readOnly = true;
    relatorioCid10Input.readOnly = true;
  }

  // Set default date to today
  const todayDateObj = new Date();
  const today = `${todayDateObj.getFullYear()}-${String(todayDateObj.getMonth() + 1).padStart(2, '0')}-${String(todayDateObj.getDate()).padStart(2, '0')}`;
  const firstDayOfMonth = `${todayDateObj.getFullYear()}-${String(todayDateObj.getMonth() + 1).padStart(2, '0')}-01`;

  inputDataVisita.value = today;
  inputDataVisita.setAttribute('max', today);

  if (filterStartDate) filterStartDate.value = firstDayOfMonth;
  if (filterEndDate) filterEndDate.value = today;
  if (filterCalStartDate) filterCalStartDate.value = firstDayOfMonth;
  if (filterCalEndDate) filterCalEndDate.value = today;

  // --- CORE UTILS ---

  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escAttr(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

  function showConfirm(message, title = 'Confirmação') {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirm-modal');
      const msgEl = document.getElementById('confirm-message');
      const titleEl = document.getElementById('confirm-title');
      const btnYes = document.getElementById('confirm-yes');
      const btnNo = document.getElementById('confirm-no');

      titleEl.textContent = title;
      msgEl.textContent = message;
      modal.classList.add('active');

      function cleanup() {
        modal.classList.remove('active');
        btnYes.removeEventListener('click', onYes);
        btnNo.removeEventListener('click', onNo);
        modal.removeEventListener('click', onBackdrop);
      }

      function onYes() { cleanup(); resolve(true); }
      function onNo() { cleanup(); resolve(false); }
      function onBackdrop(e) { if (e.target === modal) { cleanup(); resolve(false); } }

      btnYes.addEventListener('click', onYes);
      btnNo.addEventListener('click', onNo);
      modal.addEventListener('click', onBackdrop);
    });
  }

  function handleSupabaseError(error, context = '') {
    console.error(`[AppHosp] ${context}:`, error);

    const code = error?.code || '';
    const message = error?.message || '';

    if (code === '42501' || message.includes('policy')) {
      showToast('Sem permissão para esta ação. Contate o administrador.');
      return;
    }
    if (code === '23505') {
      showToast('Registro duplicado detectado. Verifique os dados.');
      return;
    }
    if (message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('ERR_NETWORK')) {
      showToast('Erro de conexão. Verifique sua internet e tente novamente.');
      return;
    }
    if (code === '23503') {
      showToast('Erro de referência: o registro vinculado não existe mais.');
      return;
    }

    showToast(context ? `Erro ao ${context}. Tente novamente.` : 'Erro inesperado. Tente novamente.');
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
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function isPatientActive(patient, referenceDate) {
    if (patient.statusManual === STATUS.ALTA) return false;
    if (diffEmDias(patient.dataUltimaVisita, referenceDate) > DAYS_ACTIVE_THRESHOLD) return false;
    return true;
  }

  async function recalcPatientDates(patientId) {
    const { data: histData, error: errHist } = await supabaseClient
      .from('historico')
      .select('data')
      .eq('patient_id', patientId);

    if (errHist) {
      handleSupabaseError(errHist, 'recalcular datas do paciente');
      return { error: errHist };
    }

    let novaPrimeira = null;
    let novaUltima = null;

    if (histData && histData.length > 0) {
      const dates = histData.map(h => h.data).sort();
      novaPrimeira = dates[0];
      novaUltima = dates[dates.length - 1];
    }

    const { error: errUpdate } = await supabaseClient.from('patients').update({
      dataprimeiraavaliacao: novaPrimeira,
      dataultimavisita: novaUltima
    }).eq('id', patientId);

    if (errUpdate) handleSupabaseError(errUpdate, 'recalcular datas do paciente');
    return { error: errUpdate };
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
      pacienteNome: dbPat.pacientenome || '(Sem nome)',
      hospital: dbPat.hospital,
      internacao: dbPat.internacao,
      statusManual: dbPat.statusmanual,
      dataPrimeiraAvaliacao: dbPat.dataprimeiraavaliacao,
      dataUltimaVisita: dbPat.dataultimavisita,
      historico: dbPat.historico || []
    };
  }

  async function fetchAllData() {
    const { data: patientsData, error: errPat } = await supabaseClient
      .from('patients')
      .select('*');

    const { data: histData, error: errHist } = await supabaseClient
      .from('historico')
      .select('id, patient_id, data, medico, visitas');

    const { data: relData } = await supabaseClient
      .from('relatorios')
      .select('patient_id');

    if (errPat) { handleSupabaseError(errPat, 'carregar os dados'); return; }
    if (errHist) { handleSupabaseError(errHist, 'carregar os dados'); return; }

    relatoriosSet = new Set((relData || []).map(r => r.patient_id));

    const historicoMap = new Map();
    if (histData) {
      histData.forEach(h => {
        if (!historicoMap.has(h.patient_id)) {
          historicoMap.set(h.patient_id, []);
        }
        historicoMap.get(h.patient_id).push(h);
      });
    }

    patients = patientsData.map(p => ({
      ...mapPatient(p),
      historico: historicoMap.get(p.id) || []
    }));
  }

  async function init() {
    await fetchAllData();

    // Remover loader
    const loader = document.getElementById('app-loader');
    if (loader) loader.remove();

    // Popular selects estáticos a partir das constantes (fonte única de verdade)
    populateSelect(selectDoctor, DOCTORS);
    populateSelect(inputHospital, HOSPITALS);
    populateSelect(inputInternacao, INTERNACAO_TYPES);
    populateSelect(filterHospital, HOSPITALS, { includeAll: true, allLabel: 'Todos os Hospitais' });
    if (filterInternacao) populateSelect(filterInternacao, INTERNACAO_TYPES, { includeAll: true, allLabel: 'Todas as Internações' });
    // filter-status: labels diferem dos values ("Internados" / "Altas"), criado manualmente
    filterStatus.innerHTML = '';
    filterStatus.appendChild(new Option('Todos os Status', 'Todos'));
    filterStatus.appendChild(new Option('Internados', STATUS.INTERNADO));
    filterStatus.appendChild(new Option('Altas', STATUS.ALTA));
    filterStatus.value = STATUS.INTERNADO;
    populateSelect(editHospital, HOSPITALS);
    populateSelect(editInternacao, INTERNACAO_TYPES);
    populateSelect(editVisitMedico, DOCTORS);

    const savedDoctor = localStorage.getItem('apphosp_doctor');
    if (savedDoctor && DOCTORS.includes(savedDoctor)) {
      selectDoctor.value = savedDoctor;
    }
    selectDoctor.addEventListener('change', () => {
      localStorage.setItem('apphosp_doctor', selectDoctor.value);
      renderPrevDayTable();
    });

    inputDataVisita.addEventListener('change', () => {
      renderPrevDayTable();
    });

    setupNavigation();
    setupAutocomplete();
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
  async function createPatientWithVisit({ nome, hospital, internacao, ehAlta, dataVisita, numeroVisitas, medico }) {
    const { data: newPat, error } = await supabaseClient.from('patients').insert({
      pacientenome: nome,
      hospital: hospital,
      internacao: internacao,
      statusmanual: ehAlta ? STATUS.ALTA : STATUS.INTERNADO,
      dataprimeiraavaliacao: dataVisita,
      dataultimavisita: dataVisita
    }).select().single();

    if (error) {
      handleSupabaseError(error, 'criar paciente');
      return { success: false };
    }

    if (newPat) {
      const { error: errHistInsert } = await supabaseClient.from('historico').insert({
        patient_id: newPat.id,
        data: dataVisita,
        medico: medico,
        visitas: numeroVisitas
      });
      if (errHistInsert) handleSupabaseError(errHistInsert, 'salvar histórico');
    }
    return { success: true, patientId: newPat?.id };
  }

  async function addVisitToExistingPatient({ selectedId, hospital, internacao, ehAlta, dataVisita, numeroVisitas, medico }) {
    const p = patients.find(pat => pat.id === selectedId);
    if (!p) return { success: false };

    let novoStatus = p.statusManual;
    if (ehAlta) {
      novoStatus = STATUS.ALTA;
    } else if (p.statusManual === STATUS.ALTA) {
      novoStatus = STATUS.INTERNADO;
    }

    const { error: errUpdate } = await supabaseClient.from('patients').update({
      hospital: hospital,
      internacao: internacao,
      statusmanual: novoStatus
    }).eq('id', p.id);

    if (errUpdate) {
      handleSupabaseError(errUpdate, 'atualizar paciente');
      return { success: false };
    }

    const hist = p.historico.find(h => h.data === dataVisita && h.medico === medico);
    if (hist) {
      const { error: errHistUpdate } = await supabaseClient.from('historico').update({ visitas: parseInt(hist.visitas, 10) + numeroVisitas }).eq('id', hist.id);
      if (errHistUpdate) handleSupabaseError(errHistUpdate, 'salvar histórico');
    } else {
      const { error: errHistInsert } = await supabaseClient.from('historico').insert({
        patient_id: p.id,
        data: dataVisita,
        medico: medico,
        visitas: numeroVisitas
      });
      if (errHistInsert) handleSupabaseError(errHistInsert, 'salvar histórico');
    }

    await recalcPatientDates(p.id);
    return { success: true, patientId: p.id };
  }

  function setupForm() {
    formRegistro.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (isProcessing) return;
      isProcessing = true;

      try {
        const selectedId = selectedPatientId.value;
        const isNovo = !selectedId;
        const nome = pacienteInput.value.trim();

        if (isNovo && !nome) {
          showToast('Digite o nome do paciente.');
          return;
        }

        const hospital = inputHospital.value;
        const internacao = inputInternacao.value;
        const ehAlta = inputMarcarAlta.checked;
        const dataVisita = inputDataVisita.value;
        let numeroVisitas = parseInt(inputNumeroVisitas.value, 10) || 1;
        if (numeroVisitas > 3) numeroVisitas = 3;
        const medico = selectDoctor.value;

        if (ehAlta) {
          const nomeDisplay = isNovo ? nome : patients.find(p => p.id === selectedId)?.pacienteNome || 'paciente';
          if (!(await showConfirm(`Confirma a ALTA de ${nomeDisplay}?`, 'Alta Hospitalar'))) { return; }
        }

        btnSubmitRegistro.disabled = true;
        btnSubmitRegistro.textContent = 'Salvando...';

        let result;
        if (isNovo) {
          result = await createPatientWithVisit({ nome, hospital, internacao, ehAlta, dataVisita, numeroVisitas, medico });
        } else {
          result = await addVisitToExistingPatient({ selectedId, hospital, internacao, ehAlta, dataVisita, numeroVisitas, medico });
        }

        if (result && result.success) {
          await fetchAllData();

          pacienteInput.value = '';
          selectedPatientId.value = '';
          inputNumeroVisitas.value = '1';
          inputMarcarAlta.checked = false;

          const altaSection = document.getElementById('alta-section');
          if (altaSection) altaSection.removeAttribute('open');

          showToast('Visita registrada com sucesso!');
          renderPrevDayTable();
          renderPatientsTable();
          renderCalendar();

          if (ehAlta && result.patientId) {
            await offerRelatorioAposAlta(result.patientId);
          }
        }
      } finally {
        isProcessing = false;
        btnSubmitRegistro.disabled = false;
        btnSubmitRegistro.textContent = 'Registrar Visita';
      }
    });
  }

  function setupAutocomplete() {
    let debounceTimer = null;

    pacienteInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      selectedPatientId.value = ''; // Resetar seleção ao digitar

      debounceTimer = setTimeout(() => {
        const query = pacienteInput.value.trim().toLowerCase();

        if (query.length < 2) {
          suggestionsBox.style.display = 'none';
          suggestionsBox.innerHTML = '';
          return;
        }

        const dataRef = inputDataVisita.value || today;

        // Filtrar pacientes ativos que batem com a busca
        const matches = patients.filter(p => {
          if (!isPatientActive(p, dataRef)) return false;
          return p.pacienteNome.toLowerCase().includes(query);
        });

        // Deduplicar pelo nome (manter o mais recente)
        const uniqueMap = new Map();
        matches.forEach(p => {
          const key = p.pacienteNome.trim().toLowerCase();
          if (!uniqueMap.has(key) || new Date(p.dataUltimaVisita) > new Date(uniqueMap.get(key).dataUltimaVisita)) {
            uniqueMap.set(key, p);
          }
        });

        const dedupMatches = Array.from(uniqueMap.values()).sort((a, b) => a.pacienteNome.localeCompare(b.pacienteNome));

        if (dedupMatches.length === 0) {
          suggestionsBox.style.display = 'none';
          suggestionsBox.innerHTML = '';
          return;
        }

        suggestionsBox.innerHTML = '';
        dedupMatches.forEach(p => {
          const item = document.createElement('div');
          item.className = 'suggestion-item';
          item.innerHTML = `${esc(p.pacienteNome)} <span class="suggestion-meta">${esc(p.hospital)} · ${esc(p.internacao || 'Particular')}</span>`;
          item.addEventListener('click', () => {
            pacienteInput.value = p.pacienteNome;
            selectedPatientId.value = p.id;
            inputHospital.value = p.hospital;
            if (p.internacao) inputInternacao.value = p.internacao;
            suggestionsBox.style.display = 'none';
            suggestionsBox.innerHTML = '';
          });
          suggestionsBox.appendChild(item);
        });

        suggestionsBox.style.display = 'block';
      }, 250); // Debounce 250ms
    });

    // Fechar sugestões ao clicar fora
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-container')) {
        suggestionsBox.style.display = 'none';
      }
    });

    // Fechar sugestões com Escape
    pacienteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        suggestionsBox.style.display = 'none';
      }
    });
  }

  function renderPrevDayTable() {
    prevDayTableBody.innerHTML = '';
    const selectedDateStr = inputDataVisita.value;
    if (!selectedDateStr) return;

    const shortcutContext = document.getElementById('shortcut-context');
    if (shortcutContext) {
      shortcutContext.textContent = `Visita será registrada para ${selectDoctor.value} em ${formatDateBR(inputDataVisita.value)}`;
    }

    // Mostrar pacientes com última visita entre 1 e limite dias atrás
    const prevDayPatients = patients.filter(p => {
      if (!isPatientActive(p, selectedDateStr)) return false;
      if (p.dataUltimaVisita >= selectedDateStr) return false;
      const diff = diffEmDias(p.dataUltimaVisita, selectedDateStr);
      return diff >= 1 && diff <= DAYS_ACTIVE_THRESHOLD;
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
        <td class="col-actions">
           <button class="btn-action" title="Registrar 1 visita para a data selecionada" data-action="add-visit" data-patient-id="${escAttr(p.id)}">➕</button>
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
          if (error) { handleSupabaseError(error, 'adicionar visita'); return; }
        } else {
          const { error } = await supabaseClient.from('historico').insert({ patient_id: p.id, data: dataVisita, medico: medico, visitas: 1 });
          if (error) { handleSupabaseError(error, 'adicionar visita'); return; }
        }

        await recalcPatientDates(p.id);

        await fetchAllData();
        renderPrevDayTable();
        renderPatientsTable();
        renderCalendar();
        showToast('Visita adicionada!');
      }
    } finally {
      allBtns.forEach(b => b.disabled = false);
    }
  }

  // SCREEN 2: FICHA DE PACIENTES
  function setupFichaFilters() {
    filterSearch.addEventListener('input', renderPatientsTable);
    if (filterInternacao) filterInternacao.addEventListener('change', renderPatientsTable);
    filterHospital.addEventListener('change', renderPatientsTable);
    if (filterStatus) filterStatus.addEventListener('change', renderPatientsTable);
    if (filterStartDate) filterStartDate.addEventListener('change', renderPatientsTable);
    if (filterEndDate) filterEndDate.addEventListener('change', renderPatientsTable);
    btnExport.addEventListener('click', exportCSV);
  }

  function getFilteredPatients() {
    const hospFilter = filterHospital.value;
    const internacaoFilter = filterInternacao ? filterInternacao.value : 'Todos';
    const statusFilter = filterStatus ? filterStatus.value : 'Todos';
    const searchQuery = filterSearch.value.trim().toLowerCase();

    const startStr = filterStartDate ? filterStartDate.value : '';
    const endStr = filterEndDate ? filterEndDate.value : '';

    return patients.map(p => {
      const isInternado = isPatientActive(p, today);
      return { ...p, isInternado };
    }).filter(p => {
      const matchHosp = hospFilter === 'Todos' || p.hospital === hospFilter;
      const patientInternacao = p.internacao || 'Particular';
      const matchInternacao = internacaoFilter === 'Todos' || patientInternacao === internacaoFilter;
      const matchStatus = statusFilter === 'Todos' ||
        (statusFilter === STATUS.INTERNADO && p.isInternado) ||
        (statusFilter === STATUS.ALTA && !p.isInternado);
      const matchSearch = !searchQuery || p.pacienteNome.toLowerCase().includes(searchQuery);

      let matchDate = true;
      if (startStr || endStr) {
        if (!p.historico || p.historico.length === 0) {
          matchDate = false;
        } else {
          matchDate = p.historico.some(h => {
            if (startStr && h.data < startStr) return false;
            if (endStr && h.data > endStr) return false;
            return true;
          });
        }
      }

      return matchHosp && matchInternacao && matchStatus && matchSearch && matchDate;
    });
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
    const filtered = getFilteredPatients();

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

    const labels = ['Nome', 'Internação', 'Hospital', 'Status', '1ª Aval.', 'Última', 'Dias', 'Relatório', ''];

    filtered.forEach(p => {
      const dias = diasDeInternacao(p.dataPrimeiraAvaliacao, p.dataUltimaVisita);
      const temRelatorio = relatoriosSet.has(p.id);
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
        <td style="text-align:center; font-size:1.1rem; color:${temRelatorio ? '#2e7d32' : '#c62828'};">${temRelatorio ? '✓' : '✗'}</td>
        <td class="col-actions">
<button class="btn-action" title="Relatório de Internação" data-action="view-relatorio" data-patient-id="${escAttr(p.id)}">📋</button>
<button class="btn-action" title="Editar Nome e Hospital" data-action="edit-patient" data-patient-id="${escAttr(p.id)}">✏️</button>
           <button class="btn-action" title="Excluir Paciente" data-action="delete-patient" data-patient-id="${escAttr(p.id)}">🗑️</button>
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
    if (await showConfirm(`Tem certeza que deseja EXCLUIR o paciente ${esc(p.pacienteNome)} de TODO o sistema? Esta ação apaga os históricos remotamente.`, 'Excluir Paciente')) {
      const { error } = await supabaseClient.from('patients').delete().eq('id', id);
      if (error) { handleSupabaseError(error, 'excluir paciente'); return; }
      await fetchAllData();
      renderPatientsTable();
      renderCalendar();
      showToast('Paciente excluído com sucesso.');
    }
  }


  async function offerRelatorioAposAlta(patientId) {
    if (await showConfirm('Deseja preencher o relatório de alta agora?', 'Relatório de Alta')) {
      await openRelatorioModal(patientId);
    }
  }

  function generateReportText(p, textoLivre = '') {
    const HOSPITAL_NAMES = {
      'HVNS': 'Hospital Vila Nova Star',
      'HSL': 'Hospital Sírio-Libanês',
      'H9J': 'Hospital 9 de Julho',
      'Outro': 'Outro'
    };
    const DOCTOR_TITLES = {
      'Beatriz': 'Dra. Beatriz',
      'Eduardo': 'Dr. Eduardo',
      'Felipe Reinaldo': 'Dr. Felipe Reinaldo',
      'Igor': 'Dr. Igor',
      'Tamires': 'Dra. Tamires'
    };
    const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

    const nome = p.pacienteNome || '';
    const hospital = HOSPITAL_NAMES[p.hospital] || p.hospital || '';
    const dataInicio = formatDateBR(p.dataPrimeiraAvaliacao);
    const dataFim = formatDateBR(p.dataUltimaVisita);

    const historico = p.historico || [];
    const totalVisitas = historico.reduce((sum, h) => sum + (parseInt(h.visitas, 10) || 0), 0);
    const medicos = [...new Set(historico.map(h => h.medico).filter(Boolean))]
      .sort()
      .map(m => DOCTOR_TITLES[m] || m)
      .join(', ');

    const cid10 = relatorioCid10Input.value.trim();
    const hoje = new Date();
    const dataExtenso = `${hoje.getDate()} de ${MESES[hoje.getMonth()]} de ${hoje.getFullYear()}`;

    const corpoTexto = textoLivre ? `\n${textoLivre}\n` : '\n';

    return `RELATÓRIO DE INTERNAÇÃO HOSPITALAR
Paciente: ${nome}
Hospital: ${hospital}
Período: ${dataInicio} a ${dataFim}
Total de visitas: ${totalVisitas}
${corpoTexto}
Recebeu visitas de Dra Samira Apóstolos e equipe médica - ${medicos || '—'}

CID-10: ${cid10}

São Paulo, ${dataExtenso}`;
  }

  async function loadRelatorio(patientId) {
    const { data, error } = await supabaseClient
      .from('relatorios')
      .select('cid10, texto')
      .eq('patient_id', patientId)
      .maybeSingle();

    if (error) { console.error('Erro ao carregar relatório:', error); return; }

    relatorioCid10Input.value = data?.cid10 || '';
    relatorioTextarea.value = data?.texto || '';
  }

  async function saveRelatorio(patientId) {
    const cid10 = relatorioCid10Input.value.trim();
    const texto = relatorioTextarea.value;

    const { error } = await supabaseClient
      .from('relatorios')
      .upsert({ patient_id: patientId, cid10, texto, updated_at: new Date().toISOString() },
               { onConflict: 'patient_id' });

    if (error) { handleSupabaseError(error, 'salvar relatório'); return; }
    relatoriosSet.add(patientId);
    btnExcluirRelatorio.style.display = '';
    renderPatientsTable();
    showToast('Relatório salvo!');
  }

  async function openRelatorioModal(patientId) {
    const p = patients.find(pat => pat.id === patientId);
    if (!p) return;

    currentRelatorioPatientId = patientId;
    relatorioModalSubtitle.textContent = `${p.pacienteNome} — ${p.hospital}`;
    relatorioCid10Input.value = '';
    relatorioTextarea.value = '';

    await loadRelatorio(patientId);
    btnExcluirRelatorio.style.display = relatoriosSet.has(patientId) ? '' : 'none';
    relatorioModal.classList.add('active');
  }

  function setupModalListeners() {
    btnCancelEdit.addEventListener('click', () => {
      editModal.classList.remove('active');
      currentEditingPatientId = null;
    });

    btnSaveEdit.addEventListener('click', async () => {
      if (isProcessing) return;
      if (!currentEditingPatientId) return;

      const p = patients.find(pat => pat.id === currentEditingPatientId);
      if (p) {
        const newNome = editNome.value.trim();
        const newHospital = editHospital.value;
        const newInternacao = editInternacao.value;
        const ehAlta = editAlta.checked;

        if (newNome) {
          isProcessing = true;
          let novoStatus = p.statusManual;
          if (ehAlta) {
            novoStatus = STATUS.ALTA;
          } else if (p.statusManual === STATUS.ALTA) {
            novoStatus = STATUS.INTERNADO;
          }

          btnSaveEdit.textContent = 'Aguarde...';
          btnSaveEdit.disabled = true;

          try {
            const { error } = await supabaseClient.from('patients').update({
              pacientenome: newNome,
              hospital: newHospital,
              internacao: newInternacao,
              statusmanual: novoStatus,
              dataprimeiraavaliacao: editDataPrimeira.value || p.dataPrimeiraAvaliacao
            }).eq('id', p.id);

            if (error) {
              handleSupabaseError(error, 'salvar edição');
              return;
            }

            await recalcPatientDates(p.id);
            await fetchAllData();
            renderPatientsTable();
            showToast('Paciente atualizado!');

            const virandoAlta = ehAlta && p.statusManual !== STATUS.ALTA;
            editModal.classList.remove('active');
            currentEditingPatientId = null;
            if (virandoAlta) await offerRelatorioAposAlta(p.id);
          } finally {
            isProcessing = false;
            btnSaveEdit.textContent = 'Salvar';
            btnSaveEdit.disabled = false;
          }
          return;
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

    btnFecharRelatorio.addEventListener('click', () => {
      relatorioModal.classList.remove('active');
      currentRelatorioPatientId = null;
    });

    btnExcluirRelatorio.addEventListener('click', async () => {
      if (!currentRelatorioPatientId || isProcessing) return;
      if (!(await showConfirm('Deseja excluir o relatório deste paciente?', 'Excluir Relatório'))) return;
      isProcessing = true;
      try {
        const { error } = await supabaseClient.from('relatorios').delete().eq('patient_id', currentRelatorioPatientId);
        if (error) { handleSupabaseError(error, 'excluir relatório'); return; }
        relatoriosSet.delete(currentRelatorioPatientId);
        relatorioCid10Input.value = '';
        relatorioTextarea.value = '';
        btnExcluirRelatorio.style.display = 'none';
        renderPatientsTable();
        showToast('Relatório excluído.');
      } finally {
        isProcessing = false;
      }
    });

    relatorioModal.addEventListener('click', (e) => {
      if (e.target === relatorioModal) {
        relatorioModal.classList.remove('active');
        currentRelatorioPatientId = null;
      }
    });

    btnGerarRelatorio.addEventListener('click', () => {
      if (!currentRelatorioPatientId) return;
      const p = patients.find(pat => pat.id === currentRelatorioPatientId);
      if (!p) return;

      // Preserva o texto livre digitado entre "Total de visitas" e "Recebeu visitas"
      let textoLivre = '';
      const atual = relatorioTextarea.value.trim();
      const idxRecebeu = atual.indexOf('\nRecebeu visitas de');
      const idxTotal = atual.indexOf('Total de visitas:');
      if (idxTotal > -1 && idxRecebeu > -1) {
        // Template já gerado — extrai só o trecho do meio
        const aposTotal = atual.indexOf('\n', idxTotal) + 1;
        textoLivre = atual.slice(aposTotal, idxRecebeu).trim();
      } else {
        // Usuário digitou texto sem template — usa tudo como texto livre
        textoLivre = atual;
      }

      relatorioTextarea.value = generateReportText(p, textoLivre);
    });

    btnCopiarRelatorio.addEventListener('click', () => {
      const text = relatorioTextarea.value;
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => showToast('Copiado!')).catch(() => showToast('Erro ao copiar.'));
    });

    btnSalvarRelatorio.addEventListener('click', async () => {
      if (!currentRelatorioPatientId || isProcessing) return;
      isProcessing = true;
      btnSalvarRelatorio.textContent = 'Salvando...';
      btnSalvarRelatorio.disabled = true;
      try {
        await saveRelatorio(currentRelatorioPatientId);
      } finally {
        isProcessing = false;
        btnSalvarRelatorio.textContent = 'Salvar';
        btnSalvarRelatorio.disabled = false;
      }
    });

    btnSaveVisit.addEventListener('click', async () => {
      if (isProcessing) return;
      if (!currentEditingVisit) return;
      const { patientId, histId } = currentEditingVisit;
      const parsed = parseInt(editVisitVisitas.value, 10);
      if (isNaN(parsed) || parsed < 1) {
        showToast('Número de visitas inválido.');
        return;
      }

      isProcessing = true;
      btnSaveVisit.textContent = 'Aguarde...';
      btnSaveVisit.disabled = true;

      try {
        const newMedico = editVisitMedico.value;
        const p = patients.find(pat => pat.id === patientId);
        const h = p.historico.find(hi => hi.id === histId);

        if (h.medico !== newMedico) {
          const existingForNewDoc = p.historico.find(hi => hi.data === h.data && hi.medico === newMedico && hi.id !== histId);
          if (existingForNewDoc) {
            const { error: e1 } = await supabaseClient.from('historico').update({ visitas: parseInt(existingForNewDoc.visitas, 10) + parsed }).eq('id', existingForNewDoc.id);
            if (e1) { handleSupabaseError(e1, 'salvar visita'); return; }
            const { error: e2 } = await supabaseClient.from('historico').delete().eq('id', histId);
            if (e2) console.error(e2);
          } else {
            const { error: e1 } = await supabaseClient.from('historico').insert({ patient_id: patientId, data: h.data, medico: newMedico, visitas: parsed });
            if (e1) { handleSupabaseError(e1, 'salvar visita'); return; }
            const { error: e2 } = await supabaseClient.from('historico').delete().eq('id', histId);
            if (e2) console.error(e2);
          }
        } else {
          const { error } = await supabaseClient.from('historico').update({ visitas: parsed }).eq('id', histId);
          if (error) { handleSupabaseError(error, 'salvar visita'); return; }
        }

        await fetchAllData();
        renderCalendar();
        showToast('Visita atualizada com sucesso!');
      } finally {
        isProcessing = false;
        btnSaveVisit.textContent = 'Salvar';
        btnSaveVisit.disabled = false;
        editVisitModal.classList.remove('active');
        currentEditingVisit = null;
      }
    });

    // Fechar modais ao clicar no backdrop (overlay)
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) {
        editModal.classList.remove('active');
        currentEditingPatientId = null;
      }
    });

    editVisitModal.addEventListener('click', (e) => {
      if (e.target === editVisitModal) {
        editVisitModal.classList.remove('active');
        currentEditingVisit = null;
      }
    });

  }

  function exportCSV() {
    let csvContent = "Nome,Internação,Hospital,Status,Primeira Avaliacao,Ultima Visita,Dias de Internacao\n";
    getFilteredPatients().forEach(p => {
      const dias = diasDeInternacao(p.dataPrimeiraAvaliacao, p.dataUltimaVisita);
      const statusStr = p.isInternado ? STATUS.INTERNADO : STATUS.ALTA;
      const internacaoStr = p.internacao || 'Particular';

      const row = `"${p.pacienteNome}","${internacaoStr}","${p.hospital}","${statusStr}","${formatDateBR(p.dataPrimeiraAvaliacao)}","${formatDateBR(p.dataUltimaVisita)}","${dias}"`;
      csvContent += row + "\n";
    });

    const hosp = filterHospital.value;
    const internacao = filterInternacao ? filterInternacao.value : 'Todos';
    const stat = filterStatus ? filterStatus.value : 'Todos';
    const filename = `censo_hospitalar_${hosp}_${internacao}_${stat}.csv`.replace(/ /g, '_').toLowerCase();

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // SCREEN 3: VISÃO CALENDÁRIO
  filterCalStartDate.addEventListener('change', renderCalendar);
  filterCalEndDate.addEventListener('change', renderCalendar);
  if (btnExportCalendar) {
    btnExportCalendar.addEventListener('click', exportCalendarCSV);
  }

  function exportCalendarCSV() {
    const startStr = filterCalStartDate.value;
    const endStr = filterCalEndDate.value;
    let rangeStr = 'Geral';
    if (startStr && endStr) rangeStr = `${formatDateBR(startStr)} a ${formatDateBR(endStr)}`;
    else if (startStr) rangeStr = `Desde ${formatDateBR(startStr)}`;
    else if (endStr) rangeStr = `Até ${formatDateBR(endStr)}`;

    const monthlyPatients = patients.filter(p => {
      if (!p.historico) return false;
      return p.historico.some(h => {
        if (startStr && h.data < startStr) return false;
        if (endStr && h.data > endStr) return false;
        return true;
      });
    });
    if (monthlyPatients.length === 0) return;

    const visitsByDate = {};
    monthlyPatients.forEach(p => {
      p.historico.forEach(h => {
        let isMatch = true;
        if (startStr && h.data < startStr) isMatch = false;
        if (endStr && h.data > endStr) isMatch = false;

        if (isMatch) {
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
        col.push(idx === 0 ? `Período: ${rangeStr}` : '');
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

    // Adicionar resumo por médico ao final do CSV
    csvContent += "\n"; // linha em branco separadora
    csvContent += '"Total de Visitas Mensal por Médico"\n';
    csvContent += '"Médico","Total Visitas"\n';

    // Calcular totais por médico (mesma lógica do renderCalendar)
    const doctorTotals = {};
    monthlyPatients.forEach(p => {
      p.historico.forEach(h => {
        let isMatch = true;
        if (startStr && h.data < startStr) isMatch = false;
        if (endStr && h.data > endStr) isMatch = false;

        if (isMatch) {
          if (!doctorTotals[h.medico]) doctorTotals[h.medico] = 0;
          doctorTotals[h.medico] += parseInt(h.visitas, 10) || 0;
        }
      });
    });

    Object.keys(doctorTotals).sort().forEach(doc => {
      csvContent += `"${doc}","${doctorTotals[doc]}"\n`;
    });

    // Total geral
    const totalGeral = Object.values(doctorTotals).reduce((sum, v) => sum + v, 0);
    csvContent += `"TOTAL GERAL","${totalGeral}"\n`;

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    let expFile = 'calendario.csv';
    if (startStr && endStr) expFile = `calendario_${startStr}_ate_${endStr}.csv`;
    else if (startStr) expFile = `calendario_desde_${startStr}.csv`;

    link.setAttribute("download", expFile);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function renderCalendar() {
    calendarGrid.innerHTML = '';
    summaryTableBody.innerHTML = '';

    if (patients.length === 0) return;

    const startStr = filterCalStartDate.value;
    const endStr = filterCalEndDate.value;

    const visitsByDate = {};
    const visitsByDoctor = {};

    patients.forEach(p => {
      if (!p.historico) return;
      p.historico.forEach((h) => {
        let isMatch = true;
        if (startStr && h.data < startStr) isMatch = false;
        if (endStr && h.data > endStr) isMatch = false;

        if (isMatch) {
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
      calendarGrid.innerHTML = '<p class="empty-state">Nenhuma visita encontrada neste mês. Selecione outro mês ou registre visitas na tela Registro Diário.</p>';
      emptySummary.style.display = 'block';
      summaryTableBody.parentElement.style.display = 'none';
      return;
    }

    sortedDates.forEach(dateStr => {
      const colDiv = document.createElement('div');
      colDiv.className = 'cal-column';

      if (dateStr === today) {
        colDiv.classList.add('cal-column-today');
      }

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
                     <div class="col-actions" style="margin-top: 5px; text-align: right;">
                        <button class="btn-action" title="Editar Visita" data-action="edit-visit" data-patient-id="${escAttr(record.patientId)}" data-hist-id="${escAttr(record.histId)}">✏️</button>
                        <button class="btn-action" title="Excluir Visita" data-action="delete-visit" data-patient-id="${escAttr(record.patientId)}" data-hist-id="${escAttr(record.histId)}">🗑️</button>
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
    const p = patients.find(pat => pat.id === patientId);
    if (!p || !p.historico) return;
    const h = p.historico.find(hi => hi.id === histId);
    if (!h) return;

    currentEditingVisit = { patientId, histId };
    editVisitPatientLabel.textContent = `${p.pacienteNome} — ${h.data}`;
    editVisitMedico.value = h.medico;
    editVisitVisitas.value = h.visitas;

    editVisitModal.classList.add('active');
  }

  async function deleteVisit(patientId, histId) {
    const p = patients.find(pat => pat.id === patientId);
    if (!p || !p.historico) return;
    const h = p.historico.find(hi => hi.id === histId);
    if (!h) return;

    if (await showConfirm(`Remover o registro de ${esc(p.pacienteNome)} do dia ${formatDateBR(h.data)}?`, 'Excluir Visita')) {
      const { error: errDel } = await supabaseClient.from('historico').delete().eq('id', histId);
      if (errDel) { handleSupabaseError(errDel, 'excluir visita'); return; }

      const arrayLimitado = p.historico.filter(hi => hi.id !== histId);

      if (arrayLimitado.length === 0) {
        if (await showConfirm(`O paciente ${esc(p.pacienteNome)} ficou sem histórico de visitas. Deseja excluí-lo do sistema também?`, 'Paciente sem Visitas')) {
          const { error } = await supabaseClient.from('patients').delete().eq('id', patientId);
          if (error) { handleSupabaseError(error, 'excluir paciente'); }
        } else {
          await recalcPatientDates(patientId);
        }
      } else {
        await recalcPatientDates(patientId);
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
      const histId = btn.dataset.histId || null;

      // Ações síncronas (abrir modal) — não precisam de guard
      if (action === 'edit-patient') { editPatientInfo(patientId); return; }
      if (action === 'edit-visit') { editVisit(patientId, histId); return; }
      if (action === 'view-relatorio') { openRelatorioModal(patientId); return; }

      // Ações assíncronas — proteger contra duplo clique
      if (isProcessing) return;
      isProcessing = true;

      try {
        switch (action) {
          case 'delete-patient': await deletePatient(patientId); break;
          case 'add-visit': await addVisitFromList(patientId); break;
          case 'delete-visit': await deleteVisit(patientId, histId); break;
        }
      } finally {
        isProcessing = false;
      }
    });
  }

  // EXECUTE INITIALIZATION
  init();

});
