/* ===================================================================
 *  Chùa Online 2.5D · Chánh Điện Engine for TikTok LIVE Studio
 *  Canvas 1080x1920 2.5D Hall + Animated Devotees + Web Audio + Socket
 * =================================================================== */

(() => {
'use strict';

// ─── Socket & State ────────────────────────────────────────────────
const socket = io();
let config = {};
let liveStats = { viewers: 0, totalPoints: 0, likes: 0, shares: 0 };
let currentUsername = 'hanguyxn';

// ─── DOM References ────────────────────────────────────────────────
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const countEl = document.getElementById('count');
const totalPointsEl = document.getElementById('totalPoints');
const templeNameEl = document.getElementById('templeName');
const monkStatusEl = document.getElementById('monkStatus');
const liveChannelEl = document.getElementById('liveChannel');
const feedEl = document.getElementById('feed');
const toastEl = document.getElementById('toast');
const boardEl = document.getElementById('board');
const boardListEl = document.getElementById('boardList');
const audioGate = document.getElementById('audioGate');
const btnStartAudio = document.getElementById('btnStartAudio');
const btnMute = document.getElementById('mute');
const btnNextTrack = document.getElementById('nextTrack');
const nowPlayingEl = document.getElementById('nowPlaying');

// ─── 2.5D Stage Coordinates (Virtual 1080 x Dynamic SH) ────────────
const SW = 1080;
let SH = 1920; // Tự động co giãn theo tỷ lệ màn hình (iPhone 11 ~2340px)

// ─── Asset Loader ──────────────────────────────────────────────────
const A = {};
const ASSETS = {
  hall: '/assets/hall.jpg',
  monk: '/assets/c_monk.png',
  nun: '/assets/c_nun.png',
  granny: '/assets/c_granny.png',
  man: '/assets/c_man.png',
  woman: '/assets/c_woman.png',
  child: '/assets/c_child.png',
  anim_man: '/assets/anim_man.png',
  anim_woman: '/assets/anim_woman.png',
  anim_granny: '/assets/anim_granny.png',
  lotus: '/assets/fx_lotus.png',
  halo: '/assets/fx_halo.png',
  bell: '/assets/fx_bell.png',
  incense: '/assets/fx_incense.png',
  petal: '/assets/fx_petal.png',
  mo: '/assets/fx_mo.png',
  banner: '/assets/fx_banner.png',
  scroll: '/assets/fx_scroll.png'
};

let loadedCount = 0;
const totalAssets = Object.keys(ASSETS).length;
for (const [key, src] of Object.entries(ASSETS)) {
  const img = new Image();
  img.onload = () => { loadedCount++; };
  img.onerror = () => { loadedCount++; console.warn('Missing asset:', src); };
  img.src = src;
  A[key] = img;
}

// Strip animations (8 frames: 0-3 walk from behind, 4-7 sit down onto cushion)
const ANIM = {
  man: { fw: 212, fh: 300, seatH: 210 },
  woman: { fw: 212, fh: 300, seatH: 220 },
  granny: { fw: 195, fh: 300, seatH: 222 }
};
const hasAnim = skin => Boolean(ANIM[skin] && A['anim_' + skin] && A['anim_' + skin].naturalWidth > 0);

// ─── Floor Perspective Grid (42 bồ đoàn lụa) ────────────────────────
let FLOOR = { yTop: 1030, yBot: 1790, xHalfTop: 240, xHalfBot: 400 };
let DOOR = { x: SW / 2, y: SH + 140 }; // Vào từ mép dưới
let seats = [];

function buildSeats() {
  seats.length = 0;
  FLOOR.yTop = 1260;
  FLOOR.yBot = Math.round(SH - 120);
  FLOOR.xHalfTop = 260;
  FLOOR.xHalfBot = Math.round(440 + Math.max(0, (FLOOR.yBot - 1790) * 0.22));
  DOOR.x = SW / 2;
  DOOR.y = SH + 140;

  // Cấu hình các hàng ghế kích thước thanh thoát, gọn gàng để Chánh Điện đón được đông đảo Phật tử (70 chỗ)
  // Các hàng ghế được bố trí theo luật phối cảnh 2.5D, khoảng cách quây quần ấm cúng
  const ROW_CONFIGS = [
    { r: 0, y: 1275, scale: 0.28, aisleHalf: 38, colStep: 62, colsPerSide: 6 },
    { r: 1, y: 1350, scale: 0.32, aisleHalf: 42, colStep: 68, colsPerSide: 6 },
    { r: 2, y: 1430, scale: 0.37, aisleHalf: 48, colStep: 76, colsPerSide: 5 },
    { r: 3, y: 1515, scale: 0.42, aisleHalf: 54, colStep: 86, colsPerSide: 5 },
    { r: 4, y: 1610, scale: 0.48, aisleHalf: 62, colStep: 96, colsPerSide: 5 },
    { r: 5, y: 1715, scale: 0.54, aisleHalf: 70, colStep: 108, colsPerSide: 4 },
    { r: 6, y: 1825, scale: 0.60, aisleHalf: 78, colStep: 120, colsPerSide: 4 }
  ];

  if (SH > 1920) {
    const extraRows = Math.floor((SH - 1920) / 110);
    for (let er = 0; er < extraRows; er++) {
      const ey = 1825 + (er + 1) * 110;
      ROW_CONFIGS.push({
        r: 7 + er,
        y: ey,
        scale: Math.min(0.68, 0.60 + (er + 1) * 0.04),
        aisleHalf: 86,
        colStep: 125,
        colsPerSide: 4
      });
    }
  }

  const generated = [];
  for (const rc of ROW_CONFIGS) {
    for (let side = -1; side <= 1; side += 2) {
      for (let c = 0; c < rc.colsPerSide; c++) {
        const x = SW / 2 + side * (rc.aisleHalf + c * rc.colStep);
        // Ưu tiên: hàng giữa (r = 2 hoặc 3) xếp trước, cột sát lối giữa (c = 0) xếp trước
        const rowDist = Math.abs(rc.r - 2.5);
        const priority = rowDist * 10 + c * 2 + (side > 0 ? 1 : 0);
        generated.push({
          r: rc.r,
          c: (side < 0) ? (rc.colsPerSide - 1 - c) : (rc.colsPerSide + c),
          x: Math.round(x),
          y: rc.y,
          scale: rc.scale,
          priority
        });
      }
    }
  }

  seats = generated.map((item, idx) => ({
    ...item,
    taken: null,
    order: idx
  }));

  // Sắp xếp ưu tiên: ngồi quây quần san sát ở giữa trước, sau đó mở rộng dần ra xung quanh
  seats.sort((a, b) => a.priority - b.priority);
}
buildSeats();

// ─── Visitors & Particle FX ────────────────────────────────────────
const visitors = [];
const fx = [];
const floaters = [];
const SKINS = ['man', 'woman', 'granny', 'man', 'woman', 'nun', 'monk', 'child'];
let haloPulse = 0;

function freeSeat() {
  return seats.find(s => !s.taken) || null;
}

function findVisitor(userOrName, userId = null, uniqueId = null) {
  let uId = userId;
  let unq = uniqueId;
  let name = '';
  let nick = '';

  if (userOrName && typeof userOrName === 'object') {
    uId = userOrName.id || userId;
    unq = userOrName.uniqueId || uniqueId;
    name = (userOrName.name || '').trim().toLowerCase();
    nick = (userOrName.nickname || '').trim().toLowerCase();
  } else if (typeof userOrName === 'string') {
    name = userOrName.trim().toLowerCase();
    nick = name;
  }

  // 1. Khớp theo TikTok user ID
  if (uId) {
    const byId = visitors.find(v => v.id && String(v.id) === String(uId));
    if (byId) return byId;
  }

  // 2. Khớp theo TikTok uniqueId (@username)
  if (unq) {
    const cleanUnq = String(unq).toLowerCase().replace(/^@/, '').trim();
    if (cleanUnq) {
      const byUnq = visitors.find(v => v.uniqueId && String(v.uniqueId).toLowerCase().replace(/^@/, '').trim() === cleanUnq);
      if (byUnq) return byUnq;
    }
  }

  // 3. Khớp theo Nickname hiển thị
  if (nick && nick !== 'phật tử') {
    const byNick = visitors.find(v => (v.nickname && v.nickname.toLowerCase() === nick) || (v.name && v.name.toLowerCase() === nick));
    if (byNick) return byNick;
  }

  // 4. Khớp theo Tên
  if (name && name !== 'phật tử') {
    const byName = visitors.find(v => (v.name && v.name.toLowerCase() === name) || (v.nickname && v.nickname.toLowerCase() === name));
    if (byName) return byName;
  }

  return null;
}

// Giữ lại hàm tương thích cũ
function findVisitorByName(name, userId = null) {
  return findVisitor(name, userId);
}

function addVisitor(userOrName, skin, instant = false, userId = null, isBot = false) {
  let seat = freeSeat();

  // Nếu hết bồ đoàn trống, nhường chỗ từ phật tử đã ở lâu nhất mà không để sót bất kỳ ai
  if (!seat) {
    // 1. Ưu tiên bot ảo chưa cúng dường
    let candidate = visitors
      .filter(v => v.isBot && v.coins === 0)
      .sort((a, b) => a.stayTimer - b.stayTimer)[0];

    // 2. Tiếp theo là người thật chưa cúng dường có stayTimer thấp nhất
    if (!candidate) {
      candidate = visitors
        .filter(v => v.coins === 0 && v.state !== 'fade_out')
        .sort((a, b) => a.stayTimer - b.stayTimer)[0];
    }

    // 3. Fallback: Chọn phật tử có ít cúng dường nhất
    if (!candidate) {
      candidate = visitors
        .filter(v => v.state !== 'fade_out')
        .sort((a, b) => (a.coins - b.coins) || (a.stayTimer - b.stayTimer))[0];
    }

    if (candidate) {
      seat = candidate.seat;
      if (seat) {
        seat.taken = null;
        candidate.seat = null;
      }
      candidate.state = 'fade_out';
      candidate.fadeSpeed = 2.5;
    }
  }

  // Nếu vẫn không có seat (trường hợp cực hiếm), lấy 1 bồ đoàn ngẫu nhiên
  if (!seat && seats.length > 0) {
    seat = seats[Math.floor(Math.random() * seats.length)];
    if (seat && seat.taken) {
      const prev = seat.taken;
      prev.seat = null;
      prev.state = 'fade_out';
      prev.fadeSpeed = 2.5;
      seat.taken = null;
    }
  }

  if (!seat) return null;

  let id = userId;
  let name = 'Phật tử';
  let nickname = '';
  let uniqueId = '';
  let avatar = '';

  if (userOrName && typeof userOrName === 'object') {
    id = userOrName.id || userId;
    name = userOrName.name || userOrName.nickname || userOrName.uniqueId || 'Phật tử';
    nickname = userOrName.nickname || name;
    uniqueId = userOrName.uniqueId || '';
    avatar = userOrName.avatar || '';
  } else if (typeof userOrName === 'string') {
    name = userOrName;
    nickname = userOrName;
  }

  const staySec = (config.bot && config.bot.stayDurationSec) ? config.bot.stayDurationSec : 60;
  // Người thật vào ở 75-90s, bot ở 45-65s
  const stayDuration = isBot ? (staySec * (0.8 + Math.random() * 0.4)) : (staySec * 1.3 + Math.random() * 15);

  const RUNNING_SKINS = ['man', 'woman', 'granny'];
  const chosenSkin = (skin && ANIM[skin]) ? skin : RUNNING_SKINS[Math.floor(Math.random() * RUNNING_SKINS.length)];

  const startX = SW / 2 + (Math.random() - 0.5) * 20;
  const startY = FLOOR.yBot + 15; // Xuất phát từ cửa chánh điện ngay mép dưới sàn gỗ

  const v = {
    id: id || (isBot ? 'bot_' : 'v_') + Math.random().toString(36).slice(2, 8),
    name: name || 'Phật tử',
    nickname: nickname || name,
    uniqueId: uniqueId || '',
    avatar: avatar || '',
    skin: chosenSkin,
    seat,
    x: instant ? seat.x : startX,
    y: instant ? seat.y : startY,
    state: instant ? 'sit' : 'running_in',
    t: 0,
    frame: 0,
    ft: 0,
    sitT: -1,
    standT: 0,
    flip: false,
    fade: 1,
    fadeSpeed: 1,
    bob: 0,
    bow: 0,
    glow: 0,
    coins: 0,
    phase: Math.random() * 6.28,
    speech: null,
    speechTimer: 0,
    speechTotal: 6.0,
    isBot: Boolean(isBot),
    stayTimer: stayDuration,
    createdAt: Date.now()
  };

  seat.taken = v;
  visitors.push(v);
  updateCountUI();

  // Cánh hoa sen nhỏ báo hiệu phật tử an tọa
  for (let i = 0; i < 3; i++) {
    floaters.push({
      x: seat.x + (Math.random() - 0.5) * 30,
      y: seat.y - 30,
      vx: (Math.random() - 0.5) * 20,
      vy: -(25 + Math.random() * 25),
      t: 0,
      life: 1.5,
      s: 0.12
    });
  }

  return v;
}

// Cho 1 Phật tử đứng dậy và bước ra khỏi chánh điện
function startVisitorExit(v) {
  if (!v || v.state === 'standing' || v.state === 'walk_out') return;
  v.state = 'standing';
  v.standT = 0;
}

function removeVisitor(v) {
  if (!v) return;
  if (v.seat && v.seat.taken === v) {
    v.seat.taken = null;
  }
  const idx = visitors.indexOf(v);
  if (idx >= 0) visitors.splice(idx, 1);
  updateCountUI();
}

function updateCountUI() {
  const displayCount = Math.max(visitors.length, liveStats.viewers || 0);
  if (countEl) countEl.textContent = displayCount;
}

// ─── Danh Sách Phật Tử Ảo (Chỉ dùng khi Streamer BẬT tính năng Bot) ──
const SAMPLE_BOT_NAMES = [
  'Diệu Hạnh', 'Minh Tâm', 'Thiện Đức', 'Huệ An',
  'Tịnh Nhã', 'Quảng Trí', 'Chơn Như', 'Pháp Hỷ',
  'Nguyên Thanh', 'Tâm Đăng', 'Diệu Liên', 'Trí Hải',
  'Thanh Trúc', 'Bảo Châu', 'Phúc Lâm', 'Hoài An',
  'Minh Tuệ', 'Diệu Âm', 'Quang Khải', 'Hạnh Nguyện'
];

let botSpawnTimer = 0;

function spawnRandomBot() {
  if (!config.bot || !config.bot.enabled) return;
  const seat = freeSeat();
  if (!seat) return;
  const name = SAMPLE_BOT_NAMES[Math.floor(Math.random() * SAMPLE_BOT_NAMES.length)];
  const skin = SKINS[Math.floor(Math.random() * SKINS.length)];
  addVisitor(name, skin, false, 'bot_' + Date.now(), true);
}

// ─── Web Audio API (Bell + Mõ Synthesis + Meditative Music) ──────────
let AC = null;
let masterGain = null;
let musicGain = null;
let muted = false;
let audioStarted = false;
let mokTimer = null;
let bellTimer = null;

const TRACKS = [
  { src: '/assets/music/loi_phat_day.m4a', name: 'Lời Phật Dạy · Nửa Đời Còn Lại Hãy Sống Chậm & Bình Yên' },
  { src: '/assets/music/music1.mp3', name: 'Nhạc Thiền Tịnh Tâm 1' },
  { src: '/assets/music/music2.mp3', name: 'Nhạc Thiền Tịnh Tâm 2' }
];
let musicEls = [];
let trackIdx = 0;

function startAudioEngine() {
  if (audioStarted && AC) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    AC = new AudioCtx();
    masterGain = AC.createGain();
    masterGain.gain.value = 0.85;
    masterGain.connect(AC.destination);

    musicGain = AC.createGain();
    musicGain.gain.value = 0.65;
    musicGain.connect(masterGain);

    playMusicTrack(0);

    // Chuông định kỳ mỗi 60s
    bell(false);
    bellTimer = setInterval(() => bell(false), 60000);

    // Mõ gõ nhẹ nhàng đệm thanh tịnh
    mokTimer = setInterval(() => mok(0.06), 2000);

    audioStarted = true;
    if (audioGate) audioGate.classList.add('hidden');
  } catch (err) {
    console.warn('Web Audio error:', err);
  }
}

function playMusicTrack(idx) {
  if (!AC) return;
  trackIdx = (idx + TRACKS.length) % TRACKS.length;
  const track = TRACKS[trackIdx];

  const audioEl = new Audio(track.src);
  audioEl.preload = 'auto';
  audioEl.crossOrigin = 'anonymous';
  audioEl.loop = true;

  try {
    const src = AC.createMediaElementSource(audioEl);
    const gain = AC.createGain();
    gain.gain.value = 0;
    src.connect(gain);
    gain.connect(musicGain);

    const now = AC.currentTime;
    gain.gain.linearRampToValueAtTime(1, now + 2);

    for (const old of musicEls) {
      old.gain.cancelScheduledValues(now);
      old.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.linearRampToValueAtTime(0, now + 2);
      setTimeout(() => { try { old.el.pause(); } catch (e) {} }, 2200);
    }
    musicEls = [{ el: audioEl, gain }];

    audioEl.addEventListener('ended', () => {
      playMusicTrack(0);
    });

    audioEl.addEventListener('error', () => {
      console.warn('[Audio] Lỗi tải bài nhạc, chuyển bài tiếp theo sau 2s');
      setTimeout(() => playMusicTrack(trackIdx + 1), 2000);
    });

    audioEl.play().catch(() => {});
    if (nowPlayingEl) nowPlayingEl.textContent = '♪ ' + track.name;
  } catch (e) {
    console.warn('Track play error:', e);
  }
}

function playMusicByUrl(src, name) {
  if (!AC) return;
  const audioEl = new Audio(src);
  audioEl.preload = 'auto';
  audioEl.crossOrigin = 'anonymous';
  audioEl.loop = true;

  try {
    const srcNode = AC.createMediaElementSource(audioEl);
    const gain = AC.createGain();
    gain.gain.value = 0;
    srcNode.connect(gain);
    gain.connect(musicGain);

    const now = AC.currentTime;
    gain.gain.linearRampToValueAtTime(1, now + 1.8);

    for (const old of musicEls) {
      old.gain.cancelScheduledValues(now);
      old.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.linearRampToValueAtTime(0, now + 1.8);
      setTimeout(() => { try { old.el.pause(); } catch (e) {} }, 2000);
    }
    musicEls = [{ el: audioEl, gain }];

    audioEl.addEventListener('error', () => {
      console.warn('[Audio] Lỗi tải bài nhạc tùy chỉnh, thử lại track mặc định');
      setTimeout(() => playMusicTrack(0), 2000);
    });

    audioEl.play().catch(() => {});
    if (nowPlayingEl) nowPlayingEl.textContent = '♪ ' + (name || 'Nhạc Thiền');
  } catch (e) {
    console.warn('Custom track play error:', e);
  }
}

function setDuckMusic(isDucking) {
  if (!musicGain || !AC) return;
  const now = AC.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(musicGain.gain.value, now);
  musicGain.gain.linearRampToValueAtTime(isDucking ? 0.15 : 0.5, now + 0.4);
}

// Chuông đồng ngân vang (432Hz, 1296Hz, 2160Hz)
function bell(isBig = false) {
  if (!AC || muted) return;
  try {
    const now = AC.currentTime;
    const k = isBig ? 1.6 : 1.0;
    const freqs = [
      [432, 0.5, 6],
      [1296, 0.18, 3.5],
      [2160, 0.08, 2.2]
    ];

    for (const [f, a, d] of freqs) {
      const osc = AC.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f / (isBig ? 2 : 1);
      const gain = AC.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(a * k, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + d * k);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + d * k + 0.1);
    }
    haloPulse = 1.0;
  } catch (e) {}
}

// Mõ gỗ trầm bổng thanh tịnh
function mok(vol = 0.16) {
  if (!AC || muted) return;
  try {
    const now = AC.currentTime;
    const osc = AC.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.03);

    const bp = AC.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 4;

    const gain = AC.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(bp);
    bp.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch (e) {}
}

// ─── Giọng Đọc Chúc Phúc Tiếng Việt Chuẩn (Google TTS API Miễn Phí) ────
// Làm sạch tên người xem trước khi đọc (bỏ emoji, ký tự loằng ngoằng, số đuôi dài)
function cleanSpeakerName(raw) {
  if (!raw) return 'Phật tử';
  let s = String(raw);
  // Bỏ emoji
  s = s.replace(/[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  // Bỏ ký tự đặc biệt, gạch dưới, chấm, sao
  s = s.replace(/[_\.\-\*#@~\|/\\]+/g, ' ');
  // Nếu là dạng user12345678 thì đọc là "Phật tử"
  s = s.replace(/^user\d+/i, 'Phật tử');
  // Bỏ đuôi số dài hơn 3 chữ số ở cuối (vd: mai99824 -> mai)
  s = s.replace(/\d{4,}$/g, '');
  s = s.trim().replace(/\s+/g, ' ');
  if (!s || s.length < 2) return 'Phật tử';
  return s.slice(0, 24);
}

// Hàng đợi phát âm giọng đọc tiếng Việt (100% chuẩn tiếng Việt không cần cài giọng máy)
const speechQueue = [];
let isSpeaking = false;
let currentTtsAudio = null;

function speakSpeechQueue(text, priority = 'normal') {
  if (!text) return;

  if (priority === 'high') {
    // Quà tặng cúng dường được ưu tiên phát ngay sau câu hiện tại
    speechQueue.unshift(text);
  } else {
    // Nếu có nhiều người cùng vào phòng, chỉ giữ tối đa 3 câu chào mới nhất để không bị trễ thời gian thực
    if (speechQueue.length >= 3) {
      speechQueue.splice(1, speechQueue.length - 2);
    }
    speechQueue.push(text);
  }

  processNextSpeech();
}

function processNextSpeech() {
  if (isSpeaking) return;
  if (speechQueue.length === 0) return;

  const text = speechQueue.shift();
  isSpeaking = true;
  setDuckMusic(true);

  // Gọi endpoint /api/tts lấy âm thanh Google Tiếng Việt (chị Google)
  const ttsUrl = `/api/tts?text=${encodeURIComponent(text)}`;
  const audio = new Audio(ttsUrl);
  audio.crossOrigin = 'anonymous';

  const ttsSpeed = (config.tts && typeof config.tts.speed === 'number') ? config.tts.speed : 1.05;
  audio.playbackRate = Math.max(0.8, Math.min(1.4, ttsSpeed));
  audio.volume = muted ? 0 : 1.0;

  const finish = () => {
    isSpeaking = false;
    setDuckMusic(false);
    currentTtsAudio = null;
    // Nghỉ nhẹ 200ms giữa các câu chào
    setTimeout(processNextSpeech, 200);
  };

  audio.onended = finish;
  audio.onerror = (err) => {
    console.warn('[TTS] Lỗi phát âm thanh Google TTS, thử fallback sang speechSynthesis:', err);
    try {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'vi-VN';
        u.onend = finish;
        u.onerror = finish;
        speechSynthesis.speak(u);
        return;
      }
    } catch (e) {}
    finish();
  };

  currentTtsAudio = audio;
  audio.play().catch((err) => {
    console.warn('[TTS] Audio play bị chặn do chưa tương tác màn hình:', err);
    finish();
  });
}

function speakBlessing(text) {
  speakSpeechQueue(text, 'high');
}

// ─── Feed & Toast Messages ─────────────────────────────────────────
function addFeedMessage(name, text, isGift = false, isMember = false) {
  // Đã tắt khung chat bên trái màn hình để không che chánh điện và tránh trùng lặp với cmt TikTok
}

function showToast(text) {
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove('show'), 4200);
}

// ─── Bảng Tấm Lòng Thành (Merit Leaderboard) ────────────────────────
function renderLeaderboard() {
  if (!boardEl || !boardListEl) return;
  const top = [...visitors]
    .filter(v => v.coins > 0)
    .sort((a, b) => b.coins - a.coins)
    .slice(0, 3);

  boardListEl.innerHTML = '';
  for (const v of top) {
    const li = document.createElement('li');
    li.textContent = v.name;
    const s = document.createElement('span');
    s.textContent = v.coins;
    li.appendChild(s);
    boardListEl.appendChild(li);
  }

  boardEl.hidden = top.length === 0;
}
renderLeaderboard();

// ─── Nghi Lễ Cúng Dường (Donation Handler) ─────────────────────────
const SUTRA_CHIC = [
  'Nam mô A Di Đà Phật',
  'Nam mô Bổn Sư Thích Ca Mâu Ni Phật',
  'Nam mô Đại Bi Quán Thế Âm Bồ Tát',
  'Nguyện cầu gia quyến an khang cát tường',
  'Cầu cho cha mẹ vạn sự bình an',
  'Nguyện đem công đức này hướng về tất cả chúng sinh'
];

function triggerDonation(v, coins, kind = 'lotus', text = '', prayer = '') {
  if (!v) return;
  v.coins += coins;
  v.glow = 1.0;
  v.bow = 1.0;

  const prayerBlessing = prayer || text || 'Cầu cho thân tâm an lạc, sở cầu như ý, vạn sự hanh thông.';

  // Hiển thị lời cầu an lên bong bóng thoại của phật tử
  v.speech = `🙏 ${prayerBlessing}`;
  v.speechTimer = 8.5;
  v.speechTotal = 8.5;

  const isBig = coins >= 20;

  // Hiệu ứng biểu tượng bay lên
  fx.push({
    kind: kind in ASSETS ? kind : 'lotus',
    x: v.seat.x,
    y: v.seat.y - 120 * v.seat.scale,
    t: 0,
    life: isBig ? 3.5 : 2.4,
    scale: v.seat.scale * (isBig ? 1.7 : 1.1)
  });

  // Cánh sen bay nhẹ từ vị trí phật tử
  const countPetals = isBig ? 18 : 6;
  for (let i = 0; i < countPetals; i++) {
    floaters.push({
      x: v.seat.x + (Math.random() - 0.5) * 160 * v.seat.scale,
      y: v.seat.y - 60,
      vx: (Math.random() - 0.5) * 35,
      vy: -(65 + Math.random() * 85),
      t: 0,
      life: 2.6 + Math.random(),
      s: 0.18 + Math.random() * 0.15
    });
  }

  // Quà lớn: Chuông đại hồng chung + mưa sen rực rỡ từ tòa sen Phật
  if (isBig) {
    bell(true);
    for (let i = 0; i < 28; i++) {
      floaters.push({
        x: SW / 2 + (Math.random() - 0.5) * 550,
        y: 320 + Math.random() * 250,
        vx: (Math.random() - 0.5) * 40,
        vy: 25 + Math.random() * 45,
        t: 0,
        life: 4.2,
        s: 0.22 + Math.random() * 0.16,
        down: true
      });
    }
  } else {
    mok(0.22);
  }

  const kindNames = {
    petal: 'Cánh sen',
    incense: 'Nén hương',
    lotus: 'Đóa sen',
    bell: 'Tiếng chuông vàng'
  };
  const label = kindNames[kind] || 'Lễ vật';

  addFeedMessage(v.name, `cúng dường ${label} ×${coins}` + (prayerBlessing ? ` · "${prayerBlessing}"` : ''), true);
  showToast(`📜 Cầu an cho ${v.name}: "${prayerBlessing}" 🙏`);
  if (config.tts?.enabledGift !== false) {
    const cleanDonor = cleanSpeakerName(v.name);
    speakBlessing(`Công đức phật tử ${cleanDonor} cúng dường ${label}. ${prayerBlessing}. Nam mô A Di Đà Phật.`);
  }
  renderLeaderboard();
}

// ─── Canvas Helper Functions ───────────────────────────────────────
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(rect.width * dpr);
  const h = Math.round(rect.height * dpr);

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  // Tỷ lệ thực tế của màn hình (ví dụ: iPhone 11 là ~2.164, TikTok 9:16 là ~1.777)
  const clientAspect = rect.height / Math.max(1, rect.width);
  const targetSH = Math.max(1920, Math.round(SW * clientAspect));

  if (Math.abs(targetSH - SH) > 10) {
    SH = targetSH;
    const existingTaken = visitors.map(v => ({ v, order: v.seat ? v.seat.order : null }));
    buildSeats();
    for (const item of existingTaken) {
      if (item.order !== null) {
        const newSeat = seats.find(s => s.order === item.order) || seats.find(s => !s.taken);
        if (newSeat) {
          newSeat.taken = item.v;
          item.v.seat = newSeat;
          if (item.v.state === 'sit') {
            item.v.x = newSeat.x;
            item.v.y = newSeat.y;
          }
        }
      }
    }
  }

  ctx.setTransform(w / SW, 0, 0, h / SH, 0, 0);
}

function drawSprite(img, x, y, s, anchorY = 1) {
  if (!img || !img.naturalWidth) return;
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  ctx.drawImage(img, x - w / 2, y - h * anchorY, w, h);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawNameTag(rawText, x, y, s, isTopOne = false, isDonor = false) {
  let text = String(rawText || 'Phật tử').trim();
  const maxLen = s < 0.34 ? 8 : (s < 0.44 ? 10 : 13);
  if (text.length > maxLen) {
    text = text.slice(0, maxLen - 1) + '…';
  }

  const fontSize = Math.max(10, Math.round(19 * s + 7));
  ctx.font = `600 ${fontSize}px "Noto Serif", Georgia, serif`;
  const textWidth = ctx.measureText(text).width;
  const padX = s < 0.34 ? (isTopOne ? 20 : 12) : (isTopOne ? 30 : 18);
  const w = textWidth + padX;
  const h = Math.max(15, Math.round(22 * s + 8));

  // Background pill với hiệu ứng bóng đổ nhẹ
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 4;
  ctx.fillStyle = isTopOne ? 'rgba(138, 42, 30, 0.94)' : isDonor ? 'rgba(40, 20, 10, 0.88)' : 'rgba(18, 10, 7, 0.72)';
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.restore();

  // Viền vàng kim
  if (isTopOne || isDonor) {
    ctx.strokeStyle = isTopOne ? 'rgba(255, 215, 0, 0.95)' : 'rgba(217, 164, 65, 0.85)';
    ctx.lineWidth = isTopOne ? 2.0 : 1.2;
    ctx.stroke();
  }

  // Biểu tượng vương miện cho Top 1
  if (isTopOne) {
    ctx.fillStyle = '#ffd700';
    ctx.font = `${Math.round(14 * s + 5)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('👑', x - w / 2 + 5, y);
  }

  ctx.fillStyle = isTopOne ? '#fff3dc' : '#f1e3c8';
  ctx.font = `600 ${fontSize}px "Noto Serif", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, isTopOne ? x + 7 : x, y + 1);
}

function drawSpeechBubble(text, x, y, s, timer = 5.5, total = 5.5, t = 0) {
  if (!text) return;

  const timeElapsed = Math.max(0, total - timer);
  // Hiệu ứng nảy pop-in trong 0.22s đầu tiên
  const pop = Math.min(1, timeElapsed / 0.22);
  // Hiệu ứng mờ dần trong 0.5s cuối cùng
  const alpha = timer < 0.5 ? Math.max(0, timer / 0.5) : 1;
  // Nhịp bồng bềnh nhẹ nhàng
  const floatY = Math.sin(t * 3.5 + x) * 2.5;

  ctx.save();
  ctx.translate(x, y + floatY);
  ctx.scale(pop, pop);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  ctx.font = `600 ${Math.round(20 * s + 8)}px "Be Vietnam Pro", system-ui, sans-serif`;

  const rawClean = String(text).trim();
  const maxW = Math.min(340, Math.max(160, 240 * s + 90));

  // Tự động xuống dòng nếu nội dung dài
  let lines = [];
  if (ctx.measureText(rawClean).width <= maxW - 24) {
    lines = [rawClean];
  } else {
    const words = rawClean.split(' ');
    let line1 = '', line2 = '';
    for (const w of words) {
      const test = line1 ? (line1 + ' ' + w) : w;
      if (ctx.measureText(test).width <= maxW - 24 && !line2) {
        line1 = test;
      } else {
        const test2 = line2 ? (line2 + ' ' + w) : w;
        if (ctx.measureText(test2).width <= maxW - 24) {
          line2 = test2;
        } else if (!line2.endsWith('…')) {
          line2 += '…';
        }
      }
    }
    lines = line2 ? [line1, line2] : [line1];
  }

  const lineHeight = Math.round(22 * s + 7);
  let contentWidth = 0;
  for (const l of lines) {
    contentWidth = Math.max(contentWidth, ctx.measureText(l).width);
  }

  const w = Math.max(80, contentWidth + 24);
  const h = lines.length * lineHeight + 16 * s + 8;

  // Đổ bóng nổi bật
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  // Thân bong bóng nền lụa ngà
  ctx.fillStyle = 'rgba(255, 253, 247, 0.96)';
  roundRect(ctx, -w / 2, -h / 2, w, h, 10);
  ctx.fill();

  // Viền vàng kim tinh tế
  ctx.strokeStyle = 'rgba(217, 164, 65, 0.88)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Tam giác nhọn trỏ xuống đầu Phật tử
  ctx.beginPath();
  ctx.moveTo(-7, h / 2 - 1);
  ctx.lineTo(7, h / 2 - 1);
  ctx.lineTo(0, h / 2 + 8 * s + 6);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 253, 247, 0.96)';
  ctx.fill();
  ctx.stroke();

  // Chữ nội dung bình luận
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#1c0f0a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (lines.length === 1) {
    ctx.fillText(lines[0], 0, 0);
  } else {
    ctx.fillText(lines[0], 0, -lineHeight / 2 + 1);
    ctx.fillText(lines[1], 0, lineHeight / 2 + 1);
  }

  ctx.restore();
}

// ─── Main Render Loop ──────────────────────────────────────────────
let lastTime = performance.now();

function render(now) {
  requestAnimationFrame(render);
  resizeCanvas();

  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  const t = now / 1000;

  ctx.clearRect(0, 0, SW, SH);

  // 1. Phông nền Chánh Điện Phật Vàng (hall.jpg)
  if (A.hall && A.hall.naturalWidth) {
    ctx.drawImage(A.hall, 0, 0, SW, 1920);
    if (SH > 1920) {
      // Kéo dài sàn gỗ chánh điện mượt mà xuống sát mép dưới màn hình (fit trọn iPhone 11)
      ctx.drawImage(A.hall, 0, 1750, 1080, 170, 0, 1920, SW, SH - 1920);
      const floorGrad = ctx.createLinearGradient(0, 1850, 0, SH);
      floorGrad.addColorStop(0, 'rgba(0,0,0,0)');
      floorGrad.addColorStop(1, 'rgba(10, 5, 3, 0.45)');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, 1850, SW, SH - 1850);
    }
  } else {
    ctx.fillStyle = '#1a0d08';
    ctx.fillRect(0, 0, SW, SH);
  }

  // 2. Hào Quang Tượng Phật (Pulsing halo on bell)
  haloPulse = Math.max(0, haloPulse - dt * 0.45);
  if (A.halo && A.halo.naturalWidth) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.22 + 0.08 * Math.sin(t * 1.2) + haloPulse * 0.5;
    drawSprite(A.halo, SW / 2, 520, 2.6 + haloPulse * 0.4, 0.5);
    ctx.restore();
  }

  // 3. Khói Hương Trầm Tự Nhiên
  ctx.save();
  ctx.fillStyle = '#e8dcc6';
  for (let i = 0; i < 14; i++) {
    const a = (t * 0.09 + i * 0.071) % 1;
    ctx.globalAlpha = 0.28 * (1 - a);
    ctx.beginPath();
    ctx.arc(SW / 2 + Math.sin(a * 7 + i) * 18 * a, 1000 - a * 260, 4 + a * 14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 4. Ánh Nến Lung Linh (Candle flicker warmth overlay)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.05 + 0.03 * Math.sin(t * 9) * Math.sin(t * 13.3);
  ctx.fillStyle = '#ffb347';
  ctx.fillRect(0, 300, SW, 900);
  ctx.restore();

  // 5. Xếp danh sách Phật tử từ sau ra trước theo tọa độ Y
  const sortedVisitors = [...visitors].sort((a, b) => a.y - b.y);

  // Tìm Top 1 để gắn vương miện
  const topOne = [...visitors].filter(v => v.coins > 0).sort((a, b) => b.coins - a.coins)[0] || null;

  // Hàng đợi bong bóng chat để vẽ lên lớp trên cùng (Overlay Pass)
  const activeBubbles = [];

  for (const v of sortedVisitors) {
    const anim = hasAnim(v.skin);

    // Xử lý chạy vào chánh điện / an tọa / fade_out
    if (v.state === 'running_in' || v.state === 'walk_to_seat' || v.state === 'walk') {
      if (!anim || !v.seat) {
        if (v.seat) { v.x = v.seat.x; v.y = v.seat.y; }
        v.state = 'sit';
      } else {
        const depth = Math.max(0, Math.min(1.4, (v.y - FLOOR.yTop) / Math.max(1, FLOOR.yBot - FLOOR.yTop)));
        const speed = (380 + 130 * depth) * dt;
        const dy = v.seat.y - v.y;
        const dx = v.seat.x - v.x;

        // Giai đoạn 1: Chạy từ cửa lên theo thảm đỏ giữa chánh điện
        if (Math.abs(dy) > 10) {
          v.y += Math.max(-speed, Math.min(speed, dy));
          v.x += (SW / 2 - v.x) * Math.min(1, dt * 10);
          v.flip = false;
        } else {
          // Giai đoạn 2: Rẽ ngang vào bồ đoàn
          v.y = v.seat.y;
          v.flip = dx < 0; // Quay mặt về phía bồ đoàn
          if (Math.abs(dx) <= Math.max(6, speed)) {
            v.x = v.seat.x;
            v.state = 'sitting';
            v.sitT = 0;
            v.flip = false;
          } else {
            v.x += Math.sign(dx) * speed;
          }
        }

        // Bước chân hoạt hình chạy nhanh thanh thoát
        v.ft += dt;
        if (v.ft > 0.10) {
          v.ft = 0;
          v.frame = (v.frame + 1) % 4;
        }
      }
    } else if (v.state === 'sitting') {
      v.sitT += dt;
      v.frame = 4 + Math.min(3, Math.floor(v.sitT / 0.13)); // Ngồi xuống thanh thoát trong ~0.4s
      if (v.sitT > 0.4) {
        v.state = 'sit';
        v.frame = 7;
      }
    } else if (v.state === 'sit') {
      // Phật tử ngồi thiền tĩnh lặng - chỉ rời đi khi bị thay thế bởi người mới (fade_out)
      if (v.stayTimer > 0) {
        v.stayTimer -= dt;
      }
    } else if (v.state === 'standing') {
      v.standT += dt;
      v.frame = Math.max(4, 7 - Math.floor(v.standT / 0.14)); // Đảo ngược động tác ngồi để đứng dậy
      if (v.standT > 0.5) {
        // Nhường bồ đoàn cho người khác ngay khi đứng dậy
        if (v.seat && v.seat.taken === v) {
          v.seat.taken = null;
          v.seat = null;
        }
        v.state = 'walk_out';
        v.frame = 0;
        v.ft = 0;
      }
    } else if (v.state === 'walk_out') {
      const depth = Math.max(0, Math.min(1.4, (v.y - FLOOR.yTop) / Math.max(1, FLOOR.yBot - FLOOR.yTop)));
      const speed = (200 + 160 * depth) * dt;
      const dx = (SW / 2) - v.x;

      if (Math.abs(dx) > 6) {
        v.x += Math.sign(dx) * Math.min(Math.abs(dx), speed);
        v.flip = dx < 0; // quay mặt về lối đi giữa
      } else {
        // Đi dọc lối giữa xuống cửa
        v.x = SW / 2;
        v.flip = false;
        v.y += speed * 1.25;
        if (v.y > (FLOOR.yBot - 50)) {
          v.fade = Math.max(0, v.fade - dt * 2.2);
        }
      }

      v.ft += dt;
      if (v.ft > 0.14) {
        v.ft = 0;
        v.frame = (v.frame + 1) % 4; // bước chân
      }

      if (v.y >= (SH + 80) || v.fade <= 0) {
        removeVisitor(v);
        continue;
      }
    } else if (v.state === 'fade_out') {
      v.fade = Math.max(0, v.fade - dt * (v.fadeSpeed || 2.5));
      if (v.fade <= 0) {
        removeVisitor(v);
        continue;
      }
    }

    if (v.state !== 'fade_out') {
      v.fade = Math.min(1, v.fade + dt * 3);
    }
    const depthScale = Math.max(0, Math.min(1.4, (v.y - FLOOR.yTop) / Math.max(1, FLOOR.yBot - FLOOR.yTop)));
    const sc = (v.state === 'running_in' || v.state === 'walk' || v.state === 'walk_to_seat' || v.state === 'walk_out' || !v.seat)
      ? (0.19 + 0.31 * depthScale)
      : v.seat.scale;
    const s = Math.max(0.18, Math.min(0.68, sc));

    v.bow = Math.max(0, v.bow - dt * 0.7);
    v.glow = Math.max(0, v.glow - dt * 0.5);

    // Nhịp thở thiền định nhẹ nhàng
    const breathe = v.state !== 'sit' ? 0 : Math.sin(t * 1.1 + v.phase) * 2 * s;

    // Quầng sáng hào quang kim sắc khi cúng dường
    if (v.glow > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = v.glow * 0.7;
      const radGrad = ctx.createRadialGradient(v.x, v.y - 90 * s, 10, v.x, v.y - 90 * s, 170 * s);
      radGrad.addColorStop(0, 'rgba(255, 215, 110, 0.95)');
      radGrad.addColorStop(1, 'rgba(255, 160, 60, 0)');
      ctx.fillStyle = radGrad;
      ctx.fillRect(v.x - 200 * s, v.y - 300 * s, 400 * s, 340 * s);
      ctx.restore();
    }

    // Hiệu ứng cúi đầu lễ Phật (bow)
    const bowSquash = v.state === 'sit' ? Math.sin(Math.min(1, v.bow) * Math.PI) * 0.04 : 0;

    ctx.save();
    ctx.globalAlpha = v.fade;
    ctx.translate(v.x, v.y);
    if (bowSquash > 0) {
      ctx.transform(1, 0, 0, 1 - bowSquash, 0, 0);
    }

    let tagH;
    if (anim) {
      const a = ANIM[v.skin];
      const k = s * 1.05 * 260 / a.seatH;
      if (v.flip) ctx.scale(-1, 1);
      ctx.drawImage(
        A['anim_' + v.skin],
        v.frame * a.fw, 0, a.fw, a.fh,
        -a.fw * k / 2, -a.fh * k + breathe, a.fw * k, a.fh * k
      );
      tagH = (v.state === 'sit' ? a.seatH : a.fh * 0.97) * k;
    } else {
      const spriteImg = A[v.skin] || A.man;
      drawSprite(spriteImg, 0, breathe, s * 1.05, 1);
      tagH = 268 * s;
    }
    ctx.restore();

    // Thẻ tên Phật tử
    const isTopOne = topOne && topOne === v;
    const isDonor = v.coins > 0;
    const tagY = v.y - tagH - 12 * s;
    drawNameTag(v.name, v.x, tagY, s, isTopOne, isDonor);

    // Gom bong bóng chat để vẽ lên lớp trên cùng (Overlay Pass)
    if (v.speech && v.speechTimer > 0) {
      v.speechTimer -= dt;
      activeBubbles.push({
        text: v.speech,
        x: v.x,
        y: tagY - 24 * s - 18,
        s: s,
        timer: v.speechTimer,
        total: v.speechTotal || 5.5
      });
      if (v.speechTimer <= 0) v.speech = null;
    }
  }

  // 6. Vẽ toàn bộ bong bóng chat lên lớp trên cùng để không bị nhân vật khác che khuất
  for (const b of activeBubbles) {
    drawSpeechBubble(b.text, b.x, b.y, b.s, b.timer, b.total, t);
  }

  // 7. Hiệu ứng quà tặng bay lên (FX icons)
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.t += dt;
    const progress = f.t / f.life;
    if (progress >= 1) {
      fx.splice(i, 1);
      continue;
    }
    const img = A[f.kind] || A.lotus;
    const pop = Math.min(1, f.t * 4);
    const ease = 1 - Math.pow(1 - pop, 3);

    ctx.save();
    ctx.globalAlpha = progress < 0.75 ? 1 : (1 - progress) / 0.25;
    drawSprite(img, f.x, f.y - progress * 160, f.scale * (0.6 + 0.4 * ease) * 0.9, 1);
    ctx.restore();
  }

  // 7. Cánh sen bay nhẹ trong không gian
  for (let i = floaters.length - 1; i >= 0; i--) {
    const p = floaters[i];
    p.t += dt;
    if (p.t > p.life) {
      floaters.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt + Math.sin(p.t * 3 + i) * 20 * dt;
    p.y += p.vy * dt;

    ctx.save();
    ctx.globalAlpha = Math.min(1, (p.life - p.t));
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(p.t * 2 + i) * 0.6);
    drawSprite(A.petal, 0, 0, p.s, 0.5);
    ctx.restore();
  }

  // 8. Tự động thêm Phật tử ảo định kỳ (chỉ chạy khi BẬT tính năng Bot)
  if (config.bot && config.bot.enabled) {
    botSpawnTimer += dt;
    const maxBots = config.bot.maxBots || 10;
    const currentBots = visitors.filter(v => v.isBot).length;
    if (botSpawnTimer > 12 && currentBots < maxBots && freeSeat()) {
      botSpawnTimer = 0;
      spawnRandomBot();
    }
  }
}
requestAnimationFrame(render);

// ─── Socket.IO Real-time Events ────────────────────────────────────
socket.on('init_state', (data) => {
  if (data.config) {
    config = data.config;
    if (config.temple?.name && templeNameEl) templeNameEl.textContent = config.temple.name;
    if (config.temple?.subTitle && monkStatusEl) monkStatusEl.textContent = '· ' + config.temple.subTitle;
    if (config.currentBackground) {
      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      bgImg.src = config.currentBackground;
      bgImg.onload = () => { A.hall = bgImg; };
    }
  }
  if (data.username) {
    currentUsername = data.username;
    if (liveChannelEl) liveChannelEl.textContent = '@' + currentUsername;
  }
  if (data.liveStats) {
    liveStats = { ...liveStats, ...data.liveStats };
    if (totalPointsEl) totalPointsEl.textContent = liveStats.totalPoints || 0;
    updateCountUI();
  }
});

socket.on('tiktok_status', (data) => {
  if (data.username) {
    currentUsername = data.username;
    if (liveChannelEl) liveChannelEl.textContent = '@' + currentUsername;
  }
  const livePill = document.getElementById('livePill');
  if (livePill) {
    const isConn = data.status === 'connected';
    livePill.style.borderColor = isConn ? '#27ae60' : 'rgba(217, 164, 65, 0.42)';
  }
});

