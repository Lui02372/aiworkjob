/** Server-only client for other AI agents. No credentials belong in browser code. */
export class AccountManagerError extends Error {
  constructor(message, status = 0, code = 'account_manager_error') { super(message); this.name = 'AccountManagerError'; this.status = status; this.code = code; }
}

export class AccountManagerClient {
  #token;
  constructor({ baseUrl = process.env.AUA_URL || 'http://127.0.0.1:8780', token = process.env.AUA_TOKEN, fetchImpl = fetch, timeoutMs = 15000 } = {}) {
    if (typeof window !== 'undefined') throw new AccountManagerError('Use the account manager client only on a trusted server.', 0, 'server_only');
    let url; try { url = new URL(baseUrl); } catch { throw new AccountManagerError('Invalid account manager URL.', 0, 'invalid_url'); }
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new AccountManagerError('Use HTTPS or a loopback server URL with no embedded credentials.', 0, 'invalid_url');
    if (typeof token !== 'string' || !/^aua_[A-Za-z0-9_-]{20,}$/.test(token)) throw new AccountManagerError('A server-held AUA_TOKEN is required.', 0, 'not_configured');
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) throw new AccountManagerError('Invalid request timeout.', 0, 'invalid_timeout');
    this.baseUrl = url.origin; this.#token = token; this.fetchImpl = fetchImpl; this.timeoutMs = timeoutMs;
  }
  async request(path, { method = 'GET', body } = {}) {
    const target = new URL(path, this.baseUrl);
    if (target.origin !== this.baseUrl || !target.pathname.startsWith('/api/agent/') || target.search || target.hash) throw new AccountManagerError('Only scoped API paths on the configured server are allowed.', 400, 'invalid_path');
    let response;
    try {
      response = await this.fetchImpl(target, { method, redirect: 'error', signal: AbortSignal.timeout(this.timeoutMs), headers: { Authorization: `Bearer ${this.#token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    } catch { throw new AccountManagerError('The local account manager is unavailable or the request timed out. Inspect status before retrying a financial operation.', 0, 'unavailable'); }
    let result; try { result = await response.json(); } catch { throw new AccountManagerError('The account manager returned an invalid response.', response.status, 'invalid_response'); }
    if (!response.ok) throw new AccountManagerError(typeof result.error === 'string' ? result.error : 'The account manager rejected the operation.', response.status, ({ 401: 'vault_locked_or_invalid_token', 403: 'scope_denied', 409: 'conflict', 423: 'paused_or_locked', 429: 'call_budget_exhausted' })[response.status] || 'request_rejected');
    return result;
  }
  capabilities() { return this.request('/api/agent/capabilities'); }
  accounts() { return this.request('/api/agent/accounts'); }
  delegations() { return this.request('/api/agent/delegations'); }
  jobs() { return this.request('/api/agent/jobs'); }
  createJob(input) { return this.request('/api/agent/jobs', { method: 'POST', body: input }); }
  createMission(input) {
    if (!input?.requestKey || !input?.sourceId || input.aiUsePermission !== 'allowed') throw new AccountManagerError('A stable requestKey, sourceId and allowed AI-use assertion are required.', 400, 'invalid_mission');
    return this.request('/api/agent/missions', { method: 'POST', body: input });
  }
  missions() { return this.request('/api/agent/missions'); }
  mission(id) { return this.request(`/api/agent/missions/${this.id(id)}`); }
  product(id) { return this.request(`/api/agent/products/${this.id(id)}`); }
  id(value) { if (typeof value !== 'string' || !/^[a-f0-9-]{20,50}$/.test(value)) throw new AccountManagerError('Invalid object ID.', 400, 'invalid_id'); return value; }
}
