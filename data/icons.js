// Inline SVG icon set — no external icon font (agent/coding-rules.md: minimal dependencies)
const P = {
  settings:'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4M19.4 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1h-.2a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5v-.2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
  edit:'M11 4H5a1.8 1.8 0 0 0-1.8 1.8v13A1.8 1.8 0 0 0 5 20.6h13a1.8 1.8 0 0 0 1.8-1.8v-6M18.4 2.6a1.9 1.9 0 0 1 2.7 2.7L12.5 14 9 15l1-3.5z',
  bolt:'M13.2 2.6 4.4 13.2a.7.7 0 0 0 .5 1.2h5.3l-1.4 7 8.8-10.6a.7.7 0 0 0-.5-1.2h-5.3z',
  trash:'M4 7h16M9.5 7V5.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7M6.5 7l.9 12.1a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9L17.5 7M10 11v6M14 11v6',
  alert:'M12 3.2a8.8 8.8 0 1 0 0 17.6 8.8 8.8 0 0 0 0-17.6M12 7.8v5.2M12 16.4v.01',
  coin:'M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2M14.6 9.3a3.3 3.3 0 1 0 0 5.4',
  megaphone:'M3 10.5v3a1 1 0 0 0 1 1h2l5 3.5v-13L6 9.5H4a1 1 0 0 0-1 1zM15 9.4a4 4 0 0 1 0 5.2M18 6.7a8 8 0 0 1 0 10.6',
  gift:'M3.5 9.5h17v10a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1zM3 9.5h18M12 9.5v11M12 9.5c-.6-1.8-1.9-4.5-3.6-4.5a2 2 0 0 0 0 4.5zM12 9.5c.6-1.8 1.9-4.5 3.6-4.5a2 2 0 0 1 0 4.5z',
  home:'M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  layers:'M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  store:'M3 9h18l-1.5 11a1 1 0 0 1-1 .9H5.5a1 1 0 0 1-1-.9zM8 9V6a4 4 0 0 1 8 0v3',
  bot:'M12 2v3M5 8h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM9 13h.01M15 13h.01',
  search:'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3',
  bell:'M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0',
  user:'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z',
  cart:'M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6',
  gear:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.6 7a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H7a1.7 1.7 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V7a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  download:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  spark:'M12 2l2.2 6.4L21 10l-5.5 4.1L17 21l-5-3.8L7 21l1.5-6.9L3 10l6.8-1.6z',
  trophy:'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3',
  flame:'M12 22c4 0 7-2.7 7-6.5 0-4.5-4-6-4-9.5 0 0-3 1.5-3 5 0 1.5-1 2-1.5 1.2C10 11 9.5 9 9.5 9S5 11.5 5 15.5C5 19.3 8 22 12 22z',
  tag:'M20.6 13.4 12 22l-9-9V3h10zM7.5 7.5h.01',
  palette:'M12 21a9 9 0 1 1 0-18c4.9 0 9 3.6 9 8 0 2.5-2 4-4.5 4H15a2 2 0 0 0-1.4 3.4A1.9 1.9 0 0 1 12 21zM7.5 11h.01M10.5 7h.01M14.5 7h.01',
  image:'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  type:'M4 7V4h16v3M9 20h6M12 4v16',
  square:'M4 4h16v16H4z',
  pattern:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  sticker:'M15.5 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h6l9-9V6a3 3 0 0 0-3-3zM13 21v-5a3 3 0 0 1 3-3h5',
  copy:'M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1',
  check:'M20 6 9 17l-5-5',
  x:'M18 6 6 18M6 6l12 12',
  arrow:'M5 12h14M13 6l6 6-6 6',
  chev:'M9 18l6-6-6-6',
  plus:'M12 5v14M5 12h14',
  undo:'M3 7v6h6M3.5 13a9 9 0 1 0 2.1-5.7L3 10',
  redo:'M21 7v6h-6M20.5 13a9 9 0 1 1-2.1-5.7L21 10',
  zoom:'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3M8 11h6M11 8v6',
  move:'M5 9 2 12l3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20',
  key:'M15 2a7 7 0 0 0-6.6 9.3L2 17.7V22h4.3l1.4-1.4V19h1.6l1.4-1.4v-1.7h1.7l.9-.9A7 7 0 1 0 15 2zm2.5 5h.01',
  keyboard:'M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8',
  phone:'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 19h2',
  laptop:'M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v11H4zM2 19h20l-1.5 2h-17z',
  gamepad:'M7 12h4M9 10v4M15.5 13h.01M18 11h.01M7.5 19h9a5.5 5.5 0 0 0 5.5-5.5v-1A5.5 5.5 0 0 0 16.5 7h-9A5.5 5.5 0 0 0 2 12.5v1A5.5 5.5 0 0 0 7.5 19z',
  mouse:'M12 2a6 6 0 0 1 6 6v8a6 6 0 0 1-12 0V8a6 6 0 0 1 6-6zM12 7v4',
  headset:'M4 15v-3a8 8 0 1 1 16 0v3M4 15a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2zM20 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM20 17v1a3 3 0 0 1-3 3h-4',
  video:'M23 7l-7 5 7 5zM1 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z',
  folder:'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  chart:'M3 3v18h18M7 15l3-4 3 3 5-7',
  shield:'M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z',
  clock:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  file:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  menu:'M3 6h18M3 12h18M3 18h18',
  logout:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  eye:'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  mail:'M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 7l10 7 10-7',
  lock:'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4',
  star:'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L7 14.2l-5-4.9 6.9-1z',
  msg:'M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z',
  share:'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v14',
  crop:'M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2',
  line:'M4 20 20 4',
  circle:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  users:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  info:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-4M12 8h.01',
  keycap: 'M7 8h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z M9 8V6a3 3 0 0 1 6 0v2 M8.5 12h7',
  tower:'M6 2h12a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM9 6h6M9 9h6M9 17h.01M12 17h.01',
  xbox:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.5 5.2c2.2 1 4.3 2.7 6.5 5.1 2.2-2.4 4.3-4.1 6.5-5.1M5 18.4c1.3-3 3.6-5.9 7-8.1 3.4 2.2 5.7 5.1 7 8.1',
  ps:'M8 3.2v14.3l3.2 1V7.6c0-.7.5-1 1-.7 1.6.6 2.6 2 2.6 3.7 0 1.6-.8 2.5-2.1 2.5M3 17.3c0 1 1.4 1.7 3.4 2 1.6.3 3.3.3 4.6 0M21 15.6c0-1-1.5-1.6-3.6-1.7-1.5 0-3 .2-4.2.6v1.7c1-.4 2.3-.6 3.5-.5 1 0 1.6.3 1.6.6 0 .4-.7.7-1.9 1',
  globe:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.2 2.4 3.4 5.6 3.4 9S14.2 18.6 12 21c-2.2-2.4-3.4-5.6-3.4-9S9.8 5.4 12 3z',
};
// Always emit explicit width/height so an icon can never blow out its container.
// CSS may still override via a more specific selector (e.g. `.empty .ic svg`).
const icon = (name, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${
    (P[name] || P.circle).split('M').filter(Boolean).map(d => `<path d="M${d}"/>`).join('')
  }</svg>`;
module.exports = { icon, PATHS: P };

/* ---------------------------------------------------------- brand identity
   The Mint mark: a squircle badge holding an "M" drawn as one continuous
   rounded stroke — two peaks, like a pen nib or a folded cover — with a
   spark above the right stem for the generative side of the product. */
function brandMark(size = 34) {
  // The emblem the brand actually ships. PNG rather than inline SVG because the
  // source art is a raster illustration; two densities cover retina.
  return `<img class="mark" src="/img/brand/mark-96.png"
     srcset="/img/brand/mark-96.png 1x, /img/brand/mark-192.png 2x"
     width="${size}" height="${size}" alt="" aria-hidden="true"
     decoding="async" fetchpriority="high">`;
}

/* The word "Mint" as drawn art. alt carries the name so the logo still reads as
   text to a screen reader, and the brand stays Latin in both locales. */
function brandWord(height = 22) {
  const w = Math.round(height * 2.793);
  return `<img class="wordmark" src="/img/brand/wordmark.png"
     srcset="/img/brand/wordmark.png 1x, /img/brand/wordmark-2x.png 2x"
     width="${w}" height="${height}" alt="Mint" decoding="async">`;
}


/* Full lockup: mark + wordmark, for the footer / auth / share images. */
function brandLockup(size = 30) {
  return `<span class="lockup" style="display:inline-flex;align-items:center;gap:9px">
    ${brandMark(size)}<span style="font-weight:800;font-size:${Math.round(size * 0.56)}px;letter-spacing:-.02em">Mint</span>
  </span>`;
}

module.exports.brandMark = brandMark;
module.exports.brandWord = brandWord;
module.exports.brandLockup = brandLockup;
