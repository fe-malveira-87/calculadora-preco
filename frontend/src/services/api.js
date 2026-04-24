const API_BASE = (() => {
  const raw = import.meta.env.VITE_API_URL
  if (raw !== undefined && raw !== '') return raw.replace(/\/$/, '')
  if (import.meta.env.PROD) return ''
  return 'http://localhost:8000'
})()

async function authHeaders(getToken) {
  const headers = {}
  if (typeof getToken === 'function') {
    const token = await getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  return headers
}

async function parseError(res) {
  let detail = res.statusText
  try {
    const j = await res.json()
    if (j?.detail) detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
  } catch { /* ignore */ }
  return detail
}

export async function getListings(getToken) {
  const res = await fetch(`${API_BASE}/listings`, {
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function calcular(payload, getToken) {
  const res = await fetch(`${API_BASE}/calculadora/calcular`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders(getToken)) },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function getMe(getToken) {
  const res = await fetch(`${API_BASE}/me`, {
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function getRules(getToken) {
  const res = await fetch(`${API_BASE}/rules`, {
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function getRule(nome, getToken) {
  const res = await fetch(`${API_BASE}/rules/${nome}`, {
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function updateRule(nome, conteudo, getToken) {
  const res = await fetch(`${API_BASE}/rules/${nome}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders(getToken)) },
    body: JSON.stringify({ conteudo }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function criarRule(nome, conteudo, getToken) {
  const res = await fetch(`${API_BASE}/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders(getToken)) },
    body: JSON.stringify({ nome, conteudo }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function arquivarRule(nome, getToken) {
  const res = await fetch(`${API_BASE}/rules/${nome}/arquivar`, {
    method: 'PATCH',
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function desarquivarRule(nome, getToken) {
  const res = await fetch(`${API_BASE}/rules/${nome}/desarquivar`, {
    method: 'PATCH',
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function deletarRule(nome, getToken) {
  const res = await fetch(`${API_BASE}/rules/${nome}`, {
    method: 'DELETE',
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function getRuleHistory(nome, getToken) {
  const res = await fetch(`${API_BASE}/rules/${nome}/history`, {
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function criarAprovacao(payload, getToken) {
  const res = await fetch(`${API_BASE}/aprovacoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders(getToken)) },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function getAprovacoes(getToken) {
  const res = await fetch(`${API_BASE}/aprovacoes`, {
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function getAprovacao(id, getToken) {
  const res = await fetch(`${API_BASE}/aprovacoes/${id}`, {
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function aprovar(id, observacao, getToken) {
  const res = await fetch(`${API_BASE}/aprovacoes/${id}/aprovar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders(getToken)) },
    body: JSON.stringify({ observacao }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function rejeitar(id, motivo, getToken) {
  const res = await fetch(`${API_BASE}/aprovacoes/${id}/rejeitar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders(getToken)) },
    body: JSON.stringify({ motivo }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function getAuditoria(getToken) {
  const res = await fetch(`${API_BASE}/aprovacoes/auditoria`, {
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function solicitarAprovacao(payload, getToken) {
  const res = await fetch(`${API_BASE}/aprovacao/solicitar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders(getToken)) },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function getFilaAprovacao(getToken) {
  const res = await fetch(`${API_BASE}/aprovacao/fila`, {
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function getHistoricoAprovacao(getToken) {
  const res = await fetch(`${API_BASE}/aprovacao/historico`, {
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function getAuditoriaAprovacao(getToken) {
  const res = await fetch(`${API_BASE}/aprovacao/auditoria`, {
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function aprovarSolicitacao(id, comentario, getToken) {
  const res = await fetch(`${API_BASE}/aprovacao/${id}/aprovar`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders(getToken)) },
    body: JSON.stringify({ comentario }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function rejeitarSolicitacao(id, comentario, getToken) {
  const res = await fetch(`${API_BASE}/aprovacao/${id}/rejeitar`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders(getToken)) },
    body: JSON.stringify({ comentario }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function getDashboardResumo(getToken) {
  const res = await fetch(`${API_BASE}/dashboard/resumo`, {
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function getDashboardHistorico(getToken) {
  const res = await fetch(`${API_BASE}/dashboard/historico`, {
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function getScoreImoveis(listingId, getToken) {
  const res = await fetch(`${API_BASE}/dashboard/score/${listingId}`, {
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

async function _downloadBlob(getToken, url, filename) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function exportExcel(getToken) {
  return _downloadBlob(getToken, '/dashboard/export/excel', 'aprovacoes.xlsx')
}

export function exportPdf(getToken) {
  return _downloadBlob(getToken, '/dashboard/export/pdf', 'aprovacoes.pdf')
}

export async function analisarIA(payload, getToken) {
  const res = await fetch(`${API_BASE}/ia/analisar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders(getToken)) },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}