socket.on('room_info_updated', (info) => {
  if (info) {
    liveStats = { ...liveStats, ...info };
    if (totalPointsEl && info.totalPoints !== undefined) totalPointsEl.textContent = info.totalPoints;
    updateCountUI();
  }
});

socket.on('viewer_count_updated', (data) => {
  if (data && typeof data.viewers === 'number') {
    liveStats.viewers = data.viewers;
    updateCountUI();
  }
});

socket.on('config_updated', (newConfig) => {
  if (newConfig) {
    config = newConfig;
    if (config.temple?.name && templeNameEl) templeNameEl.textContent = config.temple.name;
    if (config.temple?.subTitle && monkStatusEl) monkStatusEl.textContent = '· ' + config.temple.subTitle;
    if (config.currentBackground) {
      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      bgImg.src = config.currentBackground;
      bgImg.onload = () => { A.hall = bgImg; };
    }
  }
});

socket.on('bot_updated', (botConfig) => {
  if (!config.bot) config.bot = {};
  config.bot = { ...config.bot, ...botConfig };
  if (!config.bot.enabled) {
    // Khi TẮT bot, cho toàn bộ Phật tử ảo đứng dậy ra về một cách trang nghiêm
    visitors.filter(v => v.isBot).forEach((b, i) => {
      setTimeout(() => startVisitorExit(b), i * 350);
    });
  }
});

socket.on('clear_all_visitors', () => {
  visitors.forEach((v, i) => {
    setTimeout(() => startVisitorExit(v), i * 200);
  });
});

socket.on('visitor_leave_requested', (data) => {
  let target = null;
  if (data && (data.name || data.id)) {
    target = visitors.find(v => (data.id && v.id === data.id) || (data.name && v.name === data.name));
  }
  if (!target) {
    target = visitors
      .filter(v => v.coins === 0 && (v.state === 'sit' || v.state === 'sitting'))
      .sort((a, b) => a.stayTimer - b.stayTimer)[0] || visitors[0];
  }
  if (target) startVisitorExit(target);
});

socket.on('tiktok_member', (data) => {
  const user = data.user || {};
  const name = user.nickname || user.name || user.uniqueId || 'Phật tử';

  let v = findVisitor(user);
  if (!v) {
    // Phật tử bước từ lối đi giữa vào bồ đoàn trong ~0.7s
    v = addVisitor(user, SKINS[Math.floor(Math.random() * SKINS.length)], false, user.id, false);
  } else {
    v.stayTimer = Math.max(v.stayTimer, (config.bot?.stayDurationSec || 60) * 1.5);
    v.bow = 0.6;
  }

  showToast(`Hoan nghênh ${name} vào chánh điện 🙏`);

  // Đọc tên người vào live bằng giọng nói AI tiếng Việt (Google TTS)
  if (config.tts?.enabledMember !== false) {
    const cleanName = cleanSpeakerName(name);
    const template = config.tts?.memberTemplate || 'Hoan nghênh {name} vào chánh điện';
    const speechText = template.replace('{name}', cleanName);
    speakSpeechQueue(speechText, 'normal');
  }
});

socket.on('tiktok_chat', (data) => {
  const user = data.user || {};
  const name = user.nickname || user.name || user.uniqueId || 'Phật tử';
  const rawComment = (data.comment || '').trim();
  const comment = rawComment || '🙏';

  let v = findVisitor(user);
  // Nếu là sự kiện test mô phỏng mà chưa khớp đúng ID, ưu tiên hiển thị lên 1 Phật tử đang an tọa
  if (!v && user.id && String(user.id).startsWith('sim_') && visitors.length > 0) {
    v = visitors.find(vis => vis.state === 'sit' || vis.state === 'sitting') || visitors[0];
  }

  if (!v) {
    // Phật tử mới bình luận chạy ngay vào chánh điện!
    v = addVisitor(user, null, false, user.id, false);
  }

  if (v) {
    v.bow = 1.0;
    v.speech = comment;
    v.speechTimer = 6.0; // Hiện bong bóng chat nổi bật trong 6.0 giây
    v.speechTotal = 6.0;
  }

  // Tiếng mõ thanh tịnh nếu bình luận niệm Phật
  if (/a di đà|thích ca|quán thế âm|mô phật|nam mô/i.test(comment)) {
    mok(0.22);
  }
});

socket.on('tiktok_like', (data) => {
  if (data.totalLikes) liveStats.likes = data.totalLikes;
  haloPulse = Math.min(1.0, haloPulse + 0.08);

  const user = data.user;
  if (user && (user.name || user.nickname || user.uniqueId || user.id)) {
    let v = findVisitor(user);
    if (!v) {
      // Người thả tim chạy ngay vào chánh điện!
      v = addVisitor(user, null, false, user.id, false);
    } else {
      v.bow = Math.max(v.bow, 0.4);
    }
  }

  // Thả cánh hoa sen nhỏ từ tượng Phật
  floaters.push({
    x: SW / 2 + (Math.random() - 0.5) * 200,
    y: 600,
    vx: (Math.random() - 0.5) * 30,
    vy: -(40 + Math.random() * 40),
    t: 0,
    life: 2.2,
    s: 0.14
  });
});

socket.on('tiktok_follow', (data) => {
  const user = data.user || {};
  const name = user.nickname || user.name || user.uniqueId || 'Phật tử';

  let v = findVisitor(user);
  if (!v) {
    v = addVisitor(user, SKINS[Math.floor(Math.random() * SKINS.length)], true, user.id, false);
  }
  if (v) {
    v.glow = 0.8;
    v.bow = 1.0;
    v.stayTimer = Math.max(v.stayTimer, 90);
  }

  showToast(`🙏 Tri ân ${name} vừa theo dõi kênh`);
  bell(false);
});

