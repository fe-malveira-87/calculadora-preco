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

export async function getRuleHistory(nome, getToken) {
  const res = await fetch(`${API_BASE}/rules/${nome}/history`, {
    headers: await authHeaders(getToken),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}
