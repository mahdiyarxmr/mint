/* Mint — global behaviour (modular, no dependencies) */
(() => {
  'use strict';
  const T = (k) => (window.MINT && window.MINT.t && window.MINT.t[k]) || k;
  const N = (n) => Number(n).toLocaleString((window.MINT && window.MINT.lang) === 'fa' ? 'fa-IR' : 'en-US');

  /* ---------------------------------------------------------------- toasts */
  const host = document.getElementById('toasts');
  const toast = (msg, kind = 'ok') => {
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast';
    const col = kind === 'err' ? 'var(--danger)' : 'var(--ok)';
    el.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:${col};flex:none"></span><span>${msg}</span>`;
    host.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, 2600);
  };
  window.mintToast = toast;

  document.addEventListener('click', e => {
    const t = e.target.closest('.js-toast');
    if (t) { e.preventDefault(); toast(t.dataset.msg || T('done2')); }
  });

  /* ------------------------------------------------------------ mobile nav */
  const drawer = document.getElementById('drawer');
  const open = v => { if (!drawer) return; drawer.classList.toggle('hide', !v); document.body.style.overflow = v ? 'hidden' : ''; };
  document.getElementById('burger')?.addEventListener('click', () => open(true));
  document.getElementById('dclose')?.addEventListener('click', () => open(false));
  drawer?.addEventListener('click', e => { if (e.target === drawer) open(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') open(false); });

  /* ------------------------------------------------------ likes (optimistic) */
  document.addEventListener('click', e => {
    const b = e.target.closest('.js-like');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const on = b.dataset.on === '1';
    b.dataset.on = on ? '0' : '1';
    const span = b.querySelector('span');
    if (span) span.textContent = Number(b.dataset.n) + (on ? 0 : 1);
    b.style.color = on ? '' : '#F472B6';
    if (!on) toast(T('liked'));
  });

  /* ------------------------------------------------- checkout paid in coins */
  document.addEventListener('click', async e => {
    const b = e.target.closest('.js-buy');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (b.disabled) return;
    b.disabled = true;
    try {
      const r = await fetch('/api/coins/buy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: b.dataset.id }),
      });
      if (r.status === 401) { location.href = '/login?next=' + encodeURIComponent(location.pathname); return; }
      const j = await r.json().catch(() => ({}));
      if (r.status === 402) {
        toast(`${T('coinShort')} — ${T('coinNeed') || ''} ${N(j.need)} ${T('coinName')}`, 'err');
        return;
      }
      if (!r.ok) { toast(T('failed'), 'err'); return; }
      const pill = document.querySelector('.coinpill b');
      if (pill) pill.textContent = N(j.coins_left);
      toast(`${T('coinBought')} «${b.dataset.title}» — ${N(j.spent)} ${T('coinName')}`);
    } catch { toast(T('netError'), 'err'); }
    finally { b.disabled = false; }
  });

  /* ------------------------------------------------- live search (api/search) */
  const input = document.getElementById('gsearch');
  const box = document.getElementById('gresults');
  if (input && box) {
    let timer, ctrl;
    const close = () => box.classList.add('hide');
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) return close();
      timer = setTimeout(async () => {
        ctrl?.abort(); ctrl = new AbortController();
        try {
          const r = await fetch('/api/search?q=' + encodeURIComponent(q), { signal: ctrl.signal });
          const { results } = await r.json();
          if (!results.length) {
            box.innerHTML = `<div style="padding:14px;font-size:13px;color:var(--muted-2)">${T("noMatch")} «${q}»</div>`;
          } else {
            box.innerHTML = results.map(x => `
              <a href="${x.href}">
                <img src="${x.img}" alt="">
                <span style="flex:1;min-width:0">
                  <b style="display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${x.title}</b>
                  <small style="color:var(--muted-2);font-size:11px">${x.type==='template'?T('template'):T('product')} · ${x.sub}</small>
                </span>
              </a>`).join('');
          }
          box.classList.remove('hide');
        } catch (_) { /* aborted */ }
      }, 180);
    });
    document.addEventListener('click', e => { if (!e.target.closest('.searchwrap')) close(); });
    input.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  /* -------------------------------------------------- reveal on scroll (rv) */
  const rv = document.querySelectorAll('.rv');
  if (rv.length && 'IntersectionObserver' in window &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en, i) => {
        if (!en.isIntersecting) return;
        setTimeout(() => en.target.classList.add('in'), Math.min(i * 45, 260));
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    rv.forEach(el => io.observe(el));
    // safety net: never leave content invisible if the observer never fires
    setTimeout(() => rv.forEach(el => el.classList.add('in')), 2500);
  } else {
    rv.forEach(el => el.classList.add('in'));
  }
})();

/* ---- dismissible site announcements (remembered per browser) ---- */
(() => {
  const KEY = 'mint.ann.dismissed';
  let gone = [];
  try { gone = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch {}
  document.querySelectorAll('.ann[data-ann]').forEach(el => {
    if (gone.includes(el.dataset.ann)) { el.remove(); return; }
    const x = el.querySelector('.js-ann-x');
    if (x) x.addEventListener('click', () => {
      gone.push(el.dataset.ann);
      try { localStorage.setItem(KEY, JSON.stringify(gone.slice(-40))); } catch {}
      el.style.height = el.offsetHeight + 'px';
      requestAnimationFrame(() => {
        el.style.cssText += ';height:0;opacity:0;padding-top:0;padding-bottom:0;margin:0;border-width:0;overflow:hidden;transition:all .22s ease';
        setTimeout(() => el.remove(), 240);
      });
    });
  });
})();
