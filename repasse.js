// === REPASSE STATE ===
let repasseConfig = null;
let repasseFatura = null;
let repassePacientes = [];
let historicoMes = [];
let ambulatorioMes = []; // T22 — consultas ambulatoriais do mês (lidas de consultas_ambulatoriais)
let _saveTimer = null;
let _expandedRows = new Set();
const AMB_COLS = 'id, paciente_nome, data_consulta, medico, consulta_conjunta, valor_total, valor_medico, valor_samira, imposto_medico, imposto_samira, administracao_medico, valor_liquido_medico, valor_liquido_samira, status_pagamento, valor_recebido';

// === HELPERS ===
function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getSelectedMesAno() {
  const mes = Number(document.getElementById('repasse-mes')?.value);
  const ano = Number(document.getElementById('repasse-ano')?.value);
  return { mes, ano };
}

function formatBRL(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseBRL(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  // Formato pt-BR: "R$ 1.000,50" → remove R$, espaços, pontos de milhar, troca vírgula por ponto
  const cleaned = str
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return Number(cleaned) || 0;
}

function calcQtdVisitas(inicio, fim) {
  if (!inicio) return 0;
  const d1 = new Date(inicio + 'T00:00:00');
  const d2 = fim ? new Date(fim + 'T00:00:00') : new Date();
  const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diff);
}

function getNomeDisplay(pac) {
  if (pac.nome_override) return pac.nome_override;
  if (pac._nome_display) return pac._nome_display;
  if (pac.patient_id && window.patients) {
    const p = window.patients.find(pt => pt.id === pac.patient_id);
    if (p) return p.pacienteNome;
  }
  return '(sem nome)';
}

// === INIT ===
async function initRepasse() {
  await loadRepasseConfig();
  populateRepasseSelectors();
  await loadRepasseMes();
  await loadHistoricoRelatorios();
}

function populateRepasseSelectors() {
  const mesSelect = document.getElementById('repasse-mes');
  const anoSelect = document.getElementById('repasse-ano');
  if (!mesSelect || !anoSelect) return;

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  mesSelect.innerHTML = meses.map((m, i) =>
    `<option value="${i + 1}">${m}</option>`
  ).join('');

  const anoAtual = new Date().getFullYear();
  anoSelect.innerHTML = '';
  for (let a = anoAtual - 2; a <= anoAtual + 1; a++) {
    anoSelect.innerHTML += `<option value="${a}">${a}</option>`;
  }

  mesSelect.value = new Date().getMonth() + 1;
  anoSelect.value = anoAtual;
}

// T08 — Carregamento ao mudar mês/ano
async function loadRepasseMes() {
  const { mes, ano } = getSelectedMesAno();
  if (!mes || !ano) return;

  const fatura = await loadOrCreateFatura(mes, ano);

  if (fatura) {
    await loadPacientesFatura(fatura.id);
    repassePacientes.forEach(pac => {
      if (pac.patient_id && window.patients) {
        const p = window.patients.find(pt => pt.id === pac.patient_id);
        if (p) pac._nome_display = p.pacienteNome;
      }
    });
  } else {
    repassePacientes = prePopularPacientes(mes, ano);
    repasseFatura = null;
  }

  // Carregar histórico para o resumo
  await loadHistoricoMes(mes, ano);
  renderRepasseEntrada();
  recalcularTotal();
  atualizarResumo();
  await loadPendentesMesesAnteriores(mes, ano);
}

// === CONFIG ===
async function loadRepasseConfig() {
  const { data, error } = await supabaseClient
    .from('repasse_config')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    console.error('Erro ao carregar repasse_config:', error);
    return;
  }
  repasseConfig = data;
}

async function saveRepasseConfig(updates) {
  const { data, error } = await supabaseClient
    .from('repasse_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .single();

  if (error) {
    console.error('Erro ao salvar repasse_config:', error);
    showToast('Erro ao salvar configurações');
    return null;
  }
  repasseConfig = data;
  showToast('Configurações salvas');
  return data;
}

// === FATURA ===
async function loadOrCreateFatura(mes, ano) {
  const { data, error } = await supabaseClient
    .from('repasse_fatura')
    .select('*')
    .eq('mes', mes)
    .eq('ano', ano)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Erro ao carregar fatura:', error);
    return null;
  }

  repasseFatura = data || null;
  return repasseFatura;
}

async function saveFatura(mes, ano, valorTotal) {
  const { data, error } = await supabaseClient
    .from('repasse_fatura')
    .upsert({
      ...(repasseFatura?.id ? { id: repasseFatura.id } : {}),
      mes,
      ano,
      valor_total_recebido: valorTotal,
      updated_at: new Date().toISOString()
    }, { onConflict: 'mes,ano' })
    .select()
    .single();

  if (error) {
    console.error('Erro ao salvar fatura:', error);
    return null;
  }
  repasseFatura = data;
  loadHistoricoRelatorios();
  return data;
}

// === PACIENTES ===
async function loadPacientesFatura(faturaId) {
  const { data, error } = await supabaseClient
    .from('repasse_paciente')
    .select('*')
    .eq('fatura_id', faturaId)
    .order('periodo_inicio');

  if (error) {
    console.error('Erro ao carregar pacientes do repasse:', error);
    return [];
  }
  repassePacientes = data || [];
  return repassePacientes;
}

// T09 — Pré-popular pacientes do mês
function prePopularPacientes(mes, ano) {
  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia = new Date(ano, mes, 0);

  return (window.patients || []).filter(p => {
    if (!p.dataPrimeiraAvaliacao) return false;
    const dataInicio = new Date(p.dataPrimeiraAvaliacao + 'T00:00:00');
    if (dataInicio > ultimoDia) return false;

    if (p.statusManual === 'Internado') return true;

    if (p.dataUltimaVisita) {
      const dataFim = new Date(p.dataUltimaVisita + 'T00:00:00');
      return dataFim >= primeiroDia;
    }
    return false;
  }).map(p => ({
    patient_id: p.id,
    nome_override: null,
    periodo_inicio: p.dataPrimeiraAvaliacao,
    periodo_fim: p.dataUltimaVisita || null,
    hospital: p.hospital,
    status_pagamento: null,
    valor_recebido: null,
    valor_previsto: null,
    valor_visita: null,
    desconto_paciente: null,
    incluido: true,
    _nome_display: p.pacienteNome
  }));
}

async function savePaciente(dados) {
  const { data, error } = await supabaseClient
    .from('repasse_paciente')
    .upsert({
      ...dados,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao salvar paciente repasse:', error);
    return null;
  }
  return data;
}

async function deletePaciente(id) {
  const { error } = await supabaseClient
    .from('repasse_paciente')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao deletar paciente repasse:', error);
    return false;
  }
  return true;
}

// === RESUMO DO HEADER ===
function recalcularTotal() {
  const total = repassePacientes
    .filter(p => p.incluido && p.status_pagamento !== 'NÃO' && p.valor_recebido > 0)
    .reduce((s, p) => s + (Number(p.valor_recebido) || 0), 0);
  const input = document.getElementById('repasse-valor-total');
  if (input) input.value = total > 0 ? formatBRL(total) : '';
  return total;
}

function atualizarResumo() {
  const resumo = document.getElementById('repasse-resumo');
  if (!resumo || !repasseConfig) return;

  const valorTotal = recalcularTotal();
  const totalVisitas = historicoMes.reduce((s, h) => s + (h.visitas || 0), 0);

  if (!valorTotal || valorTotal <= 0 || totalVisitas === 0) {
    resumo.style.display = 'none';
    return;
  }

  const impostos = valorTotal * (Number(repasseConfig.pct_impostos) / 100);
  const adm = valorTotal * (Number(repasseConfig.pct_adm) / 100);
  const restante = valorTotal - impostos - adm;
  const samira = restante * (Number(repasseConfig.pct_samira) / 100);
  const divisaoEquipe = valorTotal - impostos - adm - samira;
  const valorPorVisita = divisaoEquipe / totalVisitas;

  document.getElementById('resumo-total-visitas').textContent = totalVisitas;
  document.getElementById('resumo-valor-visita').textContent = formatBRL(valorPorVisita);
  document.getElementById('resumo-divisao-equipe').textContent = formatBRL(divisaoEquipe);
  resumo.style.display = 'flex';
}

// === T11 — Auto-save com debounce ===
async function saveRepasseData() {
  const { mes, ano } = getSelectedMesAno();
  const valorTotal = recalcularTotal();

  // Garantir que a fatura existe
  const fatura = await saveFatura(mes, ano, valorTotal);
  if (!fatura) return;

  // Salvar cada paciente
  for (const pac of repassePacientes) {
    // Remover props temporários antes de salvar
    const { _nome_display, _unsaved, _ref_mes_anterior, ...dadosSalvar } = pac;
    dadosSalvar.fatura_id = fatura.id;
    const saved = await savePaciente(dadosSalvar);
    if (saved) {
      pac.id = saved.id;
      pac.fatura_id = saved.fatura_id;
      delete pac._unsaved;
    }
  }
}

function debounceSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => saveRepasseData(), 800);
}

// === CÁLCULO ===
function calcularRepasse(config, fatura, pacientes, historico) {
  const total = Number(fatura.valor_total_recebido) || 0;
  const impostos = total * (Number(config.pct_impostos) / 100);
  const adm = total * (Number(config.pct_adm) / 100);
  const restante = total - impostos - adm;
  const samira = restante * (Number(config.pct_samira) / 100);
  const divisaoEquipe = total - impostos - adm - samira;

  const totalVisitasEquipe = historico.reduce((s, h) => s + (h.visitas || 0), 0);
  const valorPorVisita = totalVisitasEquipe > 0 ? divisaoEquipe / totalVisitasEquipe : 0;

  const doctorsList = window.DOCTORS || [];
  const repassePorMedico = {};
  doctorsList.forEach(medico => {
    const visitasMedico = historico
      .filter(h => h.medico === medico)
      .reduce((s, h) => s + (h.visitas || 0), 0);
    const valorBruto = valorPorVisita * visitasMedico;
    const desconto = (config.descontos_sala && config.descontos_sala[medico]) || 0;
    repassePorMedico[medico] = {
      visitasMedico,
      valorBruto,
      desconto,
      valorLiquido: valorBruto - desconto
    };
  });

  return {
    total, impostos, adm, restante, samira, divisaoEquipe,
    totalVisitasEquipe, valorPorVisita, repassePorMedico
  };
}

// === HISTÓRICO DE RELATÓRIOS SALVOS ===
async function loadHistoricoRelatorios() {
  const { data, error } = await supabaseClient
    .from('repasse_fatura')
    .select('id, mes, ano, valor_total_recebido')
    .order('ano', { ascending: false })
    .order('mes', { ascending: false });

  if (error) { console.error('Erro ao carregar histórico:', error); return; }

  const lista = document.getElementById('repasse-historico-lista');
  if (!lista) return;

  if (!data || data.length === 0) {
    lista.innerHTML = '<p class="empty-state">Nenhum relatório salvo ainda.</p>';
    return;
  }

  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  lista.innerHTML = data.map(f => `
    <div class="repasse-historico-item">
      <span class="repasse-historico-periodo">${meses[f.mes - 1]} / ${f.ano}</span>
      <button class="btn-secondary btn-historico-pdf" data-mes="${f.mes}" data-ano="${f.ano}"
        data-label="↓ Baixar PDF" style="font-size:0.8rem; padding:0.35rem 0.9rem; white-space:nowrap;">
        ↓ Baixar PDF
      </button>
    </div>
  `).join('');

  lista.querySelectorAll('.btn-historico-pdf').forEach(btn => {
    btn.addEventListener('click', () => baixarPDFHistorico(Number(btn.dataset.mes), Number(btn.dataset.ano), btn));
  });
}

async function baixarPDFHistorico(mes, ano, btn) {
  if (btn) { btn.textContent = 'Gerando...'; btn.disabled = true; }

  try {
    // Carregar dados do mês sem alterar o estado atual da tela
    const { data: fatura } = await supabaseClient
      .from('repasse_fatura').select('*').eq('mes', mes).eq('ano', ano).single();
    if (!fatura) { showToast('Dados não encontrados'); return; }

    const { data: pacientes } = await supabaseClient
      .from('repasse_paciente').select('*').eq('fatura_id', fatura.id).order('periodo_inicio');

    const primeiroDia = `${ano}-${String(mes).padStart(2,'0')}-01`;
    const ultimoDia = new Date(ano, mes, 0);
    const ultimoDiaStr = `${ano}-${String(mes).padStart(2,'0')}-${String(ultimoDia.getDate()).padStart(2,'0')}`;
    const { data: historico } = await supabaseClient
      .from('historico').select('id, patient_id, data, medico, visitas')
      .gte('data', primeiroDia).lte('data', ultimoDiaStr);

    // T23 — Carregar consultas ambulatoriais para o mês do histórico
    const { data: ambData, error: ambError } = await supabaseClient
      .from('consultas_ambulatoriais')
      .select(AMB_COLS)
      .gte('data_consulta', primeiroDia).lte('data_consulta', ultimoDiaStr);
    if (ambError) console.error('Erro ambulatório (PDF):', ambError);
    const ambResumo = calcAmbulatorioResumo(ambData || []);

    // Resolver nomes dos pacientes
    const pacientesComNome = (pacientes || []).map(p => ({
      ...p,
      _nome_display: p.nome_override || (window.patients || []).find(pt => pt.id === p.patient_id)?.pacienteNome || '(paciente)'
    }));

    const dados = calcularRepasse(repasseConfig, fatura, pacientesComNome, historico || []);
    const pacientesRelatorio = pacientesComNome.filter(p => p.incluido && p.status_pagamento !== 'NÃO');

    const doctorsList = window.DOCTORS || [];
    const medicosComVisitas = doctorsList.filter(d => (historico || []).some(h => h.medico === d));

    // Renderizar em container oculto temporário
    const tmp = document.createElement('div');
    tmp.style.cssText = 'position:fixed; left:-9999px; top:0; width:900px; background:#fff;';
    document.body.appendChild(tmp);

    // Salvar estado global e substituir temporariamente
    const _cfg = repasseConfig, _hist = historicoMes;
    historicoMes = historico || [];

    tmp.innerHTML = renderPag1(dados, pacientesRelatorio, ambResumo) +
      medicosComVisitas.map(m => renderPag2(m, dados, ambResumo)).join('');

    repasseConfig = _cfg;
    historicoMes = _hist;

    const pages = [...tmp.querySelectorAll('.repasse-pag1, .repasse-pag2')];
    const mesesNome = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    await gerarPDF(pages, `repasse-${mesesNome[mes-1]}-${ano}.pdf`, null);

    document.body.removeChild(tmp);
    showToast('PDF baixado');
  } catch (err) {
    console.error('Erro ao gerar PDF do histórico:', err);
    showToast('Erro ao gerar PDF');
  } finally {
    if (btn) { btn.textContent = '↓ Baixar PDF'; btn.disabled = false; }
  }
}

