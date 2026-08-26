/* ============================================================
   NuMo Showroom — Client API (fetch wrapper + bearer token)
============================================================ */
'use strict';

window.API = {
  token: localStorage.getItem('sm_token') || null,

  setToken(tok) {
    this.token = tok;
    if (tok) localStorage.setItem('sm_token', tok);
    else localStorage.removeItem('sm_token');
  },

  async req(method, path, body) {
    const opts = { method: method, headers: {} };
    if (this.token) opts.headers['Authorization'] = 'Bearer ' + this.token;
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    let res, data;
    try {
      res = await fetch('/api' + path, opts);
    } catch (e) {
      throw Object.assign(new Error('Tidak dapat terhubung ke server'), { status: 0, data: {} });
    }
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) {
      if (res.status === 401 && this.token && path !== '/auth/login') {
        this.setToken(null);
        location.reload();
      }
      throw Object.assign(new Error(data.message || ('Permintaan gagal (' + res.status + ')')),
        { status: res.status, data: data });
    }
    return data;
  },

  get(p)     { return this.req('GET', p); },
  post(p, b) { return this.req('POST', p, b); },
  put(p, b)  { return this.req('PUT', p, b); },
  patch(p, b){ return this.req('PATCH', p, b); },
  del(p)     { return this.req('DELETE', p); }
};