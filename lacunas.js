// Dias de visita esperados: cada dia corrido da internação, inclusive fim de semana.
// Pendente = dia esperado sem linha em historico e sem marca de "sem visita".
(function (root) {
  function parseIso(iso) {
    const parts = String(iso || '').split('-').map(Number);
    return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  }

  function toIso(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function eachIso(startIso, endIso) {
    if (!startIso || !endIso || startIso > endIso) return [];
    const days = [];
    const cursor = parseIso(startIso);
    const end = parseIso(endIso);
    while (cursor <= end) {
      days.push(toIso(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }

  function isAlta(patient) {
    return String((patient && patient.statusManual) || '').trim().toLowerCase() === 'alta';
  }

  function fimInternacao(patient, todayIso) {
    if (!patient) return todayIso;
    if (isAlta(patient)) return patient.dataAlta || patient.dataUltimaVisita || todayIso;
    return todayIso;
  }

  function visitDates(patient) {
    return new Set((patient.historico || []).map(function (h) { return h.data; }).filter(Boolean));
  }

  function semVisitaDates(patient) {
    return new Set(patient.diasSemVisita || []);
  }

  function missingBetween(patient, inicio, fim) {
    const visits = visitDates(patient);
    const sem = semVisitaDates(patient);
    return eachIso(inicio, fim).filter(function (dia) {
      return !visits.has(dia) && !sem.has(dia);
    });
  }

  function monthBounds(ano, mes) {
    const mm = String(mes).padStart(2, '0');
    const last = new Date(ano, mes, 0).getDate();
    return {
      inicio: ano + '-' + mm + '-01',
      fim: ano + '-' + mm + '-' + String(last).padStart(2, '0')
    };
  }

  function resumirNoMes(patient, ano, mes, todayIso) {
    const vazio = { inicio: null, fim: null, cobraveis: [], lancados: [], pendentes: [], semVisita: [] };
    if (!patient || !patient.dataPrimeiraAvaliacao) return vazio;
    const bounds = monthBounds(ano, mes);
    const inicio = patient.dataPrimeiraAvaliacao > bounds.inicio ? patient.dataPrimeiraAvaliacao : bounds.inicio;
    let fim = fimInternacao(patient, todayIso);
    if (fim > bounds.fim) fim = bounds.fim;
    if (fim > todayIso) fim = todayIso;
    if (inicio > fim) return vazio;

    const visits = visitDates(patient);
    const sem = semVisitaDates(patient);
    const days = eachIso(inicio, fim);
    return {
      inicio: inicio,
      fim: fim,
      cobraveis: days.filter(function (dia) { return !sem.has(dia); }),
      lancados: days.filter(function (dia) { return visits.has(dia); }),
      pendentes: days.filter(function (dia) { return !visits.has(dia) && !sem.has(dia); }),
      semVisita: days.filter(function (dia) { return sem.has(dia); })
    };
  }

  root.Lacunas = {
    eachIso: eachIso,
    fimInternacao: fimInternacao,
    missingBetween: missingBetween,
    resumirNoMes: resumirNoMes
  };
})(typeof window !== 'undefined' ? window : globalThis);
