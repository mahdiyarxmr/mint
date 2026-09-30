/* Mint — admin console: user grants, bans, announcements. */
(() => {
  const lang = document.documentElement.lang || 'fa';
  const T = (k) => (window.MINT && window.MINT.t && window.MINT.t[k]) || k;
  const N = (n) => Number(n).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const toast = (m, kind) => window.MINT && window.MINT.toast ? window.MINT.toast(m, kind) : null;

  const post = async (url, body) => {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || j.error || 'error');
    return j;
  };

  /* ------------------------------------------------ user grants */
  let target = null;
  const label = $('#gTarget');

  $$('.js-pick').forEach(b => b.addEventListener('click', () => {
    target = +b.dataset.uid;
    if (label) label.textContent = b.dataset.un;
    $$('.js-pick').forEach(x => x.classList.remove('btn-primary'));
    b.classList.add('btn-primary');
    const box = document.querySelector('.grantbox');
    if (box && window.innerWidth < 1020) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));

  const rowOf = (id) => document.querySelector(`tr[data-uid="${id}"]`);

  async function grant(action, payload) {
    if (!target) { toast(T('adm.grantTo'), 'warn'); return; }
    try {
      const j = await post('/api/admin/user/' + target, { action, ...payload });
      const row = rowOf(target);
      if (row) {
        const c = row.querySelector('.js-coins'); if (c) c.textContent = N(j.user.coins);
        const cr = row.querySelector('.js-credits'); if (cr) cr.textContent = N(j.user.credits);
      }
      toast(T('adm.done'), 'success');
      if (action === 'plan' || action === 'gift') setTimeout(() => location.reload(), 700);
    } catch (e) { toast(e.message, 'error'); }
  }

  $$('.grantbox [data-act]').forEach(b => b.addEventListener('click', () => {
    const act = b.dataset.act;
    if (act === 'coins' || act === 'credits') {
      const v = +($('#' + b.dataset.src)?.value || 0);
      if (!v) return toast(T('adm.apply'), 'warn');
      grant(act, { amount: v });
    } else if (act === 'plan') {
      grant('plan', { plan: $('#gPlan').value, days: +$('#gDays').value || 30 });
    } else if (act === 'gift') {
      grant('gift', { itemId: $('#gItem').value });
    }
  }));

  $$('.js-ban').forEach(b => b.addEventListener('click', async () => {
    try {
      await post('/api/admin/user/' + b.dataset.uid, { action: b.dataset.act });
      toast(T('adm.done'), 'success');
      setTimeout(() => location.reload(), 500);
    } catch (e) { toast(e.message, 'error'); }
  }));

  /* --------------------------------------------- announcements */
  const post_ = $('#anPost');
  if (post_) post_.addEventListener('click', async () => {
    const title = $('#anT').value.trim(), body = $('#anB').value.trim();
    if (!title || !body) return toast(T('ann.subject'), 'warn');
    post_.disabled = true;
    try {
      await post('/api/admin/announce', { title, body, level: $('#anL').value });
      toast(T('ann.posted'), 'success');
      setTimeout(() => location.reload(), 600);
    } catch (e) { toast(e.message, 'error'); post_.disabled = false; }
  });

  $$('.js-ann-toggle').forEach(b => b.addEventListener('click', async () => {
    await post('/api/admin/announce', { op: 'toggle', id: b.dataset.aid });
    location.reload();
  }));
  $$('.js-ann-del').forEach(b => b.addEventListener('click', async () => {
    await post('/api/admin/announce', { op: 'delete', id: b.dataset.aid });
    location.reload();
  }));
})();