// === HISTORICO DO MÊS ===
async function loadHistoricoMes(mes, ano) {
  const primeiroDia = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const ultimoDia = new Date(ano, mes, 0);
  const ultimoDiaStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia.getDate()).padStart(2, '0')}`;

  const { data, error } = await supabaseClient
    .from('historico')
    .select('id, patient_id, data, medico, visitas')
    .gte('data', primeiroDia)
    .lte('data', ultimoDiaStr);

  if (error) {
    console.error('Erro ao carregar histórico do mês:', error);
    return [];
  }
  historicoMes = data || [];
  return historicoMes;
}

// === T22 — CONTRATO AMBULATÓRIO ↔ REPASSE ===
// repasse.js lê diretamente da tabela `consultas_ambulatoriais` (Supabase).
// Os valores (valor_liquido_medico, valor_liquido_samira, etc.) já vêm calculados
// e armazenados no banco pelo módulo ambulatorio.js — aqui apenas somamos.
async function loadAmbulatorioMes(mes, ano) {
  const primeiroDia = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const ultimoDia = new Date(ano, mes, 0);
  const ultimoDiaStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia.getDate()).padStart(2, '0')}`;

  const { data, error } = await supabaseClient
    .from('consultas_ambulatoriais')
    .select(AMB_COLS)
    .gte('data_consulta', primeiroDia)
    .lte('data_consulta', ultimoDiaStr);

  if (error) {
    console.error('Erro ao carregar ambulatório do mês:', error);
    return [];
  }
  ambulatorioMes = data || [];
  return ambulatorioMes;
}

// Agrega dados ambulatoriais para exibição no repasse
function calcAmbulatorioResumo(consultas) {
  if (!consultas || consultas.length === 0) return null;

  const totalConsultas = consultas.length;
  const totalBruto = consultas.reduce((s, c) => s + (Number(c.valor_total) || 0), 0);
  const totalLiqMedicos = consultas.reduce((s, c) => s + (Number(c.valor_liquido_medico) || 0), 0);
  const totalLiqSamira = consultas.reduce((s, c) => s + (Number(c.valor_liquido_samira) || 0), 0);

  // Agrupar por médico (apenas consultas conjuntas têm médico)
  const porMedico = {};
  consultas.forEach(c => {
    if (c.consulta_conjunta && c.medico) {
      if (!porMedico[c.medico]) {
        porMedico[c.medico] = { consultas: 0, valorLiquido: 0 };
      }
      porMedico[c.medico].consultas++;
      porMedico[c.medico].valorLiquido += Number(c.valor_liquido_medico) || 0;
    }
  });

  return {
    totalConsultas,
    totalBruto,
    totalLiqMedicos,
    totalLiqSamira,
    porMedico
  };
}