socket.on('gift_triggered', (data) => {
  const user = data.user || {};
  const name = user.nickname || user.name || user.uniqueId || 'Phật tử';
  const gift = data.gift || {};
  const repeatCount = data.repeatCount || 1;
  const points = data.points || 1;

  if (data.totalPoints !== undefined && totalPointsEl) {
    liveStats.totalPoints = data.totalPoints;
    totalPointsEl.textContent = data.totalPoints;
  }

  let v = findVisitor(user);
  if (!v) {
    v = addVisitor(user, SKINS[Math.floor(Math.random() * SKINS.length)], true, user.id, false);
  }
  if (v) {
    if (v.seat && (v.state === 'walk' || v.state === 'walk_to_seat')) {
      v.x = v.seat.x;
      v.y = v.seat.y;
      v.state = 'sit';
    }
    v.stayTimer = Math.max(v.stayTimer, 240);
  }

  // Ánh xạ quà tặng sang loại biểu tượng
  const actionType = (gift.actionType || 'lotus').toLowerCase();
  let fxKind = 'lotus';
  if (actionType.includes('incense') || actionType.includes('hương')) fxKind = 'incense';
  else if (actionType.includes('bell') || actionType.includes('chuông')) fxKind = 'bell';
  else if (actionType.includes('petal') || actionType.includes('hoa') || actionType.includes('rose')) fxKind = 'petal';

  const prayerText = data.prayer || SUTRA_CHIC[Math.floor(Math.random() * SUTRA_CHIC.length)];
  triggerDonation(v, points, fxKind, prayerText, data.prayer);
});

// ─── Lời Thoại Thầy Trụ Trì Từ Admin ──────────────────────────────
const masterSpeechCard = document.getElementById('masterSpeechCard');
const masterSpeechAuthor = document.getElementById('masterSpeechAuthor');
const masterSpeechText = document.getElementById('masterSpeechText');

function showMasterSpeech(speaker, text) {
  if (!masterSpeechCard || !masterSpeechText) return;
  if (masterSpeechAuthor) masterSpeechAuthor.textContent = speaker || 'Thầy Trụ Trì';
  masterSpeechText.textContent = text;
  masterSpeechCard.removeAttribute('hidden');
  masterSpeechCard.classList.add('show');

  clearTimeout(showMasterSpeech._t);
  showMasterSpeech._t = setTimeout(() => {
    masterSpeechCard.classList.remove('show');
    setTimeout(() => masterSpeechCard.setAttribute('hidden', ''), 400);
  }, 9500);
}

socket.on('admin_speech', (data) => {
  const text = (data.text || '').trim();
  const speaker = (data.speakerName || 'Thầy Trụ Trì').trim();
  if (!text) return;

  console.log(`[Admin Thoại] 📢 ${speaker}: "${text}"`);
  showMasterSpeech(speaker, text);
  speakSpeechQueue(text, 'high');
  bell(false);
});

// ─── Đổi Nhạc Đang Phát Từ Admin ─────────────────────────────────
socket.on('change_music', (data) => {
  if (!data || !data.url) return;
  console.log('[Music] 🎶 Đổi bài nhạc:', data.name, data.url);
  showToast(`🎵 Đang phát: ${data.name}`);
  if (audioStarted) {
    playMusicByUrl(data.url, data.name);
  } else {
    TRACKS[0] = { src: data.url, name: data.name };
  }
});

// ─── Nạp Phật Tử Hàng Loạt Vào Chánh Điện (Fetch Thủ Công) ────────
socket.on('load_bulk_devotees', (data) => {
  const viewers = data.viewers || [];
  if (!Array.isArray(viewers) || viewers.length === 0) return;

  let added = 0;
  viewers.forEach((u, i) => {
    let v = findVisitor(u);
    if (!v) {
      const skin = SKINS[i % SKINS.length];
      v = addVisitor(u, skin, true, u.id || ('bulk_' + i), false);
      if (v && v.seat) {
        v.x = v.seat.x;
        v.y = v.seat.y;
        v.state = 'sit';
        v.stayTimer = 180 + Math.random() * 120;
        added++;
      }
    }
  });

  showToast(`🙏 Đã cung thỉnh ${added} phật tử vào Chánh Điện trang nghiêm!`);
  bell(false);
});

// ─── Đổi Template Background Chánh Điện Tức Thì ───────────────────
socket.on('change_background', (data) => {
  if (!data || !data.backgroundUrl) return;
  console.log('[Template] 🖼️ Nhận lệnh đổi nền Chánh Điện:', data.name, data.backgroundUrl);
  const newImg = new Image();
  newImg.crossOrigin = 'anonymous';
  newImg.src = data.backgroundUrl + '?v=' + Date.now();
  newImg.onload = () => {
    A.hall = newImg;
    showToast(`🎨 Chuyển cảnh: ${data.name}`);
    bell(false);
  };
});

socket.on('tiktok_share', (data) => {
  const user = data.user || {};
  const name = user.nickname || user.name || user.uniqueId || 'Phật tử';

  let v = findVisitor(user);
  if (!v) {
    v = addVisitor(user, SKINS[Math.floor(Math.random() * SKINS.length)], true, user.id, false);
  }
  if (v) {
    v.glow = 1.0;
    v.bow = 1.0;
    v.stayTimer = Math.max(v.stayTimer, 90);
  }

  showToast(`✨ Tri ân ${name} vừa chia sẻ buổi lễ`);
  haloPulse = Math.min(1.0, haloPulse + 0.2);
});

socket.on('goal_reached', (data) => {
  bell(true);
  showToast(`🎉 CHÚC MỪNG: ĐẠT MỤC TIÊU ${data.type?.toUpperCase()}!`);
  speakBlessing(`Nguyện đem công đức vô lượng này hồi hướng khắp mười phương chúng sinh.`);
  for (let i = 0; i < 35; i++) {
    floaters.push({
      x: SW / 2 + (Math.random() - 0.5) * 600,
      y: 200 + Math.random() * 400,
      vx: (Math.random() - 0.5) * 50,
      vy: 30 + Math.random() * 50,
      t: 0,
      life: 5.0,
      s: 0.22 + Math.random() * 0.16,
      down: true
    });
  }
});

// ─── UI Interactions ───────────────────────────────────────────────
btnStartAudio?.addEventListener('click', () => {
  startAudioEngine();
});

audioGate?.addEventListener('click', () => {
  startAudioEngine();
});

btnMute?.addEventListener('click', () => {
  muted = !muted;
  if (masterGain && AC) {
    masterGain.gain.value = muted ? 0 : 0.8;
  }
  btnMute.textContent = muted ? '🔇 Đã tắt âm' : '🔊 Âm thanh';
  btnMute.setAttribute('aria-pressed', muted);
});

btnNextTrack?.addEventListener('click', () => {
  if (AC) playMusicTrack(trackIdx + 1);
});

// Nhấp vào canvas: gõ mõ và niệm Phật
canvas.addEventListener('pointerdown', (e) => {
  if (!audioStarted) {
    startAudioEngine();
    return;
  }
  mok(0.24);
  const prayer = SUTRA_CHIC[Math.floor(Math.random() * SUTRA_CHIC.length)];
  addFeedMessage('Chánh Điện', prayer);

  // Hiệu ứng hoa sen dâng lên từ bàn thờ
  floaters.push({
    x: SW / 2 + (Math.random() - 0.5) * 120,
    y: 1100,
    vx: (Math.random() - 0.5) * 20,
    vy: -60,
    t: 0,
    life: 2.2,
    s: 0.16
  });
});

// Tự động gõ mõ định kỳ nhịp nhàng khi livestream
setInterval(() => {
  if (visitors.length > 2 && Math.random() < 0.25) {
    const v = visitors[Math.floor(Math.random() * visitors.length)];
    if (v && v.state === 'sit') {
      v.bow = 0.8;
      mok(0.1);
    }
  }
}, 4500);

})();
