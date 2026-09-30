/* Mint — designable device surfaces.
   Each device is a real silhouette: the artwork is clipped to `path`, and
   `overlay` draws the hardware details (lens, sticks, keys) on top of it.
   Everything is plain SVG in the document's own coordinate space, so the
   editor's zoom never rasterises the outline. */

const rr = (x, y, w, h, r) =>
  `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} ` +
  `V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} ` +
  `H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} ` +
  `V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;

/* a gamepad body: rounded top, two grips falling away from a centre notch */
const PAD = `M200 44 C168 44 140 47 120 55 C96 65 74 88 58 124
  C40 164 28 210 30 240 C32 268 52 282 76 276 C100 270 120 248 138 218
  C152 194 166 184 200 184 C234 184 248 194 262 218 C280 248 300 270 324 276
  C348 282 368 268 370 240 C372 210 360 164 342 124 C326 88 304 65 280 55
  C260 47 232 44 200 44 Z`.replace(/\s+/g, ' ');

const ring = (cx, cy, r) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(4,7,26,.82)" stroke="rgba(255,255,255,.28)" stroke-width="2"/>` +
  `<circle cx="${cx}" cy="${cy}" r="${r - 8}" fill="rgba(255,255,255,.1)" stroke="rgba(255,255,255,.22)" stroke-width="1.5"/>`;

const dpad = (cx, cy, a = 10, b = 48) =>
  `<path d="M${cx - a} ${cy - b / 2} h${a * 2} v${b / 2 - a} h${b / 2 - a} v${a * 2} h${-(b / 2 - a)} v${b / 2 - a}
     h${-a * 2} v${-(b / 2 - a)} h${-(b / 2 - a)} v${-a * 2} h${b / 2 - a} Z"
     fill="rgba(4,7,26,.82)" stroke="rgba(255,255,255,.26)" stroke-width="2" stroke-linejoin="round"/>`
    .replace(/\s+/g, ' ');

const btn = (cx, cy, r = 12, label = '') =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(4,7,26,.8)" stroke="rgba(255,255,255,.3)" stroke-width="1.8"/>` +
  (label ? `<text x="${cx}" y="${cy + 4.5}" text-anchor="middle" font-size="12"
      fill="rgba(255,255,255,.55)" font-family="system-ui,sans-serif">${label}</text>`.replace(/\s+/g, ' ') : '');

/* keyboard key grid — also used as the keycap set's clip */
function keyGrid(cols, rows, x0, y0, size, gap, r) {
  const out = [];
  for (let ry = 0; ry < rows; ry++)
    for (let cx = 0; cx < cols; cx++)
      out.push(rr(x0 + cx * (size + gap), y0 + ry * (size + gap), size, size, r));
  return out;
}

const devices = [
  {
    id: 'phone', name: 'Phone case', name_fa: 'قاب گوشی', icon: 'phone',
    category: 'phone-cases', w: 300, h: 620, ratio: '300 / 620',
    path: rr(0, 0, 300, 620, 42),
    overlay:
      `<rect x="106" y="13" width="88" height="19" rx="9.5" fill="#05081F"/>` +
      `<rect x="222" y="16" width="62" height="62" rx="18" fill="rgba(4,7,26,.85)" stroke="rgba(139,107,255,.35)" stroke-width="1.5"/>` +
      `<circle cx="240" cy="34" r="9" fill="#0b1030" stroke="rgba(255,255,255,.22)" stroke-width="1.5"/>` +
      `<circle cx="266" cy="34" r="9" fill="#0b1030" stroke="rgba(255,255,255,.22)" stroke-width="1.5"/>` +
      `<circle cx="240" cy="60" r="9" fill="#0b1030" stroke="rgba(255,255,255,.22)" stroke-width="1.5"/>`,
    textY: 0.84, sticker: [[0.5, 0.3], [0.3, 0.52], [0.7, 0.62], [0.42, 0.7], [0.6, 0.4]],
  },
  {
    id: 'laptop', name: 'Laptop cover', name_fa: 'کاور لپ‌تاپ', icon: 'laptop',
    category: 'laptop', w: 620, h: 420, ratio: '620 / 420',
    path: rr(0, 0, 620, 420, 20),
    overlay:
      `<circle cx="310" cy="18" r="4.5" fill="rgba(4,7,26,.8)" stroke="rgba(255,255,255,.25)" stroke-width="1.3"/>` +
      `<rect x="0" y="398" width="620" height="22" rx="11" fill="rgba(4,7,26,.55)"/>` +
      `<rect x="232" y="404" width="156" height="9" rx="4.5" fill="rgba(255,255,255,.1)"/>`,
    textY: 0.62, sticker: [[0.5, 0.36], [0.28, 0.45], [0.72, 0.45], [0.38, 0.68], [0.64, 0.7]],
  },
  {
    id: 'pc', name: 'PC case panel', name_fa: 'پنل کیس کامپیوتر', icon: 'tower',
    category: 'pc', w: 380, h: 560, ratio: '380 / 560',
    path: rr(0, 0, 380, 560, 14),
    overlay:
      [22, 38, 54].map(y => `<rect x="250" y="${y}" width="106" height="6" rx="3" fill="rgba(255,255,255,.12)"/>`).join('') +
      [[20, 20], [360, 20], [20, 540], [360, 540]]
        .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="5" fill="rgba(4,7,26,.75)" stroke="rgba(255,255,255,.22)" stroke-width="1.4"/>`).join('') +
      `<rect x="16" y="16" width="348" height="528" rx="9" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="1.5"/>`,
    textY: 0.7, sticker: [[0.5, 0.3], [0.3, 0.46], [0.7, 0.5], [0.42, 0.62], [0.6, 0.38]],
  },
  {
    id: 'xbox', name: 'Xbox controller', name_fa: 'دسته ایکس‌باکس', icon: 'xbox',
    category: 'xbox', w: 400, h: 290, ratio: '400 / 290',
    path: PAD,
    overlay:
      ring(122, 112, 27) + dpad(158, 200) +
      btn(292, 90, 12, 'Y') + btn(266, 114, 12, 'X') + btn(318, 114, 12, 'B') + btn(292, 138, 12, 'A') +
      ring(248, 200, 25) +
      `<circle cx="200" cy="120" r="15" fill="rgba(4,7,26,.7)" stroke="rgba(255,255,255,.26)" stroke-width="2"/>` +
      `<rect x="178" y="152" width="18" height="9" rx="4.5" fill="rgba(255,255,255,.18)"/>` +
      `<rect x="204" y="152" width="18" height="9" rx="4.5" fill="rgba(255,255,255,.18)"/>`,
    textY: 0.28, sticker: [[0.5, 0.56], [0.18, 0.76], [0.82, 0.76], [0.33, 0.35], [0.67, 0.62]],
  },
  {
    id: 'playstation', name: 'PlayStation controller', name_fa: 'دسته پلی‌استیشن', icon: 'ps',
    category: 'playstation', w: 400, h: 290, ratio: '400 / 290',
    path: PAD,
    overlay:
      `<rect x="152" y="70" width="96" height="54" rx="9" fill="rgba(4,7,26,.6)" stroke="rgba(255,255,255,.22)" stroke-width="1.8"/>` +
      dpad(112, 112) +
      btn(288, 88, 11) + btn(264, 112, 11) + btn(312, 112, 11) + btn(288, 136, 11) +
      ring(154, 202, 25) + ring(246, 202, 25) +
      `<rect x="186" y="140" width="28" height="7" rx="3.5" fill="rgba(255,255,255,.2)"/>`,
    textY: 0.35, sticker: [[0.5, 0.58], [0.18, 0.76], [0.82, 0.76], [0.3, 0.52], [0.7, 0.52]],
  },
  {
    id: 'keyboard', name: 'Keyboard', name_fa: 'کیبورد', icon: 'keyboard',
    category: 'keyboards', w: 640, h: 262, ratio: '640 / 262',
    path: rr(0, 0, 640, 262, 16),
    overlay:
      keyGrid(14, 5, 22, 20, 36, 7, 6)
        .map(d => `<path d="${d}" fill="rgba(4,7,26,.45)" stroke="rgba(255,255,255,.14)" stroke-width="1.2"/>`)
        .join(''),
    textY: 0.92, sticker: [[0.5, 0.45], [0.22, 0.28], [0.78, 0.28], [0.35, 0.62], [0.65, 0.62]],
  },
  {
    id: 'keycaps', name: 'Keycap set', name_fa: 'ست کی‌کپ', icon: 'keycap',
    category: 'keycaps', w: 420, h: 320, ratio: '420 / 320',
    // the clip itself is the grid — artwork shows only through the caps
    path: keyGrid(5, 4, 20, 20, 68, 12, 12).join(' '),
    overlay: keyGrid(5, 4, 20, 20, 68, 12, 12)
      .map(d => `<path d="${d}" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="2"/>`)
      .join(''),
    textY: 0.5, sticker: [[0.5, 0.5], [0.2, 0.25], [0.8, 0.25], [0.2, 0.75], [0.8, 0.75]],
    noText: true,
  },
  {
    id: 'wallpaper', name: 'Wallpaper', name_fa: 'پس‌زمینه', icon: 'image',
    category: 'wallpapers', w: 640, h: 360, ratio: '640 / 360',
    path: rr(0, 0, 640, 360, 10),
    overlay: '',
    textY: 0.55, sticker: [[0.5, 0.35], [0.24, 0.5], [0.76, 0.5], [0.38, 0.72], [0.62, 0.72]],
  },
];

const byId = (id) => devices.find(d => d.id === id) || devices[0];

module.exports = { devices, byId };
