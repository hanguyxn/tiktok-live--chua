/* ========================================================
   CHÙA ONLINE - TIKTOK LIVE INTERACTIVE OVERLAY SCRIPT
   Xử lý Socket, Web Audio API, Canvas Khói Hương, Hiệu Ứng Quà
   ======================================================== */

// Khởi tạo AudioContext cho Web Audio API (Chân thực 100%, không cần file âm thanh ngoài)
let audioCtx = null;
let soundEnabled = true;

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// 1. ÂM THANH MÕ GỖ TỤNG KINH (Wooden Fish Sound)
function playMoSound() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;

  // Tạo Oscillator chính
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  // Tần số cộng hưởng đặc trưng của mõ gỗ: ~780Hz - 880Hz
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(840, now);
  osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);

  // Bộ lọc Bandpass tạo độ đanh và rỗng của thân gỗ
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(820, now);
  filter.Q.setValueAtTime(4.5, now);

  // Âm lượng gõ: đanh ở đầu, ngắt nhanh
  gain.gain.setValueAtTime(0.7, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.12);
}

// 2. ÂM THANH ĐẠI HỒNG CHUNG (Ngân nga 4-6 giây)
function playBellSound() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const frequencies = [216, 432, 648, 864, 1180, 1540];
  const gains = [0.6, 0.4, 0.3, 0.2, 0.15, 0.08];

  frequencies.forEach((freq, idx) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    // Hơi lệch pha một chút tạo độ vang tự nhiên
    osc.frequency.setValueAtTime(freq + (Math.random() * 2 - 1), now);

    const decayTime = 4.5 - (idx * 0.4);
    gain.gain.setValueAtTime(gains[idx], now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(1.5, decayTime));

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + decayTime);
  });
}

// 3. ÂM THANH NƯỚC CHẢY / PHÓNG SINH CÁ CHÉP
function playWaterSplash() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.5);

  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.6);
}

// 4. ÂM THANH RỒNG VÀNG GẦM VANG / GIÓ THIÊNG
function playDragonRoar() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.linearRampToValueAtTime(180, now + 0.6);
  osc.frequency.exponentialRampToValueAtTime(45, now + 2.0);

  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.5, now + 0.5);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 2.2);
}

// 5. ÂM THANH MƯA VÀNG / CHIME TIỀN RƠI
function playCoinShowerSound() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;

  const chords = [1046.5, 1318.5, 1567.98, 2093.0];
  chords.forEach((note, i) => {
    setTimeout(() => {
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.8);
    }, i * 140);
  });
}

// ========================================================
// HỆ THỐNG CANVAS VẼ KHÓI HƯƠNG & HẠT BỤI VÀNG CÁT TƯỜNG
// ========================================================

const canvas = document.getElementById('effects-canvas');
const ctx = canvas.getContext('2d');
let smokeParticles = [];
let goldSparks = [];

function resizeCanvas() {
  const container = document.getElementById('stream-container');
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class SmokeParticle {
  constructor(x, y) {
    this.x = x + (Math.random() * 20 - 10);
    this.y = y;
    this.vx = (Math.random() - 0.5) * 0.6;
    this.vy = -(Math.random() * 1.5 + 0.8);
    this.radius = Math.random() * 6 + 4;
    this.maxRadius = this.radius * 7;
    this.alpha = 0.55;
    this.decay = Math.random() * 0.003 + 0.003;
    this.swing = Math.random() * 2;
    this.time = Math.random() * 100;
  }

  update() {
    this.time += 0.03;
    this.x += this.vx + Math.sin(this.time) * 0.4;
    this.y += this.vy;
    this.radius += (this.maxRadius - this.radius) * 0.015;
    this.alpha -= this.decay;
  }

  draw(context) {
    if (this.alpha <= 0) return;
    context.save();
    context.beginPath();
    const grad = context.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
    grad.addColorStop(0, `rgba(255, 248, 220, ${this.alpha * 0.7})`);
    grad.addColorStop(0.5, `rgba(200, 190, 175, ${this.alpha * 0.4})`);
    grad.addColorStop(1, 'rgba(150, 140, 130, 0)');
    context.fillStyle = grad;
    context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

class GoldSpark {
  constructor(w, h) {
    this.reset(w, h, true);
  }

  reset(w, h, randomY = false) {
    this.x = Math.random() * w;
    this.y = randomY ? Math.random() * h : h + 10;
    this.vy = -(Math.random() * 0.8 + 0.3);
    this.vx = (Math.random() - 0.5) * 0.4;
    this.radius = Math.random() * 2.5 + 1;
    this.alpha = Math.random() * 0.7 + 0.3;
  }

  update(w, h) {
    this.y += this.vy;
    this.x += this.vx;
    if (this.y < -10) this.reset(w, h);
  }

  draw(context) {
    context.save();
    context.beginPath();
    context.fillStyle = `rgba(255, 215, 0, ${this.alpha})`;
    context.shadowColor = '#ffd700';
    context.shadowBlur = 6;
    context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

// Khởi tạo hạt vàng bay lơ lửng
for (let i = 0; i < 40; i++) {
  goldSparks.push(new GoldSpark(canvas.width, canvas.height));
}

// Tọa độ đỉnh lư hương
function getIncenseSourcePos() {
  const container = document.getElementById('stream-container');
  const scale = container.clientWidth / 1080;
  return {
    x: container.clientWidth / 2,
    y: 650 * scale
  };
}

let smokeIntensity = 1;
function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Sinh khói hương từ lư đồng
  const pos = getIncenseSourcePos();
  for (let i = 0; i < smokeIntensity; i++) {
    if (Math.random() > 0.3) {
      smokeParticles.push(new SmokeParticle(pos.x, pos.y));
    }
  }

  // Cập nhật khói
  for (let i = smokeParticles.length - 1; i >= 0; i--) {
    const p = smokeParticles[i];
    p.update();
    p.draw(ctx);
    if (p.alpha <= 0) {
      smokeParticles.splice(i, 1);
    }
  }

  // Cập nhật hạt bụi vàng
  goldSparks.forEach(s => {
    s.update(canvas.width, canvas.height);
    s.draw(ctx);
  });

  requestAnimationFrame(animateParticles);
}
requestAnimationFrame(animateParticles);

// ========================================================
// SƯ THẦY DẪN LỄ & GÕ MÕ TỤNG KINH ĐỀU ĐẶN
// ========================================================

const monkArm = document.getElementById('monk-arm');
const moRing = document.getElementById('mo-ring');
const monkBubble = document.getElementById('monk-bubble');

const buddhistQuotes = [
  'A Di Đà Phật 🙏',
  'Tâm thành tất ứng ✨',
  'Vạn sự cát tường 🪷',
  'Công đức vô lượng ✦',
  'Bình an hỷ xả 🌸',
  'Nguyện độ chúng sinh 🕊️'
];

let quoteIndex = 0;
function monkChantStep() {
  // Đánh mõ
  if (monkArm) monkArm.classList.add('strike');
  if (moRing) {
    moRing.classList.remove('pulse');
    void moRing.offsetWidth; // trigger reflow
    moRing.classList.add('pulse');
  }

  playMoSound();

  setTimeout(() => {
    if (monkArm) monkArm.classList.remove('strike');
  }, 120);
}

// Gõ mõ lặp đi lặp lại mỗi 2.2 giây
setInterval(monkChantStep, 2200);

// Thay đổi lời dạy của sư thầy mỗi 8 giây
setInterval(() => {
  quoteIndex = (quoteIndex + 1) % buddhistQuotes.length;
  if (monkBubble) {
    monkBubble.textContent = buddhistQuotes[quoteIndex];
  }
}, 8000);

// ========================================================
// HỆ THỐNG PHẬT TỬ NGỒI LỄ (AVATARS & BỒ ĐOÀN)
// ========================================================

const devoteesLeft = document.getElementById('devotees-left');
const devoteesRight = document.getElementById('devotees-right');

const avatarIcons = [
  '🐼', '🦊', '🐱', '🐶', '🐰', '🐯', '👧', '👦', '🧑‍🦰', '🧑‍🦱',
  '🧑‍🦳', '🧕', '🧔', '🦁', '🐨', '🐵', '🐸', '🦄', '🐣', '🐻'
];

const initialDevotees = [
  { name: 'pk', nickname: 'Phật tử PK', icon: '🐼' },
  { name: 'a.', nickname: 'Diệu Thiện', icon: '👧' },
  { name: 'H.V. Thịnh', nickname: 'Thịnh Vượng', icon: '👦' },
  { name: 'Thùy Trinh', nickname: 'Bảo Trinh', icon: '🧕' },
  { name: 'van anh', nickname: 'Vân Anh', icon: '🐰' },
  { name: 'Hương Sen', nickname: 'Hương Sen', icon: '🌸' },
  { name: 'Minh Tuệ', nickname: 'Minh Tuệ', icon: '🦊' },
  { name: 'Quang Khải', nickname: 'Quang Khải', icon: '🦁' },
  { name: 'Thanh Nhã', nickname: 'Thanh Nhã', icon: '🐱' },
  { name: 'Bảo Long', nickname: 'Bảo Long', icon: '🐶' },
  { name: 'Phước Lộc', nickname: 'Phước Lộc', icon: '🐻' },
  { name: 'Diệu Hạnh', nickname: 'Diệu Hạnh', icon: '🐨' }
];

let seatedDevotees = new Map();

function createDevoteeElement(user) {
  const seat = document.createElement('div');
  seat.className = 'devotee-seat';
  seat.id = `devotee-${user.name.replace(/[^a-zA-Z0-9]/g, '_')}`;

  const icon = user.icon || avatarIcons[Math.floor(Math.random() * avatarIcons.length)];

  seat.innerHTML = `
    <div class="cushion-mat"></div>
    <div class="devotee-avatar">${icon}</div>
    <div class="devotee-name">${user.nickname || user.name}</div>
  `;

  return seat;
}

function initializeDevotees() {
  initialDevotees.forEach((devotee, index) => {
    const seat = createDevoteeElement(devotee);
    if (index % 2 === 0) {
      devoteesLeft.appendChild(seat);
    } else {
      devoteesRight.appendChild(seat);
    }
    seatedDevotees.set(devotee.name.toLowerCase(), seat);
  });
}
initializeDevotees();

// Thêm phật tử mới vào chỗ ngồi
function addOrFindDevotee(user) {
  const key = (user.name || '').toLowerCase();
  if (seatedDevotees.has(key)) {
    return seatedDevotees.get(key);
  }

  const seat = createDevoteeElement(user);
  const leftCount = devoteesLeft.children.length;
  const rightCount = devoteesRight.children.length;

  if (leftCount <= rightCount) {
    devoteesLeft.appendChild(seat);
  } else {
    devoteesRight.appendChild(seat);
  }

  seatedDevotees.set(key, seat);

  // Cập nhật tổng số phật tử
  const totalDevoteesElem = document.getElementById('ui-devotees-count');
  if (totalDevoteesElem) {
    totalDevoteesElem.textContent = seatedDevotees.size + 95;
  }

  return seat;
}

// Hiện bong bóng chat trên đầu phật tử
function showDevoteeSpeech(user, comment) {
  const seat = addOrFindDevotee(user);
  if (!seat) return;

  const existingBubble = seat.querySelector('.devotee-speech');
  if (existingBubble) existingBubble.remove();

  const bubble = document.createElement('div');
  bubble.className = 'devotee-speech';
  bubble.textContent = comment;
  seat.appendChild(bubble);

  setTimeout(() => {
    bubble.remove();
  }, 4000);
}

// ========================================================
// CÁC HIỆU ỨNG TƯƠNG TÁC QUÀ TẶNG ĐỈNH CAO
// ========================================================

const greatBell = document.getElementById('great-bell');
const bellSoundwave = document.getElementById('bell-soundwave');
const bellMallet = document.getElementById('bell-mallet');
const fruitTray = document.getElementById('fruit-tray');
const buddhaStatue = document.getElementById('buddha-statue');
const dragonContainer = document.getElementById('dragon-container');
const carpContainer = document.getElementById('carp-container');
const lanternContainer = document.getElementById('lantern-container');
const goldRainContainer = document.getElementById('gold-rain-container');
const toastContainer = document.getElementById('gift-toast-container');

// 1. Thắp Nén Hương
function triggerIncenseEffect() {
  smokeIntensity = 6;
  const sticks = document.querySelectorAll('.incense-sticks .stick');
  sticks.forEach(s => s.classList.add('glowing'));

  setTimeout(() => {
    smokeIntensity = 1;
  }, 5000);
}

// 2. Thắp Nến Hoa Sen
function triggerCandleEffect() {
  const flames = [document.getElementById('flame-left'), document.getElementById('flame-right')];
  flames.forEach(f => {
    if (f) {
      f.style.transform = 'translateX(-50%) scale(1.6)';
      f.style.filter = 'drop-shadow(0 0 25px #ff7700) drop-shadow(0 0 40px #ffbb00)';
    }
  });

  setTimeout(() => {
    flames.forEach(f => {
      if (f) {
        f.style.transform = '';
        f.style.filter = '';
      }
    });
  }, 4000);
}

// 3. Dâng Hoa Sen
function triggerLotusEffect() {
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const lotus = document.createElement('div');
      lotus.style.position = 'absolute';
      lotus.style.fontSize = '45px';
      lotus.style.left = (350 + Math.random() * 380) + 'px';
      lotus.style.bottom = '150px';
      lotus.style.zIndex = '14';
      lotus.style.filter = 'drop-shadow(0 0 15px #ff80aa)';
      lotus.style.transition = 'all 3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      lotus.textContent = '🪷';
      document.getElementById('stream-container').appendChild(lotus);

      requestAnimationFrame(() => {
        lotus.style.transform = 'translateY(-550px) scale(1.3)';
        lotus.style.opacity = '0';
      });

      setTimeout(() => lotus.remove(), 3200);
    }, i * 300);
  }
}

// 4. Thỉnh Chuông
function triggerBellEffect() {
  if (bellMallet) bellMallet.classList.add('strike');
  setTimeout(() => {
    if (bellMallet) bellMallet.classList.remove('strike');
    const bellBody = document.querySelector('.bell-body');
    if (bellBody) bellBody.classList.add('ringing');
    if (bellSoundwave) {
      bellSoundwave.classList.remove('active');
      void bellSoundwave.offsetWidth;
      bellSoundwave.classList.add('active');
    }
    playBellSound();
    setTimeout(() => {
      if (bellBody) bellBody.classList.remove('ringing');
    }, 2500);
  }, 200);
}

// 5. Dâng Mâm Ngũ Quả
function triggerFruitEffect() {
  if (fruitTray) {
    fruitTray.classList.add('active');
    setTimeout(() => {
      fruitTray.classList.remove('active');
    }, 5000);
  }
}

// 6. Phóng Sinh Cá Chép
function triggerFishEffect() {
  playWaterSplash();
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      const carp = document.createElement('div');
      carp.className = 'golden-carp';
      carp.textContent = '🐟';
      carp.style.bottom = (40 + i * 40) + 'px';
      carpContainer.appendChild(carp);
      setTimeout(() => carp.remove(), 4200);
    }, i * 450);
  }
}

// 7. Thả Hoa Đăng
function triggerLanternEffect() {
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const lantern = document.createElement('div');
      lantern.className = 'floating-lantern';
      lantern.textContent = '🏮';
      lantern.style.setProperty('--drift-x', `${15 + Math.random() * 70}%`);
      lanternContainer.appendChild(lantern);
      setTimeout(() => lantern.remove(), 6200);
    }, i * 500);
  }
}

// 8. Rồng Vàng Hộ Pháp
function triggerDragonEffect() {
  playDragonRoar();

  const dragon = document.createElement('div');
  dragon.className = 'golden-dragon';
  dragon.innerHTML = `
    <svg viewBox="0 0 500 300" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 200 C120 100, 220 280, 320 150 C380 70, 440 180, 480 120" stroke="#ffd700" stroke-width="26" stroke-linecap="round" fill="none"/>
      <path d="M50 200 C120 100, 220 280, 320 150 C380 70, 440 180, 480 120" stroke="#ffea75" stroke-width="14" stroke-linecap="round" fill="none"/>
      <!-- Đầu Rồng Thần Uy Nghiêm -->
      <circle cx="480" cy="120" r="28" fill="#ffd700"/>
      <circle cx="490" cy="112" r="5" fill="#ff0000"/>
      <path d="M470 95 L495 70 M460 100 L475 75" stroke="#ffea75" stroke-width="6"/>
      <path d="M480 135 C500 150, 490 160, 470 145" fill="#ff3300"/>
    </svg>
  `;
  dragonContainer.appendChild(dragon);

  setTimeout(() => dragon.remove(), 5200);
}

// 9. Phật Phát Hào Quang (Khi Đủ Tim)
function triggerBuddhaHaloGlow() {
  if (buddhaStatue) {
    buddhaStatue.classList.add('super-glow');
    playBellSound();
    triggerLotusEffect();
    setTimeout(() => {
      buddhaStatue.classList.remove('super-glow');
    }, 7000);
  }
}

// 10. Mưa Vàng (Khi Đạt Mốc Chia Sẻ)
function triggerGoldRainEffect() {
  playCoinShowerSound();
  const coins = ['🪙', '💰', '✨', '🪙', '✨'];
  for (let i = 0; i < 45; i++) {
    setTimeout(() => {
      const coin = document.createElement('div');
      coin.className = 'gold-coin';
      coin.textContent = coins[Math.floor(Math.random() * coins.length)];
      coin.style.left = (Math.random() * 95) + '%';
      goldRainContainer.appendChild(coin);
      setTimeout(() => coin.remove(), 3600);
    }, i * 75);
  }
}

// Hiển thị Toast thông báo khi có Phật tử cúng dường
function showGiftToast(user, gift, repeatCount, points) {
  const toast = document.createElement('div');
  toast.className = 'gift-toast';
  toast.innerHTML = `
    <span class="toast-icon">${gift.icon || '🎁'}</span>
    <div class="toast-text">
      <strong class="toast-user">${user.nickname || user.name}</strong> vừa
      <span class="toast-action">${gift.actionName || 'cúng dường'}</span>
      ${repeatCount > 1 ? `x${repeatCount}` : ''}
      <span class="toast-points">+${points} công đức</span>
    </div>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

// Thực thi hành động tương ứng với loại quà
function executeActionByType(actionType) {
  switch (actionType) {
    case 'incense':
      triggerIncenseEffect();
      break;
    case 'candle':
      triggerCandleEffect();
      break;
    case 'lotus':
      triggerLotusEffect();
      break;
    case 'bell':
      triggerBellEffect();
      break;
    case 'fruit':
      triggerFruitEffect();
      break;
    case 'fish':
      triggerFishEffect();
      break;
    case 'lantern':
      triggerLanternEffect();
      break;
    case 'dragon':
      triggerDragonEffect();
      break;
    default:
      triggerIncenseEffect();
  }
}

// ========================================================
// RENDER CÁC BẢNG UI (QUÀ, CÔNG ĐỨC, MỤC TIÊU)
// ========================================================

function renderGiftGuide(gifts) {
  const container = document.getElementById('ui-gift-list');
  if (!container) return;
  container.innerHTML = '';

  gifts.filter(g => g.enabled).forEach(gift => {
    const row = document.createElement('div');
    row.className = 'gift-row';
    row.innerHTML = `
      <div class="gift-name-line">
        <span>${gift.icon || '🎁'}</span>
        <span>${gift.giftName}</span>
      </div>
      <div class="gift-action-line">
        <span>🪷</span>
        <span>${gift.actionName}</span>
      </div>
    `;
    container.appendChild(row);
  });
}

function renderLeaderboard(leaderboard) {
  const container = document.getElementById('ui-leaderboard-list');
  if (!container) return;
  container.innerHTML = '';

  const topDevotees = (leaderboard || []).slice(0, 5);
  topDevotees.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'rank-row';

    let rankClass = 'rank-other';
    let badgeText = index + 1;
    if (index === 0) { rankClass = 'rank-1'; badgeText = '🥇'; }
    else if (index === 1) { rankClass = 'rank-2'; badgeText = '🥈'; }
    else if (index === 2) { rankClass = 'rank-3'; badgeText = '🥉'; }

    row.innerHTML = `
      <div class="rank-left">
        <span class="rank-badge ${rankClass}">${badgeText}</span>
        <span class="rank-name">${item.nickname || item.name}</span>
      </div>
      <span class="rank-points">${item.points}</span>
    `;
    container.appendChild(row);
  });
}

function updateGoalsUI(goals) {
  if (!goals) return;

  // Tim
  const likesCurrentElem = document.getElementById('ui-likes-current');
  const likesGoalElem = document.getElementById('ui-likes-goal');
  const likesBar = document.getElementById('ui-likes-bar');

  if (likesCurrentElem) likesCurrentElem.textContent = goals.likeCurrent.toLocaleString('vi-VN');
  if (likesGoalElem) likesGoalElem.textContent = goals.likeGoal.toLocaleString('vi-VN');
  if (likesBar) {
    const percent = Math.min(100, Math.round((goals.likeCurrent / goals.likeGoal) * 100));
    likesBar.style.width = percent + '%';
  }

  // Chia sẻ
  const sharesCurrentElem = document.getElementById('ui-shares-current');
  const sharesGoalElem = document.getElementById('ui-shares-goal');
  const sharesBar = document.getElementById('ui-shares-bar');

  if (sharesCurrentElem) sharesCurrentElem.textContent = goals.shareCurrent.toLocaleString('vi-VN');
  if (sharesGoalElem) sharesGoalElem.textContent = goals.shareGoal.toLocaleString('vi-VN');
  if (sharesBar) {
    const percent = Math.min(100, Math.round((goals.shareCurrent / goals.shareGoal) * 100));
    sharesBar.style.width = percent + '%';
  }
}

// ========================================================
// KẾT NỐI REALTIME SOCKET.IO TỚI SERVER
// ========================================================

const socket = io();

socket.on('connect', () => {
  console.log('[Socket] Đã kết nối tới máy chủ Chùa Online!');
});

// Trạng thái ban đầu
socket.on('init_state', (data) => {
  const { config, liveStats } = data;
  if (!config) return;

  if (config.temple?.name) {
    const nameElem = document.getElementById('ui-temple-name');
    if (nameElem) nameElem.textContent = config.temple.name;
  }

  if (config.gifts) renderGiftGuide(config.gifts);
  if (config.leaderboard) renderLeaderboard(config.leaderboard);
  if (config.goals) updateGoalsUI(config.goals);

  const totalPointsElem = document.getElementById('ui-total-points');
  if (totalPointsElem) totalPointsElem.textContent = liveStats.totalPoints || 56;
});

// Cập nhật cấu hình
socket.on('config_updated', (config) => {
  if (config.temple?.name) {
    const nameElem = document.getElementById('ui-temple-name');
    if (nameElem) nameElem.textContent = config.temple.name;
  }
  if (config.gifts) renderGiftGuide(config.gifts);
  if (config.leaderboard) renderLeaderboard(config.leaderboard);
  if (config.goals) updateGoalsUI(config.goals);
});

// Nhận quà TikTok
socket.on('gift_triggered', (data) => {
  const { user, gift, repeatCount, points, totalPoints, leaderboard } = data;

  // Thực thi hiệu ứng
  executeActionByType(gift.actionType);

  // Hiển thị toast thông báo
  showGiftToast(user, gift, repeatCount, points);

  // Cập nhật tổng công đức & bảng xếp hạng
  const totalPointsElem = document.getElementById('ui-total-points');
  if (totalPointsElem) totalPointsElem.textContent = totalPoints;
  if (leaderboard) renderLeaderboard(leaderboard);

  // Sư thầy hoan hỉ niệm Phật
  if (monkBubble) monkBubble.textContent = `Tri ân ${user.nickname || user.name} 🙏`;
});

// Nhận bình luận TikTok
socket.on('tiktok_chat', (data) => {
  const { user, comment } = data;
  showDevoteeSpeech(user, comment);
});

// Nhận thả tim TikTok
socket.on('tiktok_like', (data) => {
  const { totalLikes, goal } = data;
  const likesCurrentElem = document.getElementById('ui-likes-current');
  const likesBar = document.getElementById('ui-likes-bar');

  if (likesCurrentElem) likesCurrentElem.textContent = totalLikes.toLocaleString('vi-VN');
  if (likesBar && goal) {
    const percent = Math.min(100, Math.round((totalLikes / goal) * 100));
    likesBar.style.width = percent + '%';
  }
});

// Nhận chia sẻ TikTok
socket.on('tiktok_share', (data) => {
  const { totalShares, goal } = data;
  const sharesCurrentElem = document.getElementById('ui-shares-current');
  const sharesBar = document.getElementById('ui-shares-bar');

  if (sharesCurrentElem) sharesCurrentElem.textContent = totalShares.toLocaleString('vi-VN');
  if (sharesBar && goal) {
    const percent = Math.min(100, Math.round((totalShares / goal) * 100));
    sharesBar.style.width = percent + '%';
  }
});

// Nhận sự kiện có Phật tử mới vào chùa
socket.on('tiktok_member', (data) => {
  const { user } = data;
  addOrFindDevotee(user);
  showDevoteeSpeech(user, 'vừa vào chùa 🙏');
});

// Đạt mốc mục tiêu (Phật phát hào quang hoặc Mưa vàng)
socket.on('goal_reached', (data) => {
  const { type } = data;
  if (type === 'like') {
    triggerBuddhaHaloGlow();
  } else if (type === 'share') {
    triggerGoldRainEffect();
  }
});

// Cập nhật bảng công đức
socket.on('leaderboard_updated', (data) => {
  renderLeaderboard(data.leaderboard);
  const totalPointsElem = document.getElementById('ui-total-points');
  if (totalPointsElem) totalPointsElem.textContent = data.totalPoints || 0;
});

// Xử lý nút bật tắt âm thanh
const soundBtn = document.getElementById('sound-toggle-btn');
if (soundBtn) {
  soundBtn.addEventListener('click', () => {
    initAudio();
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
    soundBtn.style.opacity = soundEnabled ? '1' : '0.5';
  });
}

// Bắt sự kiện click bất kỳ trên trang để mở AudioContext nếu chạy trong Chrome
window.addEventListener('click', () => {
  initAudio();
}, { once: true });
