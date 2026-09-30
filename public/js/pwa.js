/* Progressive-web-app glue: register the worker, offer an install button when
   the browser says the app is installable, and show a banner when connectivity
   drops. Everything degrades silently on browsers without support. */
(function () {
  'use strict';

  var T = window.T || function (k) { return k; };

  /* ---------------------------------------------------------- service worker */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').then(function (reg) {
        // a new worker means new markup or CSS; take it on the next navigation
        reg.addEventListener('updatefound', function () {
          var sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', function () {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              sw.postMessage('skipWaiting');
            }
          });
        });
      }).catch(function () { /* private mode, http, or unsupported — ignore */ });
    });
  }

  /* --------------------------------------------------------- install prompt */
  var deferred = null;
  var btn = null;

  function makeButton() {
    if (btn) return btn;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost btn-sm pwa-install';
    btn.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/>' +
      '<path d="M12 15V3"/></svg><span>' + T('pwa.install') + '</span>';
    btn.addEventListener('click', function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function () {
        deferred = null;
        btn.remove();
        btn = null;
      });
    });
    return btn;
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    var slot = document.querySelector('.nav-in .desk') || document.querySelector('.nav-in');
    if (!slot) return;
    var b = makeButton();
    if (!b.parentNode) slot.insertBefore(b, slot.firstChild);
  });

  window.addEventListener('appinstalled', function () {
    deferred = null;
    if (btn) { btn.remove(); btn = null; }
  });

  /* --------------------------------------------------------- offline banner */
  var bar = null;
  function setOffline(off) {
    if (off && !bar) {
      bar = document.createElement('div');
      bar.className = 'offline-bar';
      bar.setAttribute('role', 'status');
      bar.textContent = T('pwa.offline');
      document.body.appendChild(bar);
      requestAnimationFrame(function () { bar.classList.add('in'); });
    } else if (!off && bar) {
      bar.classList.remove('in');
      var gone = bar;
      bar = null;
      setTimeout(function () { gone.remove(); }, 300);
    }
  }
  window.addEventListener('online', function () { setOffline(false); });
  window.addEventListener('offline', function () { setOffline(true); });
  if (navigator.onLine === false) setOffline(true);
}());
