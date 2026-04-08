// ambulatorio.js — Módulo standalone de Consultas Ambulatoriais

const SUPABASE_URL = 'https://gbcnmuppylwznhrticfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiY25tdXBweWx3em5ocnRpY2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NjcwNzUsImV4cCI6MjA4NzU0MzA3NX0.XOQfcNwZSxarlHz2D51MEqlkLJ74TYLpFOUUYVB0Ko0';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Cálculo financeiro (função pura) ────────────────────────────────
function calcConsulta(valorTotal, conjunta, config) {
  const pctImpMed = (config.pct_imposto_medico || 0) / 100;
  const pctImpSam = (config.pct_imposto_samira || 0) / 100;
  const pctAdmMed = (config.pct_administracao_medico || 0) / 100;

  let valorMedico, valorSamira, impostoMedico, impostoSamira, admMedico;

  if (conjunta) {
    valorMedico = 600;
    valorSamira = Math.max(0, valorTotal - 600);
    impostoMedico = +(valorMedico * pctImpMed).toFixed(2);
    impostoSamira = +(valorSamira * pctImpSam).toFixed(2);
    admMedico = +(valorMedico * pctAdmMed).toFixed(2);
  } else {
    valorMedico = 0;
    valorSamira = valorTotal;
    impostoMedico = 0;
    impostoSamira = +(valorSamira * pctImpSam).toFixed(2);
    admMedico = 0;
  }

  return {
    valor_medico: valorMedico,
    valor_samira: valorSamira,
    imposto_medico: impostoMedico,
    imposto_samira: impostoSamira,
    administracao_medico: admMedico,
    valor_liquido_medico: +(valorMedico - impostoMedico - admMedico).toFixed(2),
    valor_liquido_samira: +(valorSamira - impostoSamira).toFixed(2),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────
function fmt(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function showToast(msg, type) {
  const el = document.getElementById('amb-toast');
  el.textContent = msg;
  el.className = 'amb-toast ' + type;
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ─── Init ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Auth guard
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const userId = session.user.id;
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('role, doctor_name')
    .eq('id', userId)
    .single();

  const role = profile?.role || 'doctor';

  // RBAC: admin, manager e doctor podem acessar
  if (!['admin', 'manager', 'doctor'].includes(role)) {
    window.location.href = 'index.html';
    return;
  }

  document.body.style.visibility = 'visible';

  // Logout
  document.getElementById('amb-logout').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });

  // State
  const state = {
    config: null,
    consultas: [],
    editingId: null,
    role,
    userId,
    doctorName: profile?.doctor_name || null,
  };

  const canEdit = role === 'admin' || role === 'manager' || role === 'doctor';
  const canDelete = role === 'admin' || role === 'manager';

  function canEditConsulta(consulta) {
    if (!consulta) return false;
    if (role === 'admin' || role === 'manager') return true;
    return role === 'doctor'
      && consulta.consulta_conjunta
      && !!state.doctorName
      && consulta.medico === state.doctorName;
  }

  function canDeleteConsulta() {
    return canDelete;
  }

  // ─── Load config ──────────────────────────────────────────────────
  try {
    const { data, error } = await supabaseClient
      .from('ambulatorio_config')
      .select('*')
      .single();
    if (error) throw error;
    state.config = data;
  } catch (err) {
    console.error('Erro ao carregar config:', err);
    showToast('Erro ao carregar configurações', 'error');
    return;
  }

  // ─── Config UI (T09/T10) ─────────────────────────────────────────
  const cfgToggle = document.getElementById('amb-config-toggle');
  const cfgBody = document.getElementById('amb-config-body');
  const cfgActions = document.getElementById('amb-config-actions');
  const cfgImpMed = document.getElementById('cfg-imposto-medico');
  const cfgImpSam = document.getElementById('cfg-imposto-samira');
  const cfgAdmMed = document.getElementById('cfg-adm-medico');

  function renderConfig() {
    cfgImpMed.value = state.config.pct_imposto_medico;
    cfgImpSam.value = state.config.pct_imposto_samira;
    cfgAdmMed.value = state.config.pct_administracao_medico;
  }
  renderConfig();

  // Show edit button for admin/manager
  const canEditConfig = role === 'admin' || role === 'manager';
  if (canEditConfig) {
    cfgActions.style.display = 'flex';
  } else {
    cfgImpMed.readOnly = true;
    cfgImpSam.readOnly = true;
    cfgAdmMed.readOnly = true;
  }

  cfgToggle.addEventListener('click', () => {
    cfgToggle.classList.toggle('open');
    cfgBody.classList.toggle('open');
  });

  document.getElementById('amb-config-save').addEventListener('click', async () => {
    const pctImpMed = parseFloat(cfgImpMed.value) || 0;
    const pctImpSam = parseFloat(cfgImpSam.value) || 0;
    const pctAdmMed = parseFloat(cfgAdmMed.value) || 0;

    if (pctImpMed < 0 || pctImpSam < 0 || pctAdmMed < 0) {
      showToast('Percentuais não podem ser negativos', 'error');
      return;
    }

    const { error } = await supabaseClient
      .from('ambulatorio_config')
      .update({
        pct_imposto_medico: pctImpMed,
        pct_imposto_samira: pctImpSam,
        pct_administracao_medico: pctAdmMed,
      })
      .eq('id', 1);

    if (error) {
      console.error('Erro ao salvar config:', error);
      showToast('Erro ao salvar configurações', 'error');
      return;
    }

    state.config.pct_imposto_medico = pctImpMed;
    state.config.pct_imposto_samira = pctImpSam;
    state.config.pct_administracao_medico = pctAdmMed;

    updateCalcPreview();
    showToast('Configurações salvas', 'success');
  });

  // ─── Form elements ────────────────────────────────────────────────
  const form = document.getElementById('amb-form');
  const elFormTitle = document.getElementById('amb-form-title');
  const elCancelEdit = document.getElementById('amb-cancel-edit');
  const elPaciente = document.getElementById('amb-paciente');
  const elData = document.getElementById('amb-data');
  const elConjunta = document.getElementById('amb-conjunta');
  const elMedicoGroup = document.getElementById('amb-medico-group');
  const elMedico = document.getElementById('amb-medico');
  const elValorTotal = document.getElementById('amb-valor-total');
  const elStatus = document.getElementById('amb-status');
  const elValorRecebido = document.getElementById('amb-valor-recebido');
  const elObs = document.getElementById('amb-obs');
  const elSubmit = document.getElementById('amb-form-submit');

  // Default date = today
  elData.value = new Date().toISOString().split('T')[0];

  // If doctor, pre-select their name and restrict
  if (role === 'doctor' && state.doctorName) {
    elMedico.value = state.doctorName;
    elMedico.disabled = true;
    elConjunta.checked = true;
    elConjunta.disabled = true;
    elStatus.disabled = true;
    elValorRecebido.readOnly = true;
  }

  // ─── Conjunta toggle (T13) ────────────────────────────────────────
  function syncConjuntaUI() {
    const conjunta = elConjunta.checked;
    elMedicoGroup.style.display = conjunta ? '' : 'none';
    elMedico.required = conjunta;
    if (!conjunta) elMedico.value = '';
    updateCalcPreview();
  }
  elConjunta.addEventListener('change', syncConjuntaUI);
  syncConjuntaUI();

  // ─── Auto-calc preview (T12/T13) ─────────────────────────────────
  function updateCalcPreview() {
    const valorTotal = parseFloat(elValorTotal.value) || 0;
    const conjunta = elConjunta.checked;
    const calc = calcConsulta(valorTotal, conjunta, state.config);

    document.getElementById('calc-valor-medico').textContent = fmt(calc.valor_medico);
    document.getElementById('calc-valor-samira').textContent = fmt(calc.valor_samira);
    document.getElementById('calc-imposto-medico').textContent = fmt(calc.imposto_medico);
    document.getElementById('calc-imposto-samira').textContent = fmt(calc.imposto_samira);
    document.getElementById('calc-adm-medico').textContent = fmt(calc.administracao_medico);
    document.getElementById('calc-liquido-medico').textContent = fmt(calc.valor_liquido_medico);
    document.getElementById('calc-liquido-samira').textContent = fmt(calc.valor_liquido_samira);
  }

  elValorTotal.addEventListener('input', updateCalcPreview);

  // ─── Status → Valor Recebido sync ────────────────────────────────
  function syncValorRecebido() {
    if (role === 'doctor') return; // doctor não edita pagamento
    const status = elStatus.value;
    if (status === 'pago') {
      elValorRecebido.value = elValorTotal.value || '0';
      elValorRecebido.readOnly = true;
    } else if (status === 'pendente') {
      elValorRecebido.value = '0';
      elValorRecebido.readOnly = true;
    } else {
      // parcial — editável
      elValorRecebido.readOnly = false;
    }
  }
  elStatus.addEventListener('change', syncValorRecebido);
  elValorTotal.addEventListener('input', () => {
    if (elStatus.value === 'pago') elValorRecebido.value = elValorTotal.value || '0';
  });
  syncValorRecebido();

  // ─── Validation (T14) ─────────────────────────────────────────────
  function clearErrors() {
    form.querySelectorAll('.amb-field-error').forEach(e => e.remove());
    form.querySelectorAll('.invalid').forEach(e => e.classList.remove('invalid'));
  }

  function addError(el, msg) {
    el.classList.add('invalid');
    const err = document.createElement('div');
    err.className = 'amb-field-error';
    err.textContent = msg;
    el.parentElement.appendChild(err);
  }

  function validateForm() {
    clearErrors();
    let valid = true;
    const conjunta = elConjunta.checked;
    const valorTotal = parseFloat(elValorTotal.value) || 0;

    if (!elPaciente.value.trim()) {
      addError(elPaciente, 'Nome do paciente é obrigatório');
      valid = false;
    }
    if (!elData.value) {
      addError(elData, 'Data é obrigatória');
      valid = false;
    }
    if (conjunta && !elMedico.value) {
      addError(elMedico, 'Selecione o médico');
      valid = false;
    }
    if (!elValorTotal.value || valorTotal <= 0) {
      addError(elValorTotal, 'Valor total deve ser maior que zero');
      valid = false;
    }
    if (conjunta && valorTotal < 600) {
      addError(elValorTotal, 'Consulta conjunta exige valor total >= R$ 600');
      valid = false;
    }

    const valorRecebido = parseFloat(elValorRecebido.value) || 0;
    if (valorRecebido > valorTotal) {
      addError(elValorRecebido, 'Valor recebido não pode exceder o valor total');
      valid = false;
    }

    return valid;
  }

  // ─── Edit mode (T18) ─────────────────────────────────────────────
  function startEdit(id) {
    const c = state.consultas.find(x => x.id === id);
    if (!c) return;
    if (!canEditConsulta(c)) {
      showToast('Sem permissão para editar esta consulta', 'error');
      return;
    }

    state.editingId = id;
    elFormTitle.textContent = 'Editar Consulta';
    elCancelEdit.style.display = '';
    elSubmit.textContent = 'Atualizar Consulta';

    // Populate form
    elPaciente.value = c.paciente_nome;
    elData.value = c.data_consulta;
    elConjunta.checked = c.consulta_conjunta;
    if (role !== 'doctor') {
      elMedico.value = c.medico || '';
    }
    elValorTotal.value = c.valor_total;
    elStatus.value = c.status_pagamento;
    elValorRecebido.value = c.valor_recebido;
    elObs.value = c.observacoes || '';

    syncConjuntaUI();
    syncValorRecebido();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEdit() {
    state.editingId = null;
    elFormTitle.textContent = 'Nova Consulta';
    elCancelEdit.style.display = 'none';
    elSubmit.textContent = 'Salvar Consulta';
    resetForm();
  }

  elCancelEdit.addEventListener('click', cancelEdit);

  // ─── Save / Update consulta (T15/T18) ─────────────────────────────
  let saving = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!validateForm()) return;

    saving = true;
    elSubmit.disabled = true;
    elSubmit.textContent = state.editingId ? 'Atualizando...' : 'Salvando...';

    const valorTotal = parseFloat(elValorTotal.value);
    const conjunta = elConjunta.checked;
    const calc = calcConsulta(valorTotal, conjunta, state.config);

    const row = {
      paciente_nome: elPaciente.value.trim(),
      data_consulta: elData.value,
      medico: conjunta ? elMedico.value : null,
      consulta_conjunta: conjunta,
      valor_total: valorTotal,
      valor_medico: calc.valor_medico,
      valor_samira: calc.valor_samira,
      pct_imposto_medico: state.config.pct_imposto_medico,
      pct_imposto_samira: state.config.pct_imposto_samira,
      pct_administracao_medico: state.config.pct_administracao_medico,
      imposto_medico: calc.imposto_medico,
      imposto_samira: calc.imposto_samira,
      administracao_medico: calc.administracao_medico,
      valor_liquido_medico: calc.valor_liquido_medico,
      valor_liquido_samira: calc.valor_liquido_samira,
      status_pagamento: elStatus.value,
      valor_recebido: parseFloat(elValorRecebido.value) || 0,
      observacoes: elObs.value.trim() || null,
    };

    let error;
    if (state.editingId) {
      ({ error } = await supabaseClient
        .from('consultas_ambulatoriais')
        .update(row)
        .eq('id', state.editingId));
    } else {
      row.created_by = state.userId;
      ({ error } = await supabaseClient
        .from('consultas_ambulatoriais')
        .insert(row));
    }

    saving = false;
    elSubmit.disabled = false;
    elSubmit.textContent = state.editingId ? 'Atualizar Consulta' : 'Salvar Consulta';

    if (error) {
      console.error('Erro ao salvar consulta:', error);
      showToast('Erro ao salvar: ' + (error.message || 'erro desconhecido'), 'error');
      return;
    }

    showToast(state.editingId ? 'Consulta atualizada' : 'Consulta salva com sucesso', 'success');
    state.editingId = null;
    elFormTitle.textContent = 'Nova Consulta';
    elCancelEdit.style.display = 'none';
    elSubmit.textContent = 'Salvar Consulta';
    resetForm();
    await loadConsultas();
  });

  function resetForm() {
    clearErrors();
    elPaciente.value = '';
    elData.value = new Date().toISOString().split('T')[0];
    elConjunta.checked = true;
    if (role !== 'doctor') elMedico.value = '';
    elValorTotal.value = '';
    elStatus.value = 'pendente';
    elValorRecebido.value = '0';
    elObs.value = '';
    syncConjuntaUI();
    syncValorRecebido();
  }

  // ─── Delete consulta (T19) ────────────────────────────────────────
  const elDeleteModal = document.getElementById('amb-delete-modal');
  const elDeleteMsg = document.getElementById('amb-delete-msg');
  let pendingDeleteId = null;

  function requestDelete(id) {
    const c = state.consultas.find(x => x.id === id);
    if (!c) return;
    if (!canDeleteConsulta(c)) {
      showToast('Sem permissão para excluir esta consulta', 'error');
      return;
    }
    pendingDeleteId = id;
    elDeleteMsg.textContent = `Excluir consulta de ${c.paciente_nome} em ${fmtDate(c.data_consulta)}?`;
    elDeleteModal.style.display = '';
  }

  document.getElementById('amb-delete-cancel').addEventListener('click', () => {
    pendingDeleteId = null;
    elDeleteModal.style.display = 'none';
  });

  document.getElementById('amb-delete-confirm').addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    elDeleteModal.style.display = 'none';
    pendingDeleteId = null;

    const { error } = await supabaseClient
      .from('consultas_ambulatoriais')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir:', error);
      showToast('Erro ao excluir consulta', 'error');
      return;
    }

    // If we were editing this row, cancel edit
    if (state.editingId === id) cancelEdit();

    showToast('Consulta excluída', 'success');
    await loadConsultas();
  });

  // ─── Filters (T16/T17) ───────────────────────────────────────────
  const elFilterDe = document.getElementById('filter-data-de');
  const elFilterAte = document.getElementById('filter-data-ate');
  const elFilterMedico = document.getElementById('filter-medico');
  const elFilterStatus = document.getElementById('filter-status');

  const elSummaryPeriodo = document.getElementById('amb-summary-periodo');
  const elSummaryTotalConsultas = document.getElementById('amb-summary-total-consultas');
  const elSummaryTipos = document.getElementById('amb-summary-tipos');
  const elSummaryBruto = document.getElementById('amb-summary-bruto');
  const elSummaryLiquidoMedico = document.getElementById('amb-summary-liquido-medico');
  const elSummaryLiquidoSamira = document.getElementById('amb-summary-liquido-samira');

  function getResumoPeriodoLabel() {
    const de = elFilterDe.value;
    const ate = elFilterAte.value;
    if (de && ate) return `${fmtDate(de)} - ${fmtDate(ate)}`;
    if (de) return `A partir de ${fmtDate(de)}`;
    if (ate) return `Até ${fmtDate(ate)}`;
    return 'Base completa';
  }

  function calcResumo(consultas) {
    return consultas.reduce((acc, c) => {
      acc.totalConsultas += 1;
      acc.totalBruto += Number(c.valor_total) || 0;
      acc.totalLiquidoMedico += Number(c.valor_liquido_medico) || 0;
      acc.totalLiquidoSamira += Number(c.valor_liquido_samira) || 0;
      if (c.consulta_conjunta) acc.totalConjuntas += 1;
      else acc.totalExclusivas += 1;
      return acc;
    }, {
      totalConsultas: 0,
      totalConjuntas: 0,
      totalExclusivas: 0,
      totalBruto: 0,
      totalLiquidoMedico: 0,
      totalLiquidoSamira: 0,
    });
  }

  function renderResumo(consultas) {
    const resumo = calcResumo(consultas);
    elSummaryPeriodo.textContent = getResumoPeriodoLabel();
    elSummaryTotalConsultas.textContent = String(resumo.totalConsultas);
    elSummaryTipos.textContent = `${resumo.totalConjuntas} / ${resumo.totalExclusivas}`;
    elSummaryBruto.textContent = fmt(resumo.totalBruto);
    elSummaryLiquidoMedico.textContent = fmt(resumo.totalLiquidoMedico);
    elSummaryLiquidoSamira.textContent = fmt(resumo.totalLiquidoSamira);
  }

  function getFilteredConsultas() {
    let list = state.consultas;
    const de = elFilterDe.value;
    const ate = elFilterAte.value;
    const medico = elFilterMedico.value;
    const status = elFilterStatus.value;

    if (de) list = list.filter(c => c.data_consulta >= de);
    if (ate) list = list.filter(c => c.data_consulta <= ate);
    if (medico === '__samira__') {
      list = list.filter(c => !c.consulta_conjunta);
    } else if (medico) {
      list = list.filter(c => c.medico === medico);
    }
    if (status) list = list.filter(c => c.status_pagamento === status);

    return list;
  }

  [elFilterDe, elFilterAte, elFilterMedico, elFilterStatus].forEach(el => {
    el.addEventListener('change', renderHistorico);
  });

  document.getElementById('filter-clear').addEventListener('click', () => {
    elFilterDe.value = '';
    elFilterAte.value = '';
    elFilterMedico.value = '';
    elFilterStatus.value = '';
    renderHistorico();
  });

  // ─── Histórico ────────────────────────────────────────────────────
  const elHistEmpty = document.getElementById('amb-historico-empty');
  const elTableWrapper = document.getElementById('amb-table-wrapper');
  const elTableBody = document.getElementById('amb-table-body');
  const elThAcoes = document.getElementById('th-acoes');

  async function loadConsultas() {
    const { data, error } = await supabaseClient
      .from('consultas_ambulatoriais')
      .select('*')
      .order('data_consulta', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar consultas:', error);
      elHistEmpty.textContent = 'Erro ao carregar histórico.';
      return;
    }

    state.consultas = data || [];
    renderHistorico();
  }

  function renderHistorico() {
    const filtered = getFilteredConsultas();
    renderResumo(filtered);

    if (filtered.length === 0) {
      elHistEmpty.style.display = '';
      elHistEmpty.textContent = state.consultas.length === 0
        ? 'Nenhuma consulta registrada ainda.'
        : 'Nenhuma consulta encontrada com os filtros atuais.';
      elTableWrapper.style.display = 'none';
      return;
    }

    elHistEmpty.style.display = 'none';
    elTableWrapper.style.display = '';

    elTableBody.innerHTML = '';
    for (const c of filtered) {
      const tr = document.createElement('tr');
      const cells = [
        fmtDate(c.data_consulta),
        c.paciente_nome,
        c.consulta_conjunta ? 'Sim' : 'Não',
        c.medico || '—',
        fmt(c.valor_total),
        fmt(c.valor_liquido_medico),
        fmt(c.valor_liquido_samira),
      ];
      cells.forEach(text => {
        const td = document.createElement('td');
        td.textContent = text;
        tr.appendChild(td);
      });
      // Status badge
      const tdStatus = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = 'amb-status ' + c.status_pagamento;
      badge.textContent = c.status_pagamento;
      tdStatus.appendChild(badge);
      tr.appendChild(tdStatus);

      const canEditRow = canEditConsulta(c);
      const canDeleteRow = canDeleteConsulta(c);

      if (canEditRow || canDeleteRow) {
        const tdActions = document.createElement('td');
        const wrap = document.createElement('div');
        wrap.className = 'amb-row-actions';

        if (canEditRow) {
          const btnEdit = document.createElement('button');
          btnEdit.className = 'amb-btn-icon';
          btnEdit.title = 'Editar';
          btnEdit.textContent = '✎';
          btnEdit.addEventListener('click', () => startEdit(c.id));
          wrap.appendChild(btnEdit);
        }
        if (canDeleteRow) {
          const btnDel = document.createElement('button');
          btnDel.className = 'amb-btn-icon delete';
          btnDel.title = 'Excluir';
          btnDel.textContent = '✕';
          btnDel.addEventListener('click', () => requestDelete(c.id));
          wrap.appendChild(btnDel);
        }

        tdActions.appendChild(wrap);
        tr.appendChild(tdActions);
      } else if (canEdit || canDelete) {
        const tdActions = document.createElement('td');
        tdActions.textContent = '—';
        tr.appendChild(tdActions);
      }

      elTableBody.appendChild(tr);
    }

    elThAcoes.style.display = canEdit || canDelete ? '' : 'none';
  }

  // ─── Boot ─────────────────────────────────────────────────────────
  await loadConsultas();
  console.log('[ambulatorio] init OK — config:', state.config, '— consultas:', state.consultas.length);
});
