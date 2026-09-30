// Mint — data layer
// Mirrors templates/categories.md, marketplace/products.md, monetization/plans.md,
// gamification/{xp,levels,achievements}.md

const categories = [
  { slug: 'all',         name: 'All Templates', name_fa: 'همه قالب‌ها',  icon: 'grid' },
  { slug: 'keycaps',     name: 'Keycaps',       name_fa: 'کی‌کپ',        icon: 'key' },
  { slug: 'keyboards',   name: 'Keyboards',     name_fa: 'کیبورد',       icon: 'keyboard' },
  { slug: 'cases',       name: 'Phone Cases',   name_fa: 'قاب موبایل',   icon: 'phone' },
  { slug: 'laptop',      name: 'Laptop Covers', name_fa: 'کاور لپ‌تاپ',  icon: 'laptop' },
  { slug: 'pc',          name: 'PC Cases',      name_fa: 'کیس کامپیوتر', icon: 'tower' },
  { slug: 'xbox',        name: 'Xbox',          name_fa: 'ایکس‌باکس',    icon: 'xbox' },
  { slug: 'playstation', name: 'PlayStation',   name_fa: 'پلی‌استیشن',   icon: 'ps' },
  { slug: 'controllers', name: 'Controllers',   name_fa: 'دسته بازی',    icon: 'gamepad' },
  { slug: 'mouse',       name: 'Mouse',         name_fa: 'ماوس',         icon: 'mouse' },
  { slug: 'headsets',    name: 'Headsets',      name_fa: 'هدست',         icon: 'headset' },
  { slug: 'wallpapers',  name: 'Wallpapers',    name_fa: 'پس‌زمینه',     icon: 'image' },
  { slug: 'streaming',   name: 'Streaming',     name_fa: 'استریم',       icon: 'video' },
];

const styleTags = ['Gaming', 'Anime', 'Cyberpunk', 'Minimal', 'Abstract', 'Fantasy'];
const styleTagFa = { Gaming:'گیمینگ', Anime:'انیمه', Cyberpunk:'سایبرپانک', Minimal:'مینیمال',
                     Abstract:'انتزاعی', Fantasy:'فانتزی', All:'همه' };

const templates = [
  { id: 'neon-galaxy',   title: 'Neon Galaxy', title_fa: 'کهکشان نئونی', catLabel_fa: 'کی‌کپ',   category: 'keycaps',     catLabel: 'Keycaps',     tier: 'free',  tags: ['Gaming','Abstract'],   img: 'tpl-neon-galaxy',   likes: 2417, uses: 8932, author: 'mahdiyarxmr' },
  { id: 'anime-girl',    title: 'Anime Girl', title_fa: 'دختر انیمه', catLabel_fa: 'قاب',    category: 'cases',       catLabel: 'Case',        tier: 'pro',   tags: ['Anime','Fantasy'],     img: 'tpl-anime-girl',    likes: 3980, uses: 12401, author: 'yuki.dsg' },
  { id: 'minimal-purple',title: 'Minimal Purple', title_fa: 'بنفش مینیمال',category: 'wallpapers',  catLabel: 'Wallpaper', catLabel_fa: 'والپیپر',   tier: 'free',  tags: ['Minimal','Abstract'],  img: 'tpl-minimal-purple',likes: 1544, uses: 6210, author: 'lowpoly' },
  { id: 'cyber-dragon',  title: 'Cyber Dragon', title_fa: 'اژدهای سایبری', catLabel_fa: 'اسکین',  category: 'skins',       catLabel: 'Skin',        tier: 'pro',   tags: ['Cyberpunk','Fantasy'], img: 'tpl-cyber-dragon',  likes: 5122, uses: 14877, author: 'nocturne' },
  { id: 'retro-pixel',   title: 'Retro Pixel', title_fa: 'پیکسل رترو', catLabel_fa: 'دسته بازی',   category: 'controllers', catLabel: 'Controller',  tier: 'free',  tags: ['Gaming'],              img: 'tpl-retro-pixel',   likes: 1988, uses: 5402, author: 'bitcrush' },
  { id: 'forest-vibes',  title: 'Forest Vibes', title_fa: 'حال‌وهوای جنگل', catLabel_fa: 'پس‌زمینه',  category: 'wallpapers',  catLabel: 'Wallpaper',   tier: 'free',  tags: ['Fantasy','Minimal'],   img: 'tpl-forest-vibes',  likes: 2760, uses: 9120, author: 'mistwood' },
  { id: 'modern-circle', title: 'Modern Circle', title_fa: 'دایره مدرن', catLabel_fa: 'اسکین', category: 'skins',       catLabel: 'Skin',        tier: 'pro',   tags: ['Minimal','Abstract'],  img: 'tpl-modern-circle', likes: 1320, uses: 4088, author: 'formfn' },
  { id: 'purple-core',   title: 'Purple Core', title_fa: 'هسته بنفش', catLabel_fa: 'کی‌کپ',   category: 'keycaps',     catLabel: 'Keycaps',     tier: 'pro',   tags: ['Minimal','Gaming'],    img: 'tpl-purple-core',   likes: 3011, uses: 10233, author: 'mahdiyarxmr' },
  { id: 'nebula-lid',    title: 'Nebula Lid',    title_fa: 'درپوش سحابی',   category: 'laptop',      catLabel: 'Laptop Cover', catLabel_fa: 'کاور لپ‌تاپ', tier: 'free', tags: ['Abstract','Minimal'],  img: 'tpl-laptop-cover',  likes: 2104, uses: 7310,  author: 'formfn' },
  { id: 'violet-tower',  title: 'Violet Tower',  title_fa: 'برج بنفش',       category: 'pc',          catLabel: 'PC Case',      catLabel_fa: 'کیس',         tier: 'pro',  tags: ['Gaming','Cyberpunk'],   img: 'tpl-pc-case',       likes: 1877, uses: 5044,  author: 'nocturne' },
  { id: 'galaxy-pad-x',  title: 'Galaxy Pad',    title_fa: 'دسته کهکشانی',   category: 'xbox',        catLabel: 'Xbox Pad',     catLabel_fa: 'دسته ایکس‌باکس', tier: 'free', tags: ['Gaming','Abstract'], img: 'tpl-xbox-pad',   likes: 3402, uses: 11208, author: 'bitcrush' },
  { id: 'void-console',  title: 'Void Console',  title_fa: 'کنسول تهی',      category: 'xbox',        catLabel: 'Xbox Console', catLabel_fa: 'کنسول ایکس‌باکس', tier: 'pro', tags: ['Cyberpunk','Minimal'], img: 'tpl-xbox-console', likes: 2590, uses: 6733, author: 'nocturne' },
  { id: 'cosmic-pad',    title: 'Cosmic Pad',    title_fa: 'دسته کیهانی',    category: 'playstation', catLabel: 'PS Pad',       catLabel_fa: 'دسته پلی‌استیشن', tier: 'free', tags: ['Gaming','Fantasy'], img: 'tpl-ps-pad',      likes: 4115, uses: 13980, author: 'yuki.dsg' },
  { id: 'nova-faceplate',title: 'Nova Faceplate',title_fa: 'صفحه نووا',      category: 'playstation', catLabel: 'PS Faceplate', catLabel_fa: 'فِیس‌پلیت پلی‌استیشن', tier: 'pro', tags: ['Abstract','Fantasy'], img: 'tpl-ps-console', likes: 3688, uses: 9452, author: 'mistwood' },
];

const products = [
  { id: 'neon-keyboard-psd',  title: 'Neon Keyboard PSD', title_fa: 'فایل PSD کیبورد نئونی',  kind: 'PSD File', kind_fa: 'فایل PSD', price: 149000, badge: 'PSD',     img: 'tpl-neon-galaxy',    seller: 'mahdiyarxmr', sales: 412, rating: 4.9, state: 'published' },
  { id: 'anime-case-psd',     title: 'Anime Phone Case PSD', title_fa: 'فایل PSD قاب انیمه',kind: 'PSD File', kind_fa: 'فایل PSD', price: 119000, badge: 'PSD',     img: 'tpl-anime-girl',     seller: 'yuki.dsg',    sales: 908, rating: 4.8, state: 'published' },
  { id: 'gaming-setup-pack',  title: 'Gaming Setup Pack', title_fa: 'پک میز گیمینگ',  kind: 'Bundle', kind_fa: 'بسته',   price: 239000, badge: 'PREMIUM', img: 'tpl-cyber-dragon',   seller: 'nocturne',    sales: 245, rating: 5.0, state: 'published' },
  { id: 'minimal-keycaps-psd',title: 'Minimal Keycaps PSD', title_fa: 'فایل PSD کی‌کپ مینیمال',kind: 'PSD File', kind_fa: 'فایل PSD', price: 129000, badge: 'PSD',     img: 'tpl-purple-core',    seller: 'formfn',      sales: 331, rating: 4.7, state: 'published' },
  { id: 'laptop-skin-psd',    title: 'Laptop Skin PSD', title_fa: 'فایل PSD اسکین لپ‌تاپ',    kind: 'PSD File', kind_fa: 'فایل PSD', price: 179000, badge: 'PSD',     img: 'tpl-modern-circle',  seller: 'formfn',      sales: 176, rating: 4.6, state: 'published' },
  { id: 'wallpapers-pack',    title: 'Wallpapers Pack', title_fa: 'پک پس‌زمینه',    kind: 'Bundle', kind_fa: 'بسته',   price: 89000, badge: 'PACK',    img: 'tpl-forest-vibes',   seller: 'mistwood',    sales: 1204,rating: 4.9, state: 'published' },
  { id: 'controller-skin-psd',title: 'Controller Skin PSD', title_fa: 'فایل PSD اسکین دسته بازی',kind: 'PSD File', kind_fa: 'فایل PSD', price: 149000, badge: 'PSD',     img: 'tpl-retro-pixel',    seller: 'bitcrush',    sales: 288, rating: 4.5, state: 'published' },
  { id: 'sticker-pack',       title: 'Custom Sticker Pack', title_fa: 'پک استیکر سفارشی',kind: 'Assets', kind_fa: 'مجموعه فایل',   price: 59000, badge: 'PACK',    img: 'tpl-minimal-purple', seller: 'lowpoly',     sales: 2210,rating: 4.8, state: 'published' },
  { id: 'laptop-cover-psd', title: 'Laptop Cover PSD', title_fa: 'فایل PSD کاور لپ‌تاپ', kind: 'PSD File', kind_fa: 'فایل PSD', price: 169000, badge: 'PSD',     img: 'tpl-laptop-cover',  seller: 'formfn',   sales: 402, rating: 4.8, state: 'published' },
  { id: 'pc-panel-pack',    title: 'PC Panel Pack',    title_fa: 'پک پنل کیس',          kind: 'Bundle', kind_fa: 'بسته',   price: 199000, badge: 'PREMIUM', img: 'tpl-pc-case',       seller: 'nocturne', sales: 188, rating: 4.9, state: 'published' },
  { id: 'xbox-skin-psd',    title: 'Xbox Skin PSD',    title_fa: 'فایل PSD اسکین ایکس‌باکس', kind: 'PSD File', kind_fa: 'فایل PSD', price: 149000, badge: 'PSD', img: 'tpl-xbox-pad',   seller: 'bitcrush', sales: 671, rating: 4.7, state: 'published' },
  { id: 'ps-skin-psd',      title: 'PlayStation Skin PSD', title_fa: 'فایل PSD اسکین پلی‌استیشن', kind: 'PSD File', kind_fa: 'فایل PSD', price: 149000, badge: 'PSD', img: 'tpl-ps-pad', seller: 'yuki.dsg', sales: 843, rating: 4.9, state: 'published' },
];

// monetization/plans.md — capabilities configurable, no dark patterns (pricing.md)
const plans = [
  {
    id: 'free', name_fa: 'رایگان', tagline_fa: 'همین امروز شروع کنید.', cta_fa: 'پلن فعلی', name: 'Free', price: 0, cadence: 'forever', tagline: 'Start creating today.',
    features: [
      { label: '5 active projects', label_fa: '۵ پروژه فعال', ok: true },
      { label: '500 MB asset storage', label_fa: '۵۰۰ مگابایت فضای ذخیره', ok: true },
      { label: '20 AI credits / month', label_fa: '۲۰ اعتبار هوش مصنوعی در ماه', ok: true },
      { label: 'PNG export up to 1×', label_fa: 'خروجی PNG تا ۱×', ok: true },
      { label: 'Free template library', label_fa: 'کتابخانه قالب‌های رایگان', ok: true },
      { label: 'Premium templates', label_fa: 'قالب‌های ویژه', ok: false },
      { label: 'Commercial license', label_fa: 'مجوز تجاری', ok: false },
    ],
    cta: 'Current plan',
  },
  {
    id: 'pro', name_fa: 'حرفه‌ای', tagline_fa: 'برای سازندگان جدی.', cta_fa: 'ارتقا به حرفه‌ای', name: 'Pro', price: 199000, cadence: 'month', tagline: 'For serious creators.', featured: true,
    features: [
      { label: '100 active projects', label_fa: '۱۰۰ پروژه فعال', ok: true },
      { label: '20 GB asset storage', label_fa: '۲۰ گیگابایت فضای ذخیره', ok: true },
      { label: '500 AI credits / month', label_fa: '۵۰۰ اعتبار هوش مصنوعی در ماه', ok: true },
      { label: 'PNG · JPG · SVG · PDF up to 4×', label_fa: 'PNG · JPG · SVG · PDF تا ۴×', ok: true },
      { label: 'Full premium template library', label_fa: 'کتابخانه کامل قالب‌های ویژه', ok: true },
      { label: 'Commercial license', label_fa: 'مجوز تجاری', ok: true },
      { label: 'Priority AI processing', label_fa: 'پردازش اولویت‌دار هوش مصنوعی', ok: false },
    ],
    cta: 'Upgrade to Pro',
  },
  {
    id: 'studio', name_fa: 'استودیو', tagline_fa: 'برای تیم‌ها و فروشندگان.', cta_fa: 'ارتقا به استودیو', name: 'Studio', price: 499000, cadence: 'month', tagline: 'For teams and sellers.',
    features: [
      { label: 'Unlimited projects', label_fa: 'پروژه نامحدود', ok: true },
      { label: '200 GB asset storage', label_fa: '۲۰۰ گیگابایت فضای ذخیره', ok: true },
      { label: '2,500 AI credits / month', label_fa: '۲٬۵۰۰ اعتبار هوش مصنوعی در ماه', ok: true },
      { label: 'All formats incl. PSD · TIFF up to 8×', label_fa: 'همه فرمت‌ها شامل PSD · TIFF تا ۸×', ok: true },
      { label: 'Full premium template library', label_fa: 'کتابخانه کامل قالب‌های ویژه', ok: true },
      { label: 'Extended commercial license', label_fa: 'مجوز تجاری گسترده', ok: true },
      { label: 'Priority AI processing', label_fa: 'پردازش اولویت‌دار هوش مصنوعی', ok: true },
    ],
    cta: 'Upgrade to Studio',
  },
];

// gamification/levels.md — cumulative XP mapped to configurable named levels
const levels = [
  { level: 1, name: 'Sprout', name_fa: 'جوانه',    min: 0 },
  { level: 2, name: 'Sketcher', name_fa: 'طراح',  min: 100 },
  { level: 3, name: 'Shaper', name_fa: 'شکل‌دهنده',    min: 220 },
  { level: 4, name: 'Artisan', name_fa: 'هنرور',   min: 320 },
  { level: 5, name: 'Composer', name_fa: 'آهنگ‌ساز',  min: 500 },
  { level: 6, name: 'Virtuoso', name_fa: 'چیره‌دست',  min: 780 },
  { level: 7, name: 'Luminary', name_fa: 'درخشان',  min: 1200 },
];

const achievements = [
  { id: 'first-design', name: 'First Light', name_fa: 'اولین نور', desc_fa: 'اولین پروژه‌تان را ذخیره کنید.',      desc: 'Save your first project.',            xp: 20,  earned: true,  icon: 'spark' },
  { id: 'ten-designs',  name: 'Ten Strong', name_fa: 'ده‌تایی', desc_fa: '۱۰ طرح بسازید.',       desc: 'Create 10 designs.',                  xp: 60,  earned: true,  icon: 'layers' },
  { id: 'template-use', name: 'Remixer', name_fa: 'بازآفرین', desc_fa: 'از یک قالب کپی بگیرید و منتشر کنید.',          desc: 'Clone and publish from a template.',  xp: 40,  earned: true,  icon: 'copy' },
  { id: 'ai-explorer',  name: 'AI Explorer', name_fa: 'کاوشگر هوش مصنوعی', desc_fa: '۲۵ طرح در استودیو هوشمند بسازید.',      desc: 'Generate 25 designs in AI Studio.',   xp: 80,  earned: true,  icon: 'bot' },
  { id: 'streak-7',     name: 'Seven Days', name_fa: 'هفت روز', desc_fa: '۷ روز پیاپی طراحی کنید.',       desc: 'Keep a 7-day creation streak.',       xp: 100, earned: false, icon: 'flame' },
  { id: 'first-sale',   name: 'First Sale', name_fa: 'اولین فروش', desc_fa: 'اولین فایل خود را در بازارچه بفروشید.',       desc: 'Sell your first marketplace asset.',  xp: 150, earned: false, icon: 'tag' },
  { id: 'hundred-likes',name: 'Crowd Favourite', name_fa: 'محبوب جمع', desc: 'Earn 100 likes across your designs.', desc_fa: 'روی طرح‌هایتان ۱۰۰ لایک بگیرید.', xp: 120, earned: false, icon: 'heart' },
  { id: 'top-ten',      name: 'Top Ten', name_fa: 'ده نفر برتر', desc_fa: 'به جمع ۱۰ نفر برتر هفته برسید.',          desc: 'Reach the weekly leaderboard top 10.',xp: 200, earned: false, icon: 'trophy' },
];

const quests = [
  { id: 'q1', name: 'Daily Spark', name_fa: 'جرقه روزانه', desc_fa: 'امروز یک پروژه ذخیره کنید.',    desc: 'Save any project today.',         xp: 15, progress: 1, goal: 1 },
  { id: 'q2', name: 'Try the Studio', name_fa: 'استودیو را امتحان کن', desc_fa: '۳ بار از هوش مصنوعی استفاده کنید.', desc: 'Run 3 AI generations.',           xp: 30, progress: 2, goal: 3 },
  { id: 'q3', name: 'Give Back', name_fa: 'جبران کن', desc_fa: '۵ طرح جامعه را بپسندید.',      desc: 'Like 5 community designs.',       xp: 20, progress: 3, goal: 5 },
  { id: 'q4', name: 'Ship It', name_fa: 'منتشرش کن', desc_fa: '۱ طرح در کاوش منتشر کنید.',        desc: 'Publish 1 design to Explore.',    xp: 50, progress: 0, goal: 1 },
];

const user = {
  name: 'Mahdiyar Tavakoli', name_fa: 'مهدیار توکلی', handle: '@mahdiyarxmr', member: 'Pro Member', member_fa: 'عضو حرفه‌ای',
  designs: 12, favorites: 8, purchases: 3,
  xp: 320, level: 4, levelName: 'Artisan', nextLevelXp: 500, credits: 412, creditsTotal: 500,
  streak: 4, joined: 'March 2025', joined_fa: 'اسفند ۱۴۰۳', location: 'Mashhad, Iran', location_fa: 'مشهد، ایران',
  bio: 'Designing neon-soaked gear skins. Keycaps, cases and everything that glows.', bio_fa: 'طراح اسکین‌های نئونی. کی‌کپ، قاب و هر چیزی که می‌درخشد.',
};

const recentDesigns = [
  { id: 'd1', title: 'Galaxy TKL', title_fa: 'کهکشان TKL',     img: 'tpl-neon-galaxy',    edited: '2 hours ago', edited_fa: '۲ ساعت پیش',  status: 'published', likes: 34 },
  { id: 'd2', title: 'Violet Case v3', title_fa: 'قاب بنفش ۳', img: 'tpl-anime-girl',     edited: 'Yesterday', edited_fa: 'دیروز',    status: 'draft',     likes: 0 },
  { id: 'd3', title: 'Moonrise', title_fa: 'طلوع ماه',       img: 'tpl-minimal-purple', edited: '3 days ago', edited_fa: '۳ روز پیش',   status: 'published', likes: 118 },
  { id: 'd4', title: 'Dragon Skin', title_fa: 'اسکین اژدها',    img: 'tpl-cyber-dragon',   edited: 'Last week', edited_fa: 'هفته گذشته',    status: 'published', likes: 267 },
  { id: 'd5', title: 'Pixel Pad', title_fa: 'پد پیکسلی',      img: 'tpl-retro-pixel',    edited: 'Last week', edited_fa: 'هفته گذشته',    status: 'draft',     likes: 0 },
  { id: 'd6', title: 'Deep Forest', title_fa: 'جنگل عمیق',    img: 'tpl-forest-vibes',   edited: '2 weeks ago', edited_fa: '۲ هفته پیش',  status: 'published', likes: 91 },
];

const leaderboard = [
  { rank: 1, name: 'nocturne',    xp: 14820, designs: 96, trend: 'up' },
  { rank: 2, name: 'yuki.dsg',    xp: 12440, designs: 81, trend: 'up' },
  { rank: 3, name: 'mistwood',    xp: 10190, designs: 74, trend: 'down' },
  { rank: 4, name: 'formfn',      xp: 8860,  designs: 63, trend: 'up' },
  { rank: 5, name: 'bitcrush',    xp: 7315,  designs: 55, trend: 'flat' },
  { rank: 6, name: 'lowpoly',     xp: 6120,  designs: 49, trend: 'up' },
  { rank: 7, name: 'mahdiyarxmr', xp: 5480,  designs: 12, trend: 'up', me: true },
  { rank: 8, name: 'vaporwavy',   xp: 4970,  designs: 41, trend: 'down' },
];

const notifications = [
  { id: 'n1', type: 'like',    text: '<b>nocturne</b> liked your design <b>Moonrise</b>.',        time: '12m',  unread: true },
  { id: 'n2', type: 'xp',      text: 'You earned <b>+30 XP</b> for completing <b>Try the Studio</b>.', time: '1h', time_fa: '۱ ساعت', unread: true },
  { id: 'n3', type: 'follow',  text: '<b>yuki.dsg</b> started following you.',                    time: '3h', time_fa: '۳ ساعت',   unread: true },
  { id: 'n4', type: 'sale',    text: 'Your asset <b>Neon Keyboard PSD</b> sold. <b>+$4.99</b>',    time: '1d', time_fa: '۱ روز',   unread: false },
  { id: 'n5', type: 'comment', text: '<b>formfn</b> commented on <b>Dragon Skin</b>.',             time: '2d',   unread: false },
  { id: 'n6', type: 'system',  text: 'Your AI credits reset to <b>500</b> for this cycle.',        time: '4d',   unread: false },
];

const purchases = [
  { id: 'p1', title: 'Gaming Setup Pack', title_fa: 'پک میز گیمینگ', price: 239000, date: 'Sep 14, 2026', date_fa: '۲۳ شهریور ۱۴۰۵', invoice: 'MNT-10482', seller: 'nocturne', img: 'tpl-cyber-dragon' },
  { id: 'p2', title: 'Wallpapers Pack', title_fa: 'پک والپیپر', price: 89000, date: 'Aug 30, 2026', date_fa: '۸ شهریور ۱۴۰۵', invoice: 'MNT-10231', seller: 'mistwood', img: 'tpl-forest-vibes' },
  { id: 'p3', title: 'Custom Sticker Pack', title_fa: 'پک استیکر سفارشی', price:59000, date: 'Aug 02, 2026', date_fa: '۱۱ مرداد ۱۴۰۵', invoice: 'MNT-09944', seller: 'lowpoly',  img: 'tpl-minimal-purple' },
];

const downloads = [
  { id: 'dl1', title: 'Galaxy TKL', title_fa: 'کهکشان TKL',   format: 'PNG', res: '4096 × 2160', size: '8.2 MB', date: 'Today', date_fa: 'امروز',        img: 'tpl-neon-galaxy' },
  { id: 'dl2', title: 'Moonrise', title_fa: 'طلوع ماه',     format: 'PNG', res: '2560 × 1440', size: '3.1 MB', date: 'Sep 24, 2026', date_fa: '۲ مهر ۱۴۰۵', img: 'tpl-minimal-purple' },
  { id: 'dl3', title: 'Dragon Skin', title_fa: 'اسکین اژدها',  format: 'PDF', res: 'Vector',      size: '12.7 MB',date: 'Sep 19, 2026', date_fa: '۲۸ شهریور ۱۴۰۵', img: 'tpl-cyber-dragon' },
  { id: 'dl4', title: 'Deep Forest', title_fa: 'جنگل عمیق',  format: 'JPG', res: '1920 × 1080', size: '1.4 MB', date: 'Sep 11, 2026', date_fa: '۲۰ شهریور ۱۴۰۵', img: 'tpl-forest-vibes' },
];