// === T10 — RENDER TABELA DE ENTRADA ===
function renderRepasseEntrada() {
  const tbody = document.querySelector('#repasse-pacientes-table tbody');
  const emptyMsg = document.getElementById('empty-repasse-pacientes');
  if (!tbody) return;

  if (repassePacientes.length === 0) {
    tbody.innerHTML = '';
    if (emptyMsg) emptyMsg.style.display = '';
    return;
  }
  if (emptyMsg) emptyMsg.style.display = 'none';

  tbody.innerHTML = repassePacientes.map((pac, idx) => {
    const nome = getNomeDisplay(pac);
    const statusOptions = ['', 'SIM', 'NÃO', 'PARCIAL', 'RETAGUARDA'];
    const statusSelect = statusOptions.map(s =>
      `<option value="${s}" ${pac.status_pagamento === s ? 'selected' : ''}>${s || '—'}</option>`
    ).join('');

    const isExcluido = !pac.incluido;
    const expanded = _expandedRows.has(idx);

    // Cálculos de consistência
    const qtdVisitas = calcQtdVisitas(pac.periodo_inicio, pac.periodo_fim);
    const valorVisita = Number(pac.valor_visita) || 0;
    const descontoPac = Number(pac.desconto_paciente) || 0;
    const valorEsperado = valorVisita * qtdVisitas;
    const valorEsperadoLiq = valorEsperado - descontoPac;
    const valorRecebido = Number(pac.valor_recebido) || 0;
    const temValorVisita = valorVisita > 0;
    const inconsistente = temValorVisita && valorRecebido > 0 && Math.abs(valorRecebido - valorEsperadoLiq) > 0.01;

    return `
      <tr class="${isExcluido ? 'paciente-excluido' : ''}" data-idx="${idx}">
        <td data-label="Paciente" style="white-space:nowrap;">
           <button class="rep-expand-btn" data-idx="${idx}" title="Detalhes"
             style="background:none;border:none;cursor:pointer;font-size:0.7rem;padding:0 4px 0 0;color:var(--color-text-secondary);vertical-align:middle;">${expanded ? '▼' : '▶'}</button>${esc(nome)}
        </td>
        <td data-label="Início">
          <input type="date" class="rep-periodo-inicio" value="${pac.periodo_inicio || ''}" data-idx="${idx}">
        </td>
        <td data-label="Fim">
          <input type="date" class="rep-periodo-fim" value="${pac.periodo_fim || ''}" data-idx="${idx}">
        </td>
        <td data-label="Hospital">${esc(pac.hospital) || '—'}</td>
        <td data-label="Status" class="financeiro-only">
          <select class="rep-status" data-idx="${idx}">${statusSelect}</select>
        </td>
        <td data-label="Valor Esperado" class="financeiro-only" style="text-align:right; white-space:nowrap;">
          ${temValorVisita ? `<span style="font-size:0.85rem;">${formatBRL(valorEsperado)}</span><br><small style="color:var(--color-text-secondary);">${qtdVisitas}× ${formatBRL(valorVisita)}</small>` : '<span style="color:var(--color-text-secondary);">—</span>'}
        </td>
        <td data-label="Valor Recebido" class="financeiro-only">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <input type="text" class="rep-valor${inconsistente ? ' rep-valor-inconsistente' : ''}" inputmode="decimal" data-idx="${idx}"
              value="${pac.valor_recebido != null && pac.valor_recebido > 0 ? formatBRL(pac.valor_recebido) : ''}"
              placeholder="R$ recebido" style="width:130px;">
            ${pac.status_pagamento === 'PARCIAL' ? `
              <input type="text" class="rep-valor-previsto" inputmode="decimal" data-idx="${idx}"
                value="${pac.valor_previsto != null && pac.valor_previsto > 0 ? formatBRL(pac.valor_previsto) : ''}"
                placeholder="R$ previsto" style="width:130px; font-size:0.8rem; color:var(--color-text-secondary);">
              ${pac.valor_previsto > 0 && pac.valor_recebido > 0 ? `<span style="font-size:0.75rem; color:#d9534f; font-family:var(--font-title);">Falta: ${formatBRL(pac.valor_previsto - pac.valor_recebido)}</span>` : ''}
            ` : ''}</div>
        </td>
        <td data-label="Incluído" style="white-space:nowrap;">
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" class="rep-incluido" data-idx="${idx}" ${pac.incluido ? 'checked' : ''}
              style="width:16px; height:16px; cursor:pointer; margin:0;">
            <button class="btn-action manager-only rep-delete" data-idx="${idx}" title="Remover"
              style="color:#d9534f; font-size:0.85rem; line-height:1; padding:0; margin:0;">✕</button>
          </div>
        </td>
      </tr>
      <tr class="rep-detail-row" data-idx="${idx}" style="${expanded ? '' : 'display:none'}">
        <td colspan="8" class="financeiro-only" style="padding:0;">
          <div class="rep-detail-inner">
            <div class="rep-detail-field">
              <label>Valor da visita</label>
              <input type="text" class="rep-valor-visita" inputmode="decimal" data-idx="${idx}"
                value="${pac.valor_visita != null && pac.valor_visita > 0 ? formatBRL(pac.valor_visita) : ''}"
                placeholder="R$ / visita">
            </div>
            <div class="rep-detail-field">
              <label>Qtd. visitas</label>
              <input type="text" readonly value="${qtdVisitas > 0 ? qtdVisitas : '—'}"
                style="background:#f0f4f4; cursor:default; width:80px;" title="Calculado automaticamente pelo período de internação">
            </div>
            <div class="rep-detail-field">
              <label>Desconto</label>
              <input type="text" class="rep-desconto-paciente" inputmode="decimal" data-idx="${idx}"
                value="${pac.desconto_paciente != null && pac.desconto_paciente > 0 ? formatBRL(pac.desconto_paciente) : ''}"
                placeholder="R$ desconto">
            </div>
            ${temValorVisita ? `
            <div class="rep-detail-field rep-detail-result">
              <label>Esperado (líquido)</label>
              <span>${formatBRL(valorEsperadoLiq)}</span>
            </div>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// === T15 — RENDER PÁG. 1 (FATURA DETALHADA) ===
function renderPag1(dados, pacientesIncluidos, ambResumo) {
  const { mes, ano } = getSelectedMesAno();
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const periodo = `${meses[mes - 1]} / ${ano}`;
  const emissao = new Date().toLocaleDateString('pt-BR');

  const linhasPacientes = pacientesIncluidos.map(pac => {
    const nome = getNomeDisplay(pac);
    const inicio = pac.periodo_inicio ? new Date(pac.periodo_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
    const fim = pac.periodo_fim ? new Date(pac.periodo_fim + 'T00:00:00').toLocaleDateString('pt-BR') : 'Internado';
    return `
      <tr>
        <td>${esc(nome)}</td>
        <td>${esc(inicio)} – ${esc(fim)}</td>
        <td>${esc(pac.status_pagamento) || '—'}</td>
        <td style="text-align:right;">${pac.valor_recebido != null ? formatBRL(pac.valor_recebido) : '—'}</td>
        <td>${esc(pac.hospital) || '—'}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="repasse-pag1">
      <h3>Demonstrativo de Repasse — ${periodo}</h3>
      <p style="text-align:center; color:var(--color-text-secondary); margin-bottom:1.5rem; font-family:var(--font-body);">
        Emissão: ${emissao}
      </p>

      <div class="repasse-calc-card">
        <div class="calc-line"><span>Valor Total Recebido</span><span>${formatBRL(dados.total)}</span></div>
        <div class="calc-line"><span>(-) Impostos (${repasseConfig.pct_impostos}%)</span><span>${formatBRL(dados.impostos)}</span></div>
        <div class="calc-line"><span>(-) Administração (${repasseConfig.pct_adm}%)</span><span>${formatBRL(dados.adm)}</span></div>
        <div class="calc-line"><span>= Restante</span><span>${formatBRL(dados.restante)}</span></div>
        <div class="calc-line"><span>(-) Dra. Samira (${repasseConfig.pct_samira}%)</span><span>${formatBRL(dados.samira)}</span></div>
        <div class="calc-line"><span>= Divisão da Equipe</span><span>${formatBRL(dados.divisaoEquipe)}</span></div>
        <div class="calc-line"><span>Total de Visitas (Equipe)</span><span>${dados.totalVisitasEquipe}</span></div>
        <div class="calc-line"><span>Valor por Visita</span><span>${formatBRL(dados.valorPorVisita)}</span></div>
      </div>

      ${ambResumo ? `
      <h4 style="margin-top:2rem; margin-bottom:0.75rem; font-family:var(--font-title); color:var(--color-primary); font-size:1.05rem;">
        Ambulatório
      </h4>
      <div class="repasse-calc-card">
        <div class="calc-line"><span>Total de Consultas</span><span>${ambResumo.totalConsultas}</span></div>
        <div class="calc-line"><span>Valor Total Bruto</span><span>${formatBRL(ambResumo.totalBruto)}</span></div>
        <div class="calc-line"><span>Total Líquido Médicos</span><span>${formatBRL(ambResumo.totalLiqMedicos)}</span></div>
        <div class="calc-line"><span>Total Líquido Dra. Samira</span><span>${formatBRL(ambResumo.totalLiqSamira)}</span></div>
      </div>
      ` : ''}

      <table style="width:100%; border-collapse:collapse; margin-top:1.5rem;">
        <thead>
          <tr>
            <th style="text-align:left;">Paciente</th>
            <th style="text-align:left;">Período</th>
            <th style="text-align:left;">Pagou?</th>
            <th style="text-align:right;">Valor Recebido</th>
            <th style="text-align:left;">Unidade</th>
          </tr>
        </thead>
        <tbody>
          ${linhasPacientes}
        </tbody>
        <tfoot>
          <tr style="font-weight:700; border-top:2px solid var(--color-primary);">
            <td colspan="3">Total</td>
            <td style="text-align:right;">${formatBRL(dados.total)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

// === T16 — RENDER PÁG. 2 POR MÉDICO ===
function renderPag2(medico, dados, ambResumo) {
  const info = (repasseConfig.medicos && repasseConfig.medicos[medico]) || {};
  const nomeCompleto = info.nome_completo || medico;
  const crm = info.crm || '—';
  const medicoData = dados.repassePorMedico[medico];
  if (!medicoData || medicoData.visitasMedico === 0) return '';

  // Agrupar visitas por paciente
  const visitasPorPaciente = {};
  historicoMes
    .filter(h => h.medico === medico)
    .forEach(h => {
      if (!visitasPorPaciente[h.patient_id]) {
        visitasPorPaciente[h.patient_id] = { visitas: 0, datas: [] };
      }
      visitasPorPaciente[h.patient_id].visitas += h.visitas || 0;
      visitasPorPaciente[h.patient_id].datas.push(h.data);
    });

  const linhasPacientes = Object.entries(visitasPorPaciente).map(([patientId, info]) => {
    const paciente = (window.patients || []).find(p => p.id === patientId);
    const nome = paciente ? paciente.pacienteNome : '(paciente)';
    const datasFormatadas = info.datas
      .sort()
      .map(d => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR'))
      .join(', ');
    const valorRepasse = dados.valorPorVisita * info.visitas;
    return `
      <tr>
        <td>${esc(nome)}</td>
        <td style="text-align:center;">${info.visitas}</td>
        <td style="font-size:0.8rem;">${esc(datasFormatadas)}</td>
        <td style="text-align:right;">${formatBRL(valorRepasse)}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="repasse-pag2" data-medico="${medico}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
        <h3 style="border:none; padding:0; margin:0;">${nomeCompleto}</h3>
        <button class="btn-secondary btn-pdf-medico" data-medico="${medico}" data-label="↓ PDF"
          style="font-size:0.75rem; padding:0.3rem 0.75rem; white-space:nowrap;">↓ PDF</button>
      </div>
      <p style="text-align:center; color:var(--color-text-secondary); font-family:var(--font-body); margin-bottom:1.5rem;">
        CRM: ${crm}
      </p>

      <div class="repasse-calc-card">
        <div class="calc-line"><span>Total de Visitas (Equipe)</span><span>${dados.totalVisitasEquipe}</span></div>
        <div class="calc-line"><span>Visitas deste médico</span><span>${medicoData.visitasMedico}</span></div>
        <div class="calc-line"><span>Valor por Visita (já líquido de impostos/adm)</span><span>${formatBRL(dados.valorPorVisita)}</span></div>
        <div class="calc-line"><span>Valor a Receber (${medicoData.visitasMedico} × ${formatBRL(dados.valorPorVisita)})</span><span>${formatBRL(medicoData.valorBruto)}</span></div>
        <div class="calc-line"><span>(-) Desconto de Sala</span><span>${formatBRL(medicoData.desconto)}</span></div>
        <div class="calc-line"><span>Valor Líquido Final</span><span>${formatBRL(medicoData.valorLiquido)}</span></div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-top:1.5rem;">
        <thead>
          <tr>
            <th style="text-align:left;">Paciente</th>
            <th style="text-align:center;">Visitas</th>
            <th style="text-align:left;">Datas</th>
            <th style="text-align:right;">Valor Repasse</th>
          </tr>
        </thead>
        <tbody>
          ${linhasPacientes}
        </tbody>
        <tfoot>
          <tr style="font-weight:700; border-top:2px solid var(--color-primary);">
            <td>Total</td>
            <td style="text-align:center;">${medicoData.visitasMedico}</td>
            <td></td>
            <td style="text-align:right;">${formatBRL(medicoData.valorBruto)}</td>
          </tr>
        </tfoot>
      </table>

      ${ambResumo && ambResumo.porMedico[medico] ? `
      <h4 style="margin-top:2rem; margin-bottom:0.75rem; font-family:var(--font-title); color:var(--color-primary); font-size:1rem;">
        Consultas Ambulatoriais
      </h4>
      <div class="repasse-calc-card">
        <div class="calc-line"><span>Consultas Conjuntas</span><span>${ambResumo.porMedico[medico].consultas}</span></div>
        <div class="calc-line"><span>Valor Líquido Ambulatório</span><span>${formatBRL(ambResumo.porMedico[medico].valorLiquido)}</span></div>
      </div>
      ` : ''}

      <div class="repasse-assinatura">
        <p class="repasse-assinatura-label">Assinatura Digital — ${nomeCompleto}</p>
        <canvas class="assinatura-canvas" data-medico="${medico}" width="500" height="130"></canvas>
        <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
          <button class="btn-secondary btn-limpar-assinatura" data-medico="${medico}" style="font-size:0.75rem; padding:0.3rem 0.75rem;">Limpar</button>
        </div>
      </div>
    </div>
  `;
}

function setupSignatureCanvases() {
  document.querySelectorAll('.assinatura-canvas').forEach(canvas => {
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#20515F';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    let drawing = false;
    let lastX = 0, lastY = 0;

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if (e.touches) {
        return [(e.touches[0].clientX - rect.left) * scaleX, (e.touches[0].clientY - rect.top) * scaleY];
      }
      return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
    }

    canvas.addEventListener('mousedown', e => { drawing = true; [lastX, lastY] = getPos(e); });
    canvas.addEventListener('mousemove', e => {
      if (!drawing) return;
      const [x, y] = getPos(e);
      ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke();
      [lastX, lastY] = [x, y];
    });
    canvas.addEventListener('mouseup', () => { drawing = false; });
    canvas.addEventListener('mouseleave', () => { drawing = false; });

    canvas.addEventListener('touchstart', e => { e.preventDefault(); drawing = true; [lastX, lastY] = getPos(e); }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (!drawing) return;
      const [x, y] = getPos(e);
      ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke();
      [lastX, lastY] = [x, y];
    }, { passive: false });
    canvas.addEventListener('touchend', () => { drawing = false; });
  });

  document.querySelectorAll('.btn-limpar-assinatura').forEach(btn => {
    btn.addEventListener('click', () => {
      const canvas = document.querySelector(`.assinatura-canvas[data-medico="${btn.dataset.medico}"]`);
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    });
  });
}

// === T17 — PROMPT DE CRM FALTANTE ===
function showPrompt(message, defaultValue) {
  return new Promise((resolve) => {
    const value = prompt(message, defaultValue || '');
    resolve(value);
  });
}

async function checkAndPromptCRMs(medicosComVisitas) {
  for (const medico of medicosComVisitas) {
    const info = (repasseConfig.medicos && repasseConfig.medicos[medico]) || {};
    if (!info.crm) {
      const crm = await showPrompt(`Para gerar o relatório de ${medico}, informe o CRM:`, '');
      if (crm && crm.trim()) {
        const medicosAtualizado = { ...(repasseConfig.medicos || {}) };
        if (!medicosAtualizado[medico]) medicosAtualizado[medico] = {};
        medicosAtualizado[medico].crm = crm.trim();
        await saveRepasseConfig({ medicos: medicosAtualizado });
      }
    }
    // Também preencher nome completo se vazio
    const infoAtualizada = (repasseConfig.medicos && repasseConfig.medicos[medico]) || {};
    if (!infoAtualizada.nome_completo) {
      const nome = await showPrompt(`Nome completo do(a) Dr(a). ${medico}:`, `Dr. ${medico}`);
      if (nome && nome.trim()) {
        const medicosAtualizado = { ...(repasseConfig.medicos || {}) };
        if (!medicosAtualizado[medico]) medicosAtualizado[medico] = {};
        medicosAtualizado[medico].nome_completo = nome.trim();
        await saveRepasseConfig({ medicos: medicosAtualizado });
      }
    }
  }
}

// === T18 — GERAR RELATÓRIO E ALTERNÂNCIA DE MODOS ===
async function gerarRelatorio() {
  const { mes, ano } = getSelectedMesAno();
  const valorTotal = parseBRL(document.getElementById('repasse-valor-total')?.value);

  // Validação
  if (!valorTotal || valorTotal <= 0) {
    showToast('Informe o valor total recebido');
    return;
  }

  const incluidos = repassePacientes.filter(p => p.incluido);
  if (incluidos.length === 0) {
    showToast('Nenhum paciente incluído na lista');
    return;
  }

  // Salvar dados antes de gerar
  await saveRepasseData();

  // Carregar histórico do mês
  await loadHistoricoMes(mes, ano);
  // T23 — Carregar consultas ambulatoriais do mês
  await loadAmbulatorioMes(mes, ano);

  if (historicoMes.length === 0) {
    showToast('Nenhuma visita registrada neste mês');
    return;
  }

  // T17 — Verificar CRMs faltantes
  const doctorsList = window.DOCTORS || [];
  const medicosComVisitas = doctorsList.filter(d =>
    historicoMes.some(h => h.medico === d)
  );
  await checkAndPromptCRMs(medicosComVisitas);

  // Calcular
  const dados = calcularRepasse(repasseConfig, repasseFatura, repassePacientes, historicoMes);

  // Filtrar pacientes para o relatório: incluídos e status != NÃO
  const pacientesRelatorio = incluidos.filter(p => p.status_pagamento !== 'NÃO');

  // Renderizar
  const container = document.querySelector('#screen-repasse .repasse-relatorio');
  if (!container) return;

  // T23 — Agregar ambulatório (null se não houver consultas)
  const ambResumo = calcAmbulatorioResumo(ambulatorioMes);

  let html = renderPag1(dados, pacientesRelatorio, ambResumo);

  for (const medico of medicosComVisitas) {
    html += renderPag2(medico, dados, ambResumo);
  }

  container.innerHTML = html;
  setupSignatureCanvases();

  // Botões de download individual por médico
  container.querySelectorAll('.btn-pdf-medico').forEach(btn => {
    btn.addEventListener('click', () => downloadPDFMedico(btn.dataset.medico, btn));
  });

  // Alternar para modo relatório
  const screen = document.getElementById('screen-repasse');
  screen.classList.add('modo-relatorio');
  screen.classList.remove('modo-entrada');
  container.style.display = '';
  document.getElementById('btn-gerar-repasse').style.display = 'none';
  document.getElementById('btn-editar-repasse').style.display = '';
  document.getElementById('btn-imprimir-repasse').style.display = '';
}

function voltarParaEntrada() {
  const screen = document.getElementById('screen-repasse');
  screen.classList.remove('modo-relatorio');
  screen.classList.add('modo-entrada');
  document.querySelector('#screen-repasse .repasse-relatorio').style.display = 'none';
  document.getElementById('btn-gerar-repasse').style.display = '';
  document.getElementById('btn-editar-repasse').style.display = 'none';
  document.getElementById('btn-imprimir-repasse').style.display = 'none';
}

// === T13 — MODAL CONFIG ===
function openRepasseConfigModal() {
  renderConfigModal();
  document.getElementById('repasse-config-modal').classList.add('active');
}

function closeRepasseConfigModal() {
  document.getElementById('repasse-config-modal').classList.remove('active');
}

function renderConfigModal() {
  if (!repasseConfig) return;

  document.getElementById('cfg-pct-impostos').value = repasseConfig.pct_impostos;
  document.getElementById('cfg-pct-adm').value = repasseConfig.pct_adm;
  document.getElementById('cfg-pct-samira').value = repasseConfig.pct_samira;

  const doctorsList = window.DOCTORS || [];
  const descontos = repasseConfig.descontos_sala || {};
  const medicos = repasseConfig.medicos || {};

  const descontosContainer = document.getElementById('cfg-descontos-sala');
  descontosContainer.innerHTML = doctorsList.map(d => `
    <div class="form-row" style="align-items:center; margin-bottom:0.5rem;">
      <label style="flex:1; margin:0;">${d}</label>
      <input type="number" class="cfg-desconto" data-medico="${d}"
        value="${descontos[d] || 0}" step="0.01" min="0"
        style="width:120px; flex:none;">
    </div>
  `).join('');

  const medicosContainer = document.getElementById('cfg-medicos');
  medicosContainer.innerHTML = doctorsList.map(d => {
    const info = medicos[d] || {};
    return `
      <div style="margin-bottom:1rem; padding:0.75rem; background:#f9fafa; border-radius:var(--radius-md);">
        <strong style="font-family:var(--font-title); color:var(--color-primary);">${d}</strong>
        <div class="form-row" style="margin-top:0.5rem;">
          <div class="form-group" style="min-width:150px;">
            <label>Nome completo</label>
            <input type="text" class="cfg-medico-nome" data-medico="${d}"
              value="${info.nome_completo || ''}" placeholder="Dr. ...">
          </div>
          <div class="form-group" style="min-width:100px;">
            <label>CRM</label>
            <input type="text" class="cfg-medico-crm" data-medico="${d}"
              value="${info.crm || ''}" placeholder="000000">
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// === T12 — Adicionar paciente manual ===
function addPacienteManual() {
  const nome = prompt('Nome do paciente:');
  if (!nome || !nome.trim()) return;

  const { mes, ano } = getSelectedMesAno();
  const primeiroDia = `${ano}-${String(mes).padStart(2, '0')}-01`;

  repassePacientes.push({
    patient_id: null,
    nome_override: nome.trim(),
    periodo_inicio: primeiroDia,
    periodo_fim: null,
    hospital: '',
    status_pagamento: null,
    valor_recebido: null,
    incluido: true,
    _nome_display: nome.trim(),
    _unsaved: true
  });

  renderRepasseEntrada();
  debounceSave();
}

// === DOWNLOAD PDF ===
async function gerarPDF(pages, nomeArquivo, btnRef) {
  if (btnRef) { btnRef.textContent = 'Gerando...'; btnRef.disabled = true; }
  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    let first = true;
    for (const page of pages) {
      const canvas = await html2canvas(page, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      if (!first) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight);
      first = false;
    }
    pdf.save(nomeArquivo);
    showToast('PDF baixado');
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
    showToast('Erro ao gerar PDF');
  } finally {
    if (btnRef) { btnRef.textContent = btnRef.dataset.label || 'Baixar PDF'; btnRef.disabled = false; }
  }
}

async function downloadPDF() {
  const btn = document.getElementById('btn-imprimir-repasse');
  const container = document.querySelector('#screen-repasse .repasse-relatorio');
  const pages = [...container.querySelectorAll('.repasse-pag1, .repasse-pag2')];
  const { mes, ano } = getSelectedMesAno();
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  await gerarPDF(pages, `repasse-completo-${meses[mes - 1]}-${ano}.pdf`, btn);
}

async function downloadPDFMedico(medico, btn) {
  const container = document.querySelector('#screen-repasse .repasse-relatorio');
  const pagMedico = container.querySelector(`.repasse-pag2[data-medico="${medico}"]`);
  if (!pagMedico) return;
  const { mes, ano } = getSelectedMesAno();
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const nomeArquivo = `repasse-${medico.toLowerCase().replace(/\s+/g, '-')}-${meses[mes - 1]}-${ano}.pdf`;
  await gerarPDF([pagMedico], nomeArquivo, btn);
}

// === PAGAMENTOS PENDENTES DE MESES ANTERIORES ===
async function loadPendentesMesesAnteriores(mesAtual, anoAtual) {
  const card = document.getElementById('pendentes-card');
  const lista = document.getElementById('pendentes-lista');
  if (!card || !lista) return;

  // Buscar faturas de meses anteriores
  const { data: faturas } = await supabaseClient
    .from('repasse_fatura')
    .select('id, mes, ano')
    .order('ano', { ascending: false })
    .order('mes', { ascending: false });

  if (!faturas || faturas.length === 0) { card.style.display = 'none'; return; }

  // Filtrar apenas meses anteriores ao atual
  const faturasAnteriores = faturas.filter(f =>
    f.ano < anoAtual || (f.ano === anoAtual && f.mes < mesAtual)
  );
  if (faturasAnteriores.length === 0) { card.style.display = 'none'; return; }

  // Buscar pacientes pendentes (status NÃO ou null) dessas faturas
  const faturasIds = faturasAnteriores.map(f => f.id);
  const { data: pendentes } = await supabaseClient
    .from('repasse_paciente')
    .select('*, repasse_fatura(mes, ano)')
    .in('fatura_id', faturasIds)
    .or('status_pagamento.is.null,status_pagamento.eq.NÃO,status_pagamento.eq.PARCIAL')
    .eq('incluido', true);

  if (!pendentes || pendentes.length === 0) { card.style.display = 'none'; return; }

  // Filtrar pacientes que já estão no mês atual
  const jaIncluidos = new Set(repassePacientes.map(p => p.patient_id).filter(Boolean));
  const filtrados = pendentes.filter(p => !p.patient_id || !jaIncluidos.has(p.patient_id));

  if (filtrados.length === 0) { card.style.display = 'none'; return; }

  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  lista.innerHTML = filtrados.map((p, idx) => {
    const nome = p.nome_override ||
      (window.patients || []).find(pt => pt.id === p.patient_id)?.pacienteNome || '(paciente)';
    const mesRef = p.repasse_fatura ? `${meses[p.repasse_fatura.mes - 1]}/${p.repasse_fatura.ano}` : '—';
    const statusLabel = p.status_pagamento === 'PARCIAL' ? ' · Parcial' : '';
    return `
      <div class="pendente-item" data-idx="${idx}">
        <div>
          <strong>${nome}</strong>
          <span class="repasse-historico-meta">Ref: ${mesRef}${statusLabel} · ${p.hospital || '—'}</span>
        </div>
        <button class="btn-secondary btn-incluir-pendente" data-idx="${idx}"
          style="font-size:0.8rem; padding:0.35rem 0.9rem; white-space:nowrap;">+ Incluir</button>
      </div>
    `;
  }).join('');

  card.style.display = '';

  lista.querySelectorAll('.btn-incluir-pendente').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = filtrados[Number(btn.dataset.idx)];
      const nome = p.nome_override ||
        (window.patients || []).find(pt => pt.id === p.patient_id)?.pacienteNome || '(paciente)';

      repassePacientes.push({
        patient_id: p.patient_id,
        nome_override: p.nome_override,
        periodo_inicio: p.periodo_inicio,
        periodo_fim: p.periodo_fim,
        hospital: p.hospital,
        status_pagamento: null,
        valor_recebido: p.status_pagamento === 'PARCIAL' ? p.valor_recebido : null,
        incluido: true,
        _nome_display: nome,
        _ref_mes_anterior: true
      });

      renderRepasseEntrada();
      debounceSave();

      // Remover da lista de pendentes
      btn.closest('.pendente-item').remove();
      if (lista.querySelectorAll('.pendente-item').length === 0) card.style.display = 'none';
    });
  });
}

// === EVENT LISTENERS ===
document.addEventListener('DOMContentLoaded', () => {
  // Seletor de mês/ano — T08
  const mesSelect = document.getElementById('repasse-mes');
  const anoSelect = document.getElementById('repasse-ano');
  if (mesSelect) mesSelect.addEventListener('change', loadRepasseMes);
  if (anoSelect) anoSelect.addEventListener('change', loadRepasseMes);

  // Valor total — auto-save
  // Total recebido é calculado automaticamente — sem listener manual

  // Delegação de eventos na tabela de pacientes — T10/T11
  const tbody = document.querySelector('#repasse-pacientes-table tbody');
  if (tbody) {
    tbody.addEventListener('change', (e) => {
      const idx = Number(e.target.dataset.idx);
      if (isNaN(idx) || !repassePacientes[idx]) return;

      if (e.target.classList.contains('rep-periodo-inicio')) {
        repassePacientes[idx].periodo_inicio = e.target.value;
        // Recalcula qtd_visitas e atualiza linha
        renderRepasseEntrada();
        debounceSave();
      } else if (e.target.classList.contains('rep-periodo-fim')) {
        repassePacientes[idx].periodo_fim = e.target.value || null;
        renderRepasseEntrada();
        debounceSave();
      } else if (e.target.classList.contains('rep-status')) {
        repassePacientes[idx].status_pagamento = e.target.value || null;
        renderRepasseEntrada();
        recalcularTotal();
        atualizarResumo();
        debounceSave();
      } else if (e.target.classList.contains('rep-incluido')) {
        repassePacientes[idx].incluido = e.target.checked;
        recalcularTotal();
        atualizarResumo();
        const tr = e.target.closest('tr');
        if (tr) tr.classList.toggle('paciente-excluido', !e.target.checked);
        debounceSave();
      }
    });

    tbody.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.idx);
      if (isNaN(idx) || !repassePacientes[idx]) return;

      if (e.target.classList.contains('rep-valor')) {
        const val = parseBRL(e.target.value);
        repassePacientes[idx].valor_recebido = val;
        // Auto-PARCIAL: se valor recebido < valor esperado (valor_visita × qtd_visitas)
        const pac = repassePacientes[idx];
        const valorVisita = Number(pac.valor_visita) || 0;
        const qtdVisitas = calcQtdVisitas(pac.periodo_inicio, pac.periodo_fim);
        const valorEsperado = valorVisita * qtdVisitas;
        if (valorVisita > 0 && val > 0 && val < valorEsperado) {
          repassePacientes[idx].status_pagamento = 'PARCIAL';
        }
        // Atualiza classe de inconsistência no próprio input sem re-renderizar tudo
        const descontoPac = Number(pac.desconto_paciente) || 0;
        const valorEsperadoLiq = valorEsperado - descontoPac;
        const inconsistente = valorVisita > 0 && val > 0 && Math.abs(val - valorEsperadoLiq) > 0.01;
        e.target.classList.toggle('rep-valor-inconsistente', inconsistente);
        // Re-renderiza se mudou o status para PARCIAL
        if (valorVisita > 0 && val > 0 && val < valorEsperado) {
          renderRepasseEntrada();
        }
        recalcularTotal();
        atualizarResumo();
        debounceSave();
      } else if (e.target.classList.contains('rep-valor-previsto')) {
        repassePacientes[idx].valor_previsto = parseBRL(e.target.value);
        debounceSave();
      } else if (e.target.classList.contains('rep-valor-visita')) {
        repassePacientes[idx].valor_visita = parseBRL(e.target.value);
        debounceSave();
      } else if (e.target.classList.contains('rep-desconto-paciente')) {
        repassePacientes[idx].desconto_paciente = parseBRL(e.target.value);
        debounceSave();
      }
    });

    // Formatar valores ao sair do campo + atualizar display de consistência
    tbody.addEventListener('blur', (e) => {
      const formatClasses = ['rep-valor', 'rep-valor-previsto', 'rep-valor-visita', 'rep-desconto-paciente'];
      if (formatClasses.some(c => e.target.classList.contains(c))) {
        const val = parseBRL(e.target.value);
        if (val > 0) e.target.value = formatBRL(val);
        // Após blur, re-renderiza a linha para atualizar a coluna "Valor da Visita" e indicador
        const idx = Number(e.target.dataset.idx);
        if (!isNaN(idx) && repassePacientes[idx]) {
          renderRepasseEntrada();
        }
      }
    }, true);

    // Expand/collapse sub-row
    tbody.addEventListener('click', (e) => {
      const expandBtn = e.target.closest('.rep-expand-btn');
      if (expandBtn) {
        const idx = Number(expandBtn.dataset.idx);
        if (isNaN(idx)) return;
        if (_expandedRows.has(idx)) {
          _expandedRows.delete(idx);
        } else {
          _expandedRows.add(idx);
        }
        renderRepasseEntrada();
        return;
      }
    });

    // T12 — Deletar paciente
    tbody.addEventListener('click', async (e) => {
      const btn = e.target.closest('.rep-delete');
      if (!btn) return;
      const idx = Number(btn.dataset.idx);
      if (isNaN(idx) || !repassePacientes[idx]) return;

      const nome = getNomeDisplay(repassePacientes[idx]);
      const confirmar = typeof showConfirm === 'function'
        ? await showConfirm(`Remover "${nome}" da lista?`)
        : confirm(`Remover "${nome}" da lista?`);
      if (!confirmar) return;

      if (repassePacientes[idx].id) {
        await deletePaciente(repassePacientes[idx].id);
      }
      repassePacientes.splice(idx, 1);
      renderRepasseEntrada();
    });
  }

  // T12 — Adicionar paciente manual
  const btnAddPaciente = document.getElementById('btn-add-paciente-repasse');
  if (btnAddPaciente) btnAddPaciente.addEventListener('click', addPacienteManual);

  // T18 — Gerar relatório, voltar para edição, imprimir
  const btnGerar = document.getElementById('btn-gerar-repasse');
  if (btnGerar) btnGerar.addEventListener('click', gerarRelatorio);

  const btnEditar = document.getElementById('btn-editar-repasse');
  if (btnEditar) btnEditar.addEventListener('click', voltarParaEntrada);

  const btnImprimir = document.getElementById('btn-imprimir-repasse');
  if (btnImprimir) btnImprimir.addEventListener('click', downloadPDF);

  // T13 — Config modal
  const btnConfig = document.getElementById('btn-repasse-config');
  if (btnConfig) btnConfig.addEventListener('click', openRepasseConfigModal);

  const btnFecharConfig = document.getElementById('btn-fechar-config-repasse');
  if (btnFecharConfig) btnFecharConfig.addEventListener('click', closeRepasseConfigModal);

  const btnSalvarConfig = document.getElementById('btn-salvar-config-repasse');
  if (btnSalvarConfig) {
    btnSalvarConfig.addEventListener('click', async () => {
      const doctorsList = window.DOCTORS || [];
      const descontos = {};
      document.querySelectorAll('.cfg-desconto').forEach(el => {
        descontos[el.dataset.medico] = Number(el.value) || 0;
      });
      const medicos = {};
      doctorsList.forEach(d => {
        const nomeEl = document.querySelector(`.cfg-medico-nome[data-medico="${d}"]`);
        const crmEl = document.querySelector(`.cfg-medico-crm[data-medico="${d}"]`);
        medicos[d] = {
          nome_completo: nomeEl ? nomeEl.value.trim() : '',
          crm: crmEl ? crmEl.value.trim() : ''
        };
      });

      await saveRepasseConfig({
        pct_impostos: Number(document.getElementById('cfg-pct-impostos').value),
        pct_adm: Number(document.getElementById('cfg-pct-adm').value),
        pct_samira: Number(document.getElementById('cfg-pct-samira').value),
        descontos_sala: descontos,
        medicos: medicos
      });
    });
  }

  // Fechar modal ao clicar no overlay
  const configModal = document.getElementById('repasse-config-modal');
  if (configModal) {
    configModal.addEventListener('click', (e) => {
      if (e.target === configModal) closeRepasseConfigModal();
    });
  }
});
