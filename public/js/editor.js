/* Mint Editor — canvas state, tools, autosave
   editor/canvas.md: document coords kept separate from viewport zoom
   editor/autosave.md: debounced save with visible status */
(() => {
  'use strict';
  const T = (k) => (window.MINT && window.MINT.t && window.MINT.t[k]) || k;
  const N = (n) => Number(n).toLocaleString((window.MINT && window.MINT.lang) === 'fa' ? 'fa-IR' : 'en-US');

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  // an AI result can arrive via ?art=… &device=… (AI Studio → "send to editor")
  const Q = new URLSearchParams(location.search);
  const incomingArt = (() => {
    const a = Q.get('art') || '';
    return /^\/img\/[\w./-]+$/.test(a) ? a : null;   // same-origin paths only
  })();

  const state = { img: incomingArt, color: '#6D4AFF', stickers: [], text: '', zoom: 1, view: 'Front', panel: 'base',
                  device: (document.querySelector('.devsvg.on') || {}).dataset?.device || 'phone' };
  const history = []; let hIndex = -1;

  const stage  = $('#stage');
  const svgs   = $$('.devsvg');
  const svgFor = id => svgs.find(v => v.dataset.device === id) || svgs[0];
  const active = () => svgFor(state.device);
  // sticker anchor points differ per device; read them off the markup once
  const SLOTS = {
    phone:[[50,30],[30,52],[70,62],[42,70],[60,40]],
    laptop:[[50,36],[28,45],[72,45],[38,68],[64,70]],
    pc:[[50,30],[30,46],[70,50],[42,62],[60,38]],
    xbox:[[50,26],[20,75],[80,75],[36,30],[64,30]],
    playstation:[[50,52],[20,75],[80,75],[33,28],[67,28]],
    keyboard:[[50,50],[22,32],[78,32],[35,70],[65,70]],
    keycaps:[[50,50],[20,25],[80,25],[20,75],[80,75]],
    wallpaper:[[50,35],[24,50],[76,50],[38,72],[62,72]],
  };

  /* ------------------------------------------------------------- history */
  const snapshot = () => {
    history.splice(hIndex + 1);
    history.push(JSON.stringify(state));
    hIndex = history.length - 1;
  };
  const restore = i => {
    if (i < 0 || i >= history.length) return;
    hIndex = i;
    Object.assign(state, JSON.parse(history[i]));
    render(); save();
  };
  snapshot();

  /* -------------------------------------------------------------- render */
  function render() {
    const col  = $('#edTextColor').value;
    const size = +$('#edTextSize').value;

    svgs.forEach(svg => {
      const id = svg.dataset.device;
      const vb = svg.viewBox.baseVal;
      svg.classList.toggle('on', id === state.device);

      if (state.img) svg.querySelector('.art').setAttribute('href', state.img);

      // stickers, placed on that device's own anchor points
      const slots = SLOTS[id] || SLOTS.phone;
      svg.querySelector('.stickers').innerHTML = state.stickers.map((st, i) => {
        const [px, py] = slots[i % slots.length];
        return `<text x="${vb.width * px / 100}" y="${vb.height * py / 100}"
                  transform="rotate(${st.r} ${vb.width * px / 100} ${vb.height * py / 100})"
                  data-i="${i}">${st.c}</text>`;
      }).join('');

      // caption — scaled from the phone's 300px-wide reference so it reads the same everywhere
      const tx = svg.querySelector('.usertext');
      if (tx) {
        tx.textContent = state.text;
        tx.setAttribute('fill', col);
        tx.setAttribute('font-size', Math.round(size * (Math.min(vb.width, vb.height) / 300)));
      }
    });

    stage.style.transform = `scale(${state.zoom})`;
    $('#zoomLabel').textContent = Math.round(state.zoom * 100) + '%';
    const nm = document.querySelector(`.dchip[data-device="${state.device}"] span`);
    if (nm && $('#devName')) $('#devName').textContent = nm.textContent;
    applyFx();
  }

  function applyFx() {
    const glow = $('#fxGlow').checked, grain = $('#fxGrain').checked, vig = $('#fxVignette').checked;
    svgs.forEach(svg => {
      svg.style.filter = glow
        ? `drop-shadow(0 30px 60px rgba(0,0,0,.85)) drop-shadow(0 0 26px ${state.color}aa)`
        : 'drop-shadow(0 30px 60px rgba(0,0,0,.85))';
      svg.querySelector('.edge').setAttribute('stroke', glow ? state.color : 'rgba(139,107,255,.42)');
      svg.querySelector('.art').style.filter = grain ? 'contrast(1.12) saturate(1.15)' : '';
      svg.querySelector('.vig').setAttribute('opacity', vig ? 1 : 0);
      svg.querySelector('.tint').setAttribute('opacity', 0.15);
      svg.querySelector('.tint').setAttribute('fill', state.color);
    });
  }

  /* ------------------------------------------------------------- autosave */
  let saveTimer;
  const status = $('#savedAt');
  function save() {
    clearTimeout(saveTimer);
    status.textContent = T('saving');
    saveTimer = setTimeout(async () => {
      try {
        const r = await fetch('/api/projects/save', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state),
        });
        const d = await r.json();
        status.textContent = `${T('savedV')} ${N(d.version)}`;
      } catch { status.textContent = T('offline'); }
    }, 700);
  }

  /* ------------------------------------------------------------ bindings */
  $$('.ed-tab').forEach(t => t.addEventListener('click', () => {
    $$('.ed-tab').forEach(x => x.classList.remove('on'));
    t.classList.add('on');
    state.panel = t.dataset.panel;
    $('#panelTitle').textContent = t.dataset.label || t.textContent.trim();
    if (state.panel === 'ai') window.mintToast?.(T('aiHint'));
  }));

  $$('.js-tool').forEach(b => b.addEventListener('click', () => {
    $$('.js-tool').forEach(x => { x.classList.remove('on'); x.style.background = ''; x.style.color = ''; });
    b.classList.add('on'); b.style.background = 'rgba(109,74,255,.28)'; b.style.color = '#fff';
  }));

  $$('.js-variant, .js-ptn').forEach(b => b.addEventListener('click', () => {
    const group = b.classList.contains('js-variant') ? '.js-variant' : '.js-ptn';
    $$(group).forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    state.img = b.dataset.img;
    snapshot(); render(); save();
  }));

  $$('.js-sw').forEach(b => b.addEventListener('click', () => {
    $$('.js-sw').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    state.color = b.dataset.c;
    snapshot(); render(); save();
  }));

  $$('.js-stk').forEach(b => b.addEventListener('click', () => {
    state.stickers.push({
      c: b.dataset.s,
      x: 22 + Math.random() * 56,
      y: 22 + Math.random() * 46,
      r: Math.round(Math.random() * 40 - 20),
    });
    snapshot(); render(); save();
    window.mintToast?.(T('stickerAdded'));
  }));

  stage.addEventListener('click', e => {
    const hit = e.target.closest('.stickers text');
    if (!hit) return;
    const i = +hit.dataset.i;
    if (i > -1) { state.stickers.splice(i, 1); snapshot(); render(); save(); }
  });

  $('#edText').addEventListener('input', e => { state.text = e.target.value; render(); save(); });
  $('#edText').addEventListener('change', snapshot);
  $('#edTextColor').addEventListener('input', render);
  $('#edTextSize').addEventListener('change', render);
  ['fxGlow', 'fxGrain', 'fxVignette'].forEach(id => $('#' + id).addEventListener('change', () => { applyFx(); save(); }));

  $$('.js-view').forEach(b => b.addEventListener('click', () => {
    $$('.js-view').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); state.view = b.dataset.view;
    stage.animate(
      [{ transform: `scale(${state.zoom}) rotateY(0)` }, { transform: `scale(${state.zoom}) rotateY(180deg)` }, { transform: `scale(${state.zoom}) rotateY(0)` }],
      { duration: 520, easing: 'cubic-bezier(.4,0,.2,1)' }
    );
  }));

  const zoom = d => { state.zoom = Math.min(1.7, Math.max(.45, state.zoom + d)); render(); };
  $('#zoomIn').addEventListener('click', () => zoom(.12));
  $('#zoomOut').addEventListener('click', () => zoom(-.12));
  $('#zoomLabel').addEventListener('click', () => { state.zoom = 1; render(); });

  $('#undo').addEventListener('click', () => restore(hIndex - 1));
  $('#redo').addEventListener('click', () => restore(hIndex + 1));

  $('#btnSave').addEventListener('click', async () => {
    save();
    const r = await fetch('/api/xp/event', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xp: 10, reason: 'project_saved' }),
    });
    const d = await r.json();
    window.mintToast?.(`${T('savedXp')} · ${d.level_name}`);
  });

  $('#btnDownload').addEventListener('click', () => {
    window.mintToast?.(T('exportQueued'));
  });

  /* --------------------------------- keyboard shortcuts (editor/tools.md) */
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,textarea,select')) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? restore(hIndex + 1) : restore(hIndex - 1); }
    if (e.key === '+' || e.key === '=') zoom(.12);
    if (e.key === '-') zoom(-.12);
    if (e.key === '0') { state.zoom = 1; render(); }
  });

  /* ------------------------- mobile drawers (design/responsive.md) */
  const mq = matchMedia('(max-width:1020px)');
  const sync = () => {
    $('.ed-mobilebar')?.classList.toggle('hide', !mq.matches);
    $$('.js-drawer-close').forEach(b => b.classList.toggle('hide', !mq.matches));
    if (!mq.matches) { $('#edLeft').classList.remove('open'); $('#edRight').classList.remove('open'); }
  };
  mq.addEventListener('change', sync); sync();
  $('.js-open-left')?.addEventListener('click', () => $('#edLeft').classList.add('open'));
  $('.js-open-right')?.addEventListener('click', () => $('#edRight').classList.add('open'));
  $$('.js-drawer-close').forEach(b => b.addEventListener('click', () => {
    $('#edLeft').classList.remove('open'); $('#edRight').classList.remove('open');
  }));

  /* ------------------------------------------------- device switcher
     Every surface is rendered up front and kept in sync, so changing the
     device preserves the artwork, tint, caption and stickers. */
  $$('.dchip').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.device === state.device) return;
    $$('.dchip').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    state.device = b.dataset.device;
    const url = new URL(location.href);
    url.searchParams.set('device', state.device);
    window.history.replaceState(null, '', url);
    render(); snapshot(); save();
    window.mintToast?.(T('deviceSet') + ' ' + b.querySelector('span').textContent);
  }));

  /* preload template from ?t= */
  const t = new URLSearchParams(location.search).get('t');
  if (t) {
    const btn = $$('.js-ptn').find(b => b.dataset.img.includes(t));
    if (btn) btn.click();
  }

  render();
})();