/* ===================== settings · full user editing · bulk ================= */
(() => {
  const lang = document.documentElement.lang || 'fa';
  const T = (k) => (window.MINT && window.MINT.t && window.MINT.t[k]) || k;
  const N = (n) => Number(n).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const toast = (m, k) => window.MINT && window.MINT.toast ? window.MINT.toast(m, k) : window.mintToast?.(m, k);

  const post = async (url, body) => {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || j.error || ('HTTP ' + r.status));
    return j;
  };

  /* ----------------------------------------------- provider field switching */
  const prov = $('#cProvider');
  const syncProvider = () => {
    if (!prov) return;
    $$('.pv').forEach(el => el.classList.toggle('hide', !el.classList.contains('pv-' + prov.value)));
  };
  prov?.addEventListener('change', syncProvider);
  syncProvider();

  /* --------------------------------------------------------- save settings */
  const val = (id) => $(id)?.value ?? '';
  const numv = (id) => +($(id)?.value || 0);

  $('#cSave')?.addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      await post('/api/admin/config', {
        provider: val('#cProvider'), model: val('#cModel'),
        workerUrl: val('#kWurl'), workerKey: val('#kWkey'),
        llmBase: val('#kLlmBase'), llmKey: val('#kLlm'), llmModel: val('#kLlmModel'),
        pollinationsToken: val('#kPoll'),
        cfAccount: val('#kCfAcc'), cfToken: val('#kCfTok'),
        hfToken: val('#kHf'),
        openaiBase: val('#kBase'), openaiKey: val('#kOai'), openaiModel: val('#kOaiModel'),
        translate: $('#cTranslate')?.checked, timeout: numv('#cTimeout'),
        coinValue: numv('#cCoinValue'), aiCreditCost: numv('#cCreditCost'),
        aiCoinCost: numv('#cCoinCost'), signupCoins: numv('#cSignupCoins'),
        signupCredits: numv('#cSignupCredits'),
        aiRateMax: numv('#cRateMax'), aiRateWindow: numv('#cRateWindow'),
        maxPerRequest: numv('#cPerRequest'),
      });
      toast(T('setSaved'), 'success');
      setTimeout(() => location.reload(), 700);
    } catch (err) { toast(err.message, 'error'); b.disabled = false; }
  });

  $$('.js-clear').forEach(b => b.addEventListener('click', async () => {
    await post('/api/admin/config', { __clear: b.dataset.key });
    toast(T('setSaved'), 'success');
    setTimeout(() => location.reload(), 500);
  }));

  $('#cReset')?.addEventListener('click', async () => {
    await post('/api/admin/config/reset');
    toast(T('setResetOk'), 'success');
    setTimeout(() => location.reload(), 600);
  });

  /* ------------------------------------------------------ test the provider */
  $('#cTest')?.addEventListener('click', async (e) => {
    const b = e.currentTarget, out = $('#cResult');
    b.disabled = true;
    const label = b.innerHTML;
    b.textContent = T('setTesting');
    out.innerHTML = '';
    try {
      const j = await post('/api/admin/ai/test');
      const i = j.image, tr = j.translate;
      out.innerHTML = [
        `<span class="pill ${i.ok ? 'live' : 'warn'}">${i.ok ? T('setTestOk') : T('setTestFail')} — ${i.provider}</span>`,
        `<span class="pill">${N(i.ms)} ms</span>`,
        i.ok ? `<span class="pill">${N(Math.round(i.bytes / 1024))} KB${i.size ? ` · ${i.size.w}×${i.size.h} ${i.format}` : ''}</span>`
             : `<span class="pill warn ltr">${i.reason}</span>`,
        i.ok ? `<span class="pill ${i.honoursSize ? 'live' : 'warn'}">${i.honoursSize ? T('setSizeOk') : T('setSizeIgnored')}</span>` : '',
        `<span class="pill">fa→en: <b class="ltr">${tr.via}</b></span>`,
        ...(tr.skipped || []).map(s => `<span class="pill warn ltr">${s}</span>`),
        `<span class="pill ltr">${tr.text}</span>`,
      ].join('');
    } catch (err) { out.innerHTML = `<span class="pill warn">${err.message}</span>`; }
    b.innerHTML = label; b.disabled = false;
  });

  /* ------------------------------------------------------- user edit modal */
  const modal = $('#uModal');
  let editing = null;
  const openModal = (d) => {
    editing = d.uid;
    $('#uWho').textContent = d.un;
    $('#eUn').value = d.un; $('#eEm').value = d.em; $('#eNm').value = d.nm;
    $('#ePw').value = '';
    $('#eCoins').value = d.coins; $('#eCredits').value = d.credits;
    $('#eRole').value = d.role;
    $('#eBanned').checked = d.banned === '1';
    modal.classList.remove('hide');
  };
  const closeModal = () => { modal?.classList.add('hide'); editing = null; };

  $$('.js-edit').forEach(b => b.addEventListener('click', () => openModal(b.dataset)));
  $('#uClose')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  $('#eSave')?.addEventListener('click', async (e) => {
    if (!editing) return;
    const b = e.currentTarget; b.disabled = true;
    try {
      await post(`/api/admin/user/${editing}/edit`, {
        username: val('#eUn'), email: val('#eEm'), name: val('#eNm'),
        password: val('#ePw') || undefined,
        coins: numv('#eCoins'), credits: numv('#eCredits'),
        role: val('#eRole'), banned: $('#eBanned').checked,
      });
      toast(T('admDone'), 'success');
      setTimeout(() => location.reload(), 600);
    } catch (err) { toast(err.message, 'error'); b.disabled = false; }
  });

  $('#eDelete')?.addEventListener('click', async () => {
    if (!editing || !confirm(T('admConfirmDelete'))) return;
    try {
      await post(`/api/admin/user/${editing}/delete`);
      toast(T('admDeleted'), 'success');
      setTimeout(() => location.reload(), 600);
    } catch (err) { toast(err.message, 'error'); }
  });

  /* ------------------------------------------------------- bulk selection */
  const sel = () => $$('.uSel:checked').map(c => +c.value);
  const count = $('#gCount');
  const refresh = () => { if (count) count.textContent = N(sel().length); };
  $$('.uSel').forEach(c => c.addEventListener('change', refresh));
  $('#uAll')?.addEventListener('change', (e) => {
    $$('.uSel').forEach(c => { c.checked = e.target.checked; });
    refresh();
  });
  refresh();

  // when "apply to selected" is ticked, the grant buttons act on every checked row
  const bulk = $('#gBulk');
  if (bulk) {
    document.addEventListener('click', async (e) => {
      const b = e.target.closest('.grantbox [data-act]');
      if (!b || !bulk.checked) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const ids = sel();
      if (!ids.length) return toast(T('admSelected'), 'warn');
      const act = b.dataset.act;
      const body = { ids };
      if (act === 'coins') body.coins = numv('#gCoins');
      else if (act === 'credits') body.credits = numv('#gCred');
      else if (act === 'plan') { body.plan = val('#gPlan'); body.days = numv('#gDays'); }
      else return toast(T('admBulk'), 'warn');
      try {
        const j = await post('/api/admin/users/bulk', body);
        toast(`${T('admBulkDone')} (${N(j.updated)})`, 'success');
        setTimeout(() => location.reload(), 800);
      } catch (err) { toast(err.message, 'error'); }
    }, true);
  }
})();
