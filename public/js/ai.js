/* Mint AI Studio — prompt → generate → results
   ai/ai-credits.md: credit meter updates from the server response
   Handles loading, empty, validation and rate-limit states. */
(() => {
  'use strict';
  const T = (k) => (window.MINT && window.MINT.t && window.MINT.t[k]) || k;
  const N = (n) => Number(n).toLocaleString((window.MINT && window.MINT.lang) === 'fa' ? 'fa-IR' : 'en-US');
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  const form = $('#aiForm'), promptEl = $('#aiPrompt'), go = $('#aiGo');
  const section = $('#resultsSection'), grid = $('#resultsGrid'), counter = $('#creditCount');
  let style = new URLSearchParams(location.search).get('style') || '';

  /* target device — drives both the generated pixel size and the preview shape */
  const devBox = $('#aiDevice');
  let device = devBox?.querySelector('button.on')?.dataset.dev || 'phone';
  let devRatio = (() => { const b = devBox?.querySelector('button.on'); return b ? +b.dataset.w / +b.dataset.h : 300 / 620; })();
  devBox?.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-dev]'); if (!b) return;
    [...devBox.querySelectorAll('button')].forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    device = b.dataset.dev;
    devRatio = +b.dataset.w / +b.dataset.h;
  });

  $$('#styleChips .chip').forEach(c => c.addEventListener('click', () => {
    const was = c.classList.contains('on');
    $$('#styleChips .chip').forEach(x => x.classList.remove('on'));
    if (!was) { c.classList.add('on'); style = c.dataset.style; } else { style = ''; }
  }));

  const skeletons = n => {
    section.classList.remove('hide');
    grid.innerHTML = Array.from({ length: n }, () =>
      `<div class="card" style="overflow:hidden"><div class="skel" style="aspect-ratio:${devRatio};border-radius:0"></div>
       <div style="padding:12px"><div class="skel" style="height:11px;width:65%;margin-bottom:7px"></div>
       <div class="skel" style="height:9px;width:38%"></div></div></div>`).join('');
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  async function generate() {
    const prompt = promptEl.value.trim();
    if (!prompt) {
      promptEl.focus();
      promptEl.closest('.prompt').style.borderColor = 'var(--danger)';
      setTimeout(() => promptEl.closest('.prompt').style.borderColor = '', 1400);
      return window.mintToast?.(T('needPrompt'), 'err');
    }

    go.disabled = true;
    skeletons(2);

    try {
      const r = await fetch('/api/ai/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style, device, count: 2 }),
      });

      if (r.status === 429) { grid.innerHTML = ''; section.classList.add('hide'); return window.mintToast?.(T('rateLimited'), 'err'); }
      if (r.status === 401) { location.href = '/login?next=/ai-studio'; return; }
      if (r.status === 402) {
        const e = await r.json().catch(() => ({}));
        grid.innerHTML = ''; section.classList.add('hide');
        return window.mintToast?.(`${T('noCredits')} — ${T('coinShort')}`, 'err');
      }
      if (!r.ok) { const e = await r.json(); grid.innerHTML = ''; section.classList.add('hide'); return window.mintToast?.(T('failed'), 'err'); }

      const d = await r.json();
      counter.textContent = N(d.credits_left);
      const coinPill = document.querySelector('.coinpill b');
      if (coinPill) coinPill.textContent = N(d.coins_left);

      grid.innerHTML = d.results.map(x => `
        <article class="tcard in">
          <div class="thumb genframe" style="aspect-ratio:${devRatio}">
            <img src="${x.img}" alt="${x.prompt}" loading="lazy">
            <div class="hover">
              <a href="/editor?device=${encodeURIComponent(x.device)}&art=${encodeURIComponent(x.img)}" class="btn btn-primary btn-sm">${T('toEditor')}</a>
              <a href="${x.img}" download class="btn btn-ghost btn-sm js-toast" data-msg="${T('dlStarted')}">↓</a>
            </div>
          </div>
          <div class="meta"><div style="min-width:0">
            <h4 style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12.5px">${x.prompt}</h4>
            <small>${T('justNow')}${x.style ? ' · ' + x.style : ''}</small>
          </div></div>
        </article>`).join('');

      const meta = $('#genMeta');
      if (meta) {
        const bits = [
          `<span class="pill ${d.live ? 'live' : 'warn'}">${d.live ? T('aiLive') : T('aiOffline')}</span>`,
          `<span class="pill">${T('aiProvider')}: <b class="ltr">${d.provider}</b></span>`,
        ];
        if (d.translated) bits.push(`<span class="pill">${T('aiTranslated')}</span>`);
        if (d.coins_spent) bits.push(`<span class="pill">${N(d.coins_spent)} ${T('coinSpent')}</span>`);
        if (d.prompt_en) bits.push(`<span class="pill ltr" style="max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.prompt_en}</span>`);
        meta.innerHTML = bits.join('');
      }

      window.mintToast?.(d.paid_with === 'coins'
        ? `${T('coinFallback')} · ${N(d.coins_spent)} ${T('coinName')}`
        : `${T('done')} ${N(d.credits_spent)}`);
    } catch {
      grid.innerHTML = '';
      section.classList.add('hide');
      window.mintToast?.(T('netError'), 'err');
    } finally {
      go.disabled = false;
    }
  }

  form.addEventListener('submit', e => { e.preventDefault(); generate(); });
  $('#regen')?.addEventListener('click', generate);
  promptEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); generate(); }
  });
})();