const collections = [
  { id: 'c1', name: 'Neon Nights', name_fa: 'شب‌های نئونی',  count: 14, cover: ['tpl-neon-galaxy','tpl-cyber-dragon','tpl-purple-core'] },
  { id: 'c2', name: 'Soft Minimal', name_fa: 'مینیمال نرم', count: 9,  cover: ['tpl-minimal-purple','tpl-modern-circle','tpl-forest-vibes'] },
  { id: 'c3', name: 'Anime Shelf', name_fa: 'قفسه انیمه',  count: 21, cover: ['tpl-anime-girl','tpl-cyber-dragon','tpl-neon-galaxy'] },
];

// editor/tools.md
const editorTools = [
  { id: 'select',   label: 'Select',    key: 'V' },
  { id: 'pan',      label: 'Pan',       key: 'H' },
  { id: 'text',     label: 'Text',      key: 'T' },
  { id: 'image',    label: 'Image',     key: 'I' },
  { id: 'shape',    label: 'Shape',     key: 'R' },
  { id: 'line',     label: 'Line',      key: 'L' },
  { id: 'crop',     label: 'Crop',      key: 'C' },
];

const editorPanels = [
  { id: 'base',     label: 'Base',         icon: 'square' },
  { id: 'colors',   label: 'Colors',       icon: 'palette' },
  { id: 'patterns', label: 'Patterns',     icon: 'pattern' },
  { id: 'stickers', label: 'Stickers',     icon: 'sticker' },
  { id: 'text',     label: 'Text',         icon: 'type' },
  { id: 'effects',  label: 'Effects',      icon: 'spark' },
  { id: 'ai',       label: 'AI Assistant', icon: 'bot', badge: 'NEW' },
];

const palette = ['#8E8AA8', '#A78BFA', '#7C5CFF', '#6D4AFF', '#4A2FCC', '#2A1B6B', '#0F0A2E'];

const aiStyles = ['Gaming setup', 'Anime style', 'Minimalist', 'Abstract', 'Fantasy', 'Cyberpunk'];

const aiHistory = [
  { id: 'h1', prompt: 'a purple cyberpunk keyboard with a dragon', prompt_fa: 'کیبورد سایبرپانک بنفش با نقش اژدها', img: 'tpl-cyber-dragon',  time: '5m', time_fa: '۵ دقیقه',  credits: 4 },
  { id: 'h2', prompt: 'minimal violet mountains at night', prompt_fa: 'کوه‌های بنفش مینیمال در شب',         img: 'tpl-minimal-purple',time: '1h', time_fa: '۱ ساعت',  credits: 4 },
  { id: 'h3', prompt: 'anime girl, white hair, starry sky', prompt_fa: 'دختر انیمه، موی سفید، آسمان پرستاره',        img: 'tpl-anime-girl',    time: '3h', time_fa: '۳ ساعت',  credits: 4 },
  { id: 'h4', prompt: 'misty pine forest, glowing fireflies', prompt_fa: 'جنگل کاج مه‌آلود، کرم‌های شب‌تاب',      img: 'tpl-forest-vibes',  time: '1d', time_fa: '۱ روز',  credits: 4 },
];

const faqs = [
  { q: 'What exactly is Mint?', a: 'Mint is a digital design platform for device-related products — keycaps, keyboards, phone cases, laptop skins, controllers, wallpapers and streaming assets. You design and export files. Mint is not a manufacturing service in this release.' },
  { q: 'Do I own what I make?', a: 'You own your original designs. Templates and marketplace assets carry their own licence, shown on every product page before purchase.' },
  { q: 'How do AI credits work?', a: 'Each generation costs credits from your monthly allowance. Credits reset at the start of each billing cycle and never expire mid-cycle. Failed generations are always refunded.' },
  { q: 'Can I sell on the Marketplace?', a: 'Yes. Any account can submit assets. Submissions go to review before they are published, and payouts are released monthly.' },
  { q: 'What formats can I export?', a: 'PNG on every plan. Pro adds JPG, SVG and PDF up to 4×. Studio adds PSD and TIFF up to 8×.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Cancel from Settings → Billing. You keep paid features until the end of the period you already paid for, and we never hide the cancel button.' },
];

const levelFor = (xp) => [...levels].reverse().find(l => xp >= l.min) || levels[0];

module.exports = {
  categories, styleTags, styleTagFa, templates, products, plans, levels, achievements, quests,
  user, recentDesigns, leaderboard, notifications, purchases, downloads, collections,
  editorTools, editorPanels, palette, aiStyles, aiHistory, faqs, levelFor,
};
