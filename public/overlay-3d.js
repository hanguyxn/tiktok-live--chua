/* ========================================================
   CHÙA ONLINE 3D - THREE.JS ENGINE HOÀN CHỈNH
   - Nhân Vật 3D Chibi Tương Tác
   - Người Top Công Đức Ngự Đỉnh Đài Sen (VIP Dais)
   - Phật Tử Dâng Hương, Thỉnh Chuông, Rồng Vàng, Hào Quang
   - Tối Ưu Cho Livestream Màn Hình Điện Thoại & OBS
   ======================================================== */

// Khởi tạo AudioContext cho Web Audio API
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

// 1. Âm thanh mõ gỗ tụng kinh
function playMoSound() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(840, now);
  osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(820, now);
  filter.Q.setValueAtTime(4.5, now);

  gain.gain.setValueAtTime(0.7, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

// 2. Âm thanh đại hồng chung ngân vang
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

// 3. Âm thanh rồng vàng gầm & gió thiêng
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

// 4. Âm thanh mưa vàng
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
// KHỞI TẠO THREE.JS SCENE, CAMERA, RENDERER
// ========================================================

const container = document.getElementById('canvas-3d-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0402);
scene.fog = new THREE.FogExp2(0x1a0904, 0.022);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// Quản lý các góc nhìn Camera
const cameraPresets = {
  full: { pos: new THREE.Vector3(0, 6.2, 13.5), target: new THREE.Vector3(0, 3.2, -6), name: 'Toàn Cảnh' },
  top: { pos: new THREE.Vector3(0, 5.2, -4), target: new THREE.Vector3(0, 5.2, -11.5), name: 'Đỉnh Top 1' },
  incense: { pos: new THREE.Vector3(0, 2.8, -1.5), target: new THREE.Vector3(0, 2.0, -7), name: 'Dâng Hương' },
  auto: { pos: new THREE.Vector3(0, 6.0, 13.0), target: new THREE.Vector3(0, 3.5, -6), name: 'Tự Động Lia' }
};

let currentCamMode = 'full';
let targetCamPos = cameraPresets.full.pos.clone();
let targetCamLook = cameraPresets.full.target.clone();
camera.position.copy(targetCamPos);
camera.lookAt(targetCamLook);

let autoCamAngle = 0;

// ========================================================
// ÁNH SÁNG CHÙA TRANG NGHIÊM
// ========================================================

const ambientLight = new THREE.AmbientLight(0xffecd2, 0.65);
scene.add(ambientLight);

// Luồng sáng chính chiếu từ trên tượng Phật xuống
const mainSunLight = new THREE.DirectionalLight(0xffe082, 1.4);
mainSunLight.position.set(0, 18, 5);
mainSunLight.castShadow = true;
mainSunLight.shadow.mapSize.width = 1024;
mainSunLight.shadow.mapSize.height = 1024;
mainSunLight.shadow.bias = -0.001;
scene.add(mainSunLight);

// Cột sáng hoàng kim chuyên biệt chiếu rọi ĐỈNH THƯỢNG ĐIỆN (TOP 1)
const topDaisSpotLight = new THREE.SpotLight(0xffd700, 3.0, 25, Math.PI / 7, 0.35, 1);
topDaisSpotLight.position.set(0, 16, -11);
topDaisSpotLight.target.position.set(0, 4.2, -11.5);
scene.add(topDaisSpotLight);
scene.add(topDaisSpotLight.target);

// Cặp đèn nến hai bên bàn thờ
const candleLightLeft = new THREE.PointLight(0xff6600, 1.8, 10);
candleLightLeft.position.set(-3.2, 3.2, -7);
scene.add(candleLightLeft);

const candleLightRight = new THREE.PointLight(0xff6600, 1.8, 10);
candleLightRight.position.set(3.2, 3.2, -7);
scene.add(candleLightRight);

// ========================================================
// KIẾN TRÚC CHÙA VÀNG 3D (SANCTUARY ARCHITECTURE)
// ========================================================

// 1. Sàn Chánh Điện (Đá ngọc bóng mờ)
const floorGeo = new THREE.PlaneGeometry(30, 40);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x1c0b05,
  roughness: 0.28,
  metalness: 0.25
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

// 2. Thảm Đỏ Hoa Sen (Trải dài dọc chánh điện)
const carpetGeo = new THREE.PlaneGeometry(3.6, 28);
const carpetMat = new THREE.MeshStandardMaterial({
  color: 0x8a0d16,
  roughness: 0.7,
  metalness: 0.1
});
const carpet = new THREE.Mesh(carpetGeo, carpetMat);
carpet.rotation.x = -Math.PI / 2;
carpet.position.set(0, 0.02, 3);
carpet.receiveShadow = true;
scene.add(carpet);

// Viền thảm mạ vàng
const borderGeo = new THREE.PlaneGeometry(0.12, 28);
const borderMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 });
const borderL = new THREE.Mesh(borderGeo, borderMat);
borderL.rotation.x = -Math.PI / 2;
borderL.position.set(-1.8, 0.03, 3);
scene.add(borderL);

const borderR = new THREE.Mesh(borderGeo, borderMat);
borderR.rotation.x = -Math.PI / 2;
borderR.position.set(1.8, 0.03, 3);
scene.add(borderR);

// 3. Các Cột Gỗ Sơn Son Thiếp Vàng (Columns)
const columnGeo = new THREE.CylinderGeometry(0.5, 0.55, 14, 16);
const columnMat = new THREE.MeshStandardMaterial({ color: 0x421808, roughness: 0.5, metalness: 0.3 });
const columnGoldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.3, metalness: 0.8 });

const colPositions = [
  [-6, -9], [-6, -3], [-6, 3], [-6, 9],
  [6, -9], [6, -3], [6, 3], [6, 9]
];

colPositions.forEach(([x, z]) => {
  const col = new THREE.Mesh(columnGeo, columnMat);
  col.position.set(x, 7, z);
  col.castShadow = true;
  col.receiveShadow = true;
  scene.add(col);

  // Vòng vàng ở chân và đầu cột
  const ringGeo = new THREE.TorusGeometry(0.56, 0.08, 8, 24);
  const ring1 = new THREE.Mesh(ringGeo, columnGoldMat);
  ring1.rotation.x = Math.PI / 2;
  ring1.position.set(x, 0.6, z);
  scene.add(ring1);

  const ring2 = new THREE.Mesh(ringGeo, columnGoldMat);
  ring2.rotation.x = Math.PI / 2;
  ring2.position.set(x, 12, z);
  scene.add(ring2);
});

// 4. Bức Tường Hậu & Ban Thờ Đức Phật (Altar Back Wall)
const backWallGeo = new THREE.PlaneGeometry(30, 16);
const backWallMat = new THREE.MeshStandardMaterial({ color: 0x220e06, roughness: 0.6 });
const backWall = new THREE.Mesh(backWallGeo, backWallMat);
backWall.position.set(0, 8, -15);
scene.add(backWall);

// ========================================================
// TƯỢNG ĐẠI PHẬT THÍCH CA MÂU NI 3D & HÀO QUANG
// ========================================================

const buddhaGroup = new THREE.Group();
buddhaGroup.position.set(0, 5.2, -12);
scene.add(buddhaGroup);

// Vật liệu Hoàng Kim Phật Thân
const buddhaGoldMat = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  metalness: 0.75,
  roughness: 0.22,
  emissive: 0x664400,
  emissiveIntensity: 0.25
});

// Tòa sen lớn (Lotus Pedestal)
const lotusThroneGeo = new THREE.CylinderGeometry(2.4, 2.8, 1.2, 24);
const lotusThroneMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.7, roughness: 0.3 });
const lotusThrone = new THREE.Mesh(lotusThroneGeo, lotusThroneMat);
lotusThrone.position.y = 0.6;
buddhaGroup.add(lotusThrone);

// Các cánh sen hồng bao quanh tòa
for (let i = 0; i < 16; i++) {
  const angle = (i / 16) * Math.PI * 2;
  const petalGeo = new THREE.ConeGeometry(0.4, 1.2, 5);
  const petalMat = new THREE.MeshStandardMaterial({ color: 0xe07a98, roughness: 0.4 });
  const petal = new THREE.Mesh(petalGeo, petalMat);
  petal.position.set(Math.cos(angle) * 2.5, 0.9, Math.sin(angle) * 2.5);
  petal.rotation.z = -Math.cos(angle) * 0.4;
  petal.rotation.x = Math.sin(angle) * 0.4;
  buddhaGroup.add(petal);
}

// Chân ngồi kiết già (Cross-legged base)
const legsGeo = new THREE.TorusGeometry(1.4, 0.45, 12, 24);
const legs = new THREE.Mesh(legsGeo, buddhaGoldMat);
legs.rotation.x = Math.PI / 2;
legs.position.y = 1.35;
buddhaGroup.add(legs);

// Thân mình & Cà sa vàng
const torsoGeo = new THREE.CylinderGeometry(0.85, 1.3, 2.2, 16);
const torso = new THREE.Mesh(torsoGeo, buddhaGoldMat);
torso.position.y = 2.4;
buddhaGroup.add(torso);

// Đầu Phật & Ushnisha
const headGeo = new THREE.SphereGeometry(0.75, 24, 24);
const head = new THREE.Mesh(headGeo, buddhaGoldMat);
head.position.y = 4.1;
buddhaGroup.add(head);

// Nhục kế Ushnisha trên đỉnh đầu
const ushnishaGeo = new THREE.ConeGeometry(0.3, 0.5, 16);
const ushnisha = new THREE.Mesh(ushnishaGeo, buddhaGoldMat);
ushnisha.position.y = 4.95;
buddhaGroup.add(ushnisha);

// Đôi tai dài chấm vai
const earGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.65, 8);
const earL = new THREE.Mesh(earGeo, buddhaGoldMat);
earL.position.set(-0.8, 4.0, 0);
buddhaGroup.add(earL);

const earR = new THREE.Mesh(earGeo, buddhaGoldMat);
earR.position.set(0.8, 4.0, 0);
buddhaGroup.add(earR);

// Hai tay bắt ấn Dhyana Mudra (ấn thiền định)
const handGeo = new THREE.SphereGeometry(0.28, 12, 12);
const hands = new THREE.Mesh(handGeo, buddhaGoldMat);
hands.position.set(0, 1.8, 0.85);
buddhaGroup.add(hands);

// Vòng Hào Quang Phật 3D (Divine Rotating Halo)
const haloGroup = new THREE.Group();
haloGroup.position.set(0, 4.2, -0.6);
buddhaGroup.add(haloGroup);

// Các vòng tròn hào quang phát sáng
const haloRing1 = new THREE.Mesh(
  new THREE.TorusGeometry(2.2, 0.08, 16, 48),
  new THREE.MeshBasicMaterial({ color: 0xfff099 })
);
haloGroup.add(haloRing1);

const haloRing2 = new THREE.Mesh(
  new THREE.TorusGeometry(3.2, 0.06, 16, 48),
  new THREE.MeshBasicMaterial({ color: 0xffaa00 })
);
haloGroup.add(haloRing2);

// Đĩa mandala ánh sáng sau lưng
const mandalaGeo = new THREE.CircleGeometry(3.0, 32);
const mandalaMat = new THREE.MeshBasicMaterial({
  color: 0xffd700,
  transparent: true,
  opacity: 0.35,
  side: THREE.DoubleSide
});
const mandalaDisk = new THREE.Mesh(mandalaGeo, mandalaMat);
haloGroup.add(mandalaDisk);

// ========================================================
// TAM CẤP THỜ TỰ (THE THREE SACRED TIERS)
// ========================================================

// ----------------------------------------------------
// BẬC 1: ĐỈNH THƯỢNG ĐIỆN (VIP DAIS - DÀNH RIÊNG CHO TOP 1, 2, 3)
// ----------------------------------------------------
const topDaisGroup = new THREE.Group();
topDaisGroup.position.set(0, 0, -11.5);
scene.add(topDaisGroup);

// Bệ đá mạ vàng nâng cao
const topPlatformGeo = new THREE.BoxGeometry(8, 1.8, 4);
const topPlatformMat = new THREE.MeshStandardMaterial({
  color: 0x331205,
  roughness: 0.35,
  metalness: 0.4
});
const topPlatform = new THREE.Mesh(topPlatformGeo, topPlatformMat);
topPlatform.position.y = 0.9;
topPlatform.receiveShadow = true;
topDaisGroup.add(topPlatform);

// Bậc thang vàng dẫn lên đỉnh
for (let s = 1; s <= 3; s++) {
  const stepGeo = new THREE.BoxGeometry(3.2, 0.45, 0.7);
  const stepMat = new THREE.MeshStandardMaterial({ color: 0x5a230d, roughness: 0.3 });
  const step = new THREE.Mesh(stepGeo, stepMat);
  step.position.set(0, 0.22 * s, 2.0 - (s * 0.5));
  step.receiveShadow = true;
  topDaisGroup.add(step);
}

// Bệ ngồi ĐÀI SEN VÀNG CHO TOP 1 (Chính Giữa)
const top1ThroneGeo = new THREE.CylinderGeometry(1.1, 1.3, 0.5, 20);
const top1ThroneMat = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  metalness: 0.85,
  roughness: 0.15,
  emissive: 0x885500,
  emissiveIntensity: 0.4
});
const top1Throne = new THREE.Mesh(top1ThroneGeo, top1ThroneMat);
top1Throne.position.set(0, 2.05, 0);
topDaisGroup.add(top1Throne);

// Bệ ngồi CHO TOP 2 (Bên Trái) & TOP 3 (Bên Phải)
const subThroneGeo = new THREE.CylinderGeometry(0.8, 0.95, 0.4, 18);
const top2ThroneMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.7, roughness: 0.2 });
const top2Throne = new THREE.Mesh(subThroneGeo, top2ThroneMat);
top2Throne.position.set(-2.6, 2.0, 0.2);
topDaisGroup.add(top2Throne);

const top3ThroneMat = new THREE.MeshStandardMaterial({ color: 0xcd7f32, metalness: 0.6, roughness: 0.3 });
const top3Throne = new THREE.Mesh(subThroneGeo, top3ThroneMat);
top3Throne.position.set(2.6, 2.0, 0.2);
topDaisGroup.add(top3Throne);

// ----------------------------------------------------
// BẬC 2: TRUNG ĐIỆN (BÀN ĐẠI HƯƠNG ÁN & SƯ THẦY DẪN LỄ 3D)
// ----------------------------------------------------
const altarGroup = new THREE.Group();
altarGroup.position.set(0, 0, -6.8);
scene.add(altarGroup);

// Bàn hương án gỗ lim
const altarTableGeo = new THREE.BoxGeometry(6.5, 1.4, 2.2);
const altarTableMat = new THREE.MeshStandardMaterial({ color: 0x3d1708, roughness: 0.4, metalness: 0.3 });
const altarTable = new THREE.Mesh(altarTableGeo, altarTableMat);
altarTable.position.y = 0.7;
altarTable.castShadow = true;
altarTable.receiveShadow = true;
altarGroup.add(altarTable);

// Lư Hương Đồng Khổng Lồ (3 Chân Vạc)
const burnerGroup = new THREE.Group();
burnerGroup.position.set(0, 1.4, 0);
altarGroup.add(burnerGroup);

const burnerBodyGeo = new THREE.CylinderGeometry(0.8, 0.55, 0.9, 20);
const burnerMat = new THREE.MeshStandardMaterial({ color: 0xb8860b, metalness: 0.8, roughness: 0.25 });
const burnerBody = new THREE.Mesh(burnerBodyGeo, burnerMat);
burnerBody.position.y = 0.45;
burnerGroup.add(burnerBody);

// 3 Nén Hương Cắm Trong Lư Đồng Đang Đỏ Lửa
const incenseStickGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.1, 8);
const incenseStickMat = new THREE.MeshStandardMaterial({ color: 0x800000 });
const incenseTipMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });

[-0.15, 0, 0.15].forEach((offset, idx) => {
  const stick = new THREE.Mesh(incenseStickGeo, incenseStickMat);
  stick.position.set(offset, 1.1, (idx === 1 ? -0.05 : 0.05));
  burnerGroup.add(stick);

  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), incenseTipMat);
  tip.position.set(offset, 1.65, (idx === 1 ? -0.05 : 0.05));
  burnerGroup.add(tip);
});

// Chân nến đôi hai bên bàn thờ
[-2.6, 2.6].forEach(x => {
  const candleGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.9, 12);
  const candleMat = new THREE.MeshStandardMaterial({ color: 0xffe082, metalness: 0.5 });
  const candle = new THREE.Mesh(candleGeo, candleMat);
  candle.position.set(x, 1.85, 0);
  altarGroup.add(candle);

  const flameGeo = new THREE.ConeGeometry(0.09, 0.25, 8);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.set(x, 2.4, 0);
  altarGroup.add(flame);
});

// Mâm ngũ quả tài lộc
const fruitTrayGeo = new THREE.CylinderGeometry(0.65, 0.4, 0.18, 16);
const fruitTrayMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8 });
const fruitTray = new THREE.Mesh(fruitTrayGeo, fruitTrayMat);
fruitTray.position.set(-1.4, 1.5, 0);
altarGroup.add(fruitTray);

// ----------------------------------------------------
// SƯ THẦY DẪN LỄ 3D (Gõ Mõ Tụng Kinh)
// ----------------------------------------------------
const monkGroup = new THREE.Group();
monkGroup.position.set(2.0, 0, -5.6);
scene.add(monkGroup);

// Thân sư thầy (Áo cà sa vàng nâu)
const monkBodyGeo = new THREE.CylinderGeometry(0.4, 0.55, 1.2, 14);
const monkBodyMat = new THREE.MeshStandardMaterial({ color: 0xd47700, roughness: 0.5 });
const monkBody = new THREE.Mesh(monkBodyGeo, monkBodyMat);
monkBody.position.y = 0.6;
monkGroup.add(monkBody);

// Đầu sư thầy Chibi
const monkHeadGeo = new THREE.SphereGeometry(0.35, 18, 18);
const monkHeadMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.4 });
const monkHead = new THREE.Mesh(monkHeadGeo, monkHeadMat);
monkHead.position.y = 1.45;
monkGroup.add(monkHead);

// Tay cầm dùi gõ mõ
const monkArmGroup = new THREE.Group();
monkArmGroup.position.set(0.2, 1.1, 0.3);
monkGroup.add(monkArmGroup);

const monkArmGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8);
const monkArm = new THREE.Mesh(monkArmGeo, monkBodyMat);
monkArm.position.set(0, -0.2, 0);
monkArmGroup.add(monkArm);

const malletGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8);
const malletMat = new THREE.MeshStandardMaterial({ color: 0x5c2b0e });
const mallet = new THREE.Mesh(malletGeo, malletMat);
mallet.rotation.x = Math.PI / 2;
mallet.position.set(0, -0.4, 0.2);
monkArmGroup.add(mallet);

// Chiếc Mõ Gỗ Cá Vàng 3D
const woodenFishGeo = new THREE.SphereGeometry(0.25, 12, 12);
const woodenFishMat = new THREE.MeshStandardMaterial({ color: 0x8a3305, roughness: 0.4 });
const woodenFish = new THREE.Mesh(woodenFishGeo, woodenFishMat);
woodenFish.position.set(0.3, 0.6, 0.6);
monkGroup.add(woodenFish);

// Chuông Đại Hồng Chung 3D (Bên Phải Điện)
const bellGroup = new THREE.Group();
bellGroup.position.set(6.5, 3.2, -7.5);
scene.add(bellGroup);

const bellBodyGeo = new THREE.CylinderGeometry(0.8, 1.1, 1.8, 16);
const bellMat = new THREE.MeshStandardMaterial({ color: 0xb38600, metalness: 0.85, roughness: 0.2 });
const bellMesh = new THREE.Mesh(bellBodyGeo, bellMat);
bellGroup.add(bellMesh);

// ----------------------------------------------------
// BẬC 3: HẠ ĐIỆN PHẬT TỬ (3D DEVOTEES ON MATS)
// ----------------------------------------------------
const matsGroup = new THREE.Group();
scene.add(matsGroup);

const matGeo = new THREE.CylinderGeometry(0.55, 0.6, 0.12, 16);
const matMat = new THREE.MeshStandardMaterial({ color: 0x80000a, roughness: 0.6 });

const matPositions = [];
for (let row = 0; row < 5; row++) {
  const z = -2.5 + row * 2.8;
  matPositions.push({ x: -3.2, z });
  matPositions.push({ x: -4.6, z });
  matPositions.push({ x: 3.2, z });
  matPositions.push({ x: 4.6, z });
}

matPositions.forEach(pos => {
  const mat = new THREE.Mesh(matGeo, matMat);
  mat.position.set(pos.x, 0.06, pos.z);
  mat.receiveShadow = true;
  matsGroup.add(mat);
});

// ========================================================
// HỆ THỐNG NHÂN VẬT 3D CHIBI (DEVOTEES FACTORY)
// ========================================================

const activeDevoteesMap = new Map(); // key: username -> { mesh, user, isTop, isPraying, targetPos }
let top1DevoteeMesh = null;
let top2DevoteeMesh = null;
let top3DevoteeMesh = null;

// Hàm tạo sprite chữ (Name Tag / Chat Bubble)
function createTextSprite(text, bgColor = 'rgba(25, 10, 4, 0.85)', textColor = '#ffd700', fontSize = 32) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 20);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = `bold ${fontSize}px Quicksand, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(2.4, 0.6, 1);
  return sprite;
}

// Hàm khởi tạo 1 nhân vật 3D Chibi
function createChibiDevotee(user, isTop1 = false) {
  const charGroup = new THREE.Group();

  // Thân mình (Áo lam hoặc cà sa vàng)
  const bodyGeo = new THREE.CylinderGeometry(0.32, 0.44, 0.9, 14);
  const bodyColor = isTop1 ? 0xffd700 : (user.color || 0x2b4c7e);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: isTop1 ? 0.2 : 0.6,
    metalness: isTop1 ? 0.8 : 0.1
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.45;
  body.castShadow = true;
  charGroup.add(body);

  // Đầu Chibi
  const headGeo = new THREE.SphereGeometry(0.35, 18, 18);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.4 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.15;
  head.castShadow = true;
  charGroup.add(head);

  // Hai bàn tay chắp lại bái Phật
  const handGeo = new THREE.SphereGeometry(0.12, 10, 10);
  const hands = new THREE.Mesh(handGeo, headMat);
  hands.position.set(0, 0.7, 0.35);
  charGroup.add(hands);

  // Thẻ tên nổi trên đầu nhân vật
  const nameLabel = isTop1 ? `🥇 TOP 1: ${user.nickname || user.name}` : (user.nickname || user.name);
  const nameSprite = createTextSprite(nameLabel, isTop1 ? 'rgba(212, 175, 55, 0.95)' : 'rgba(25, 10, 4, 0.85)', isTop1 ? '#331500' : '#ffd700');
  nameSprite.position.y = 1.8;
  charGroup.add(nameSprite);

  // VÒNG HÀO QUANG VÀNG KIM NẾU LÀ TOP 1
  if (isTop1) {
    const haloMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.65, 0.05, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffea75 })
    );
    haloMesh.rotation.x = Math.PI / 4;
    haloMesh.position.set(0, 1.45, -0.15);
    charGroup.add(haloMesh);
  }

  return charGroup;
}

// Khởi tạo Phật tử mẫu ban đầu
function initDefaultDevotees() {
  const initialDevotees = [
    { name: 'pk', nickname: 'Phật tử PK', color: 0xffd700, isTop: 1 },
    { name: 'a.', nickname: 'Diệu Thiện', color: 0xe0e0e0, isTop: 2 },
    { name: 'H.V. Thịnh', nickname: 'Thịnh Vượng', color: 0xcd7f32, isTop: 3 },
    { name: 'Thùy Trinh', nickname: 'Bảo Trinh', color: 0x2b4c7e },
    { name: 'van anh', nickname: 'Vân Anh', color: 0x6a2c70 },
    { name: 'Hương Sen', nickname: 'Hương Sen', color: 0xb83b5e },
    { name: 'Minh Tuệ', nickname: 'Minh Tuệ', color: 0xf08a5d },
    { name: 'Quang Khải', nickname: 'Quang Khải', color: 0x3f72af },
    { name: 'Thanh Nhã', nickname: 'Thanh Nhã', color: 0x00b8a9 },
    { name: 'Bảo Long', nickname: 'Bảo Long', color: 0x40514e }
  ];

  initialDevotees.forEach((d, idx) => {
    spawnDevotee(d, d.isTop);
  });
}

// Đặt nhân vật vào vị trí (Đài Sen Đỉnh hoặc Bồ Đoàn)
function spawnDevotee(user, topRank = null) {
  const key = (user.name || '').toLowerCase();
  if (activeDevoteesMap.has(key)) return;

  const isTop1 = topRank === 1;
  const isTop2 = topRank === 2;
  const isTop3 = topRank === 3;

  const charMesh = createChibiDevotee(user, isTop1);

  if (isTop1) {
    // NGỰ TRÊN ĐỈNH ĐÀI SEN VÀNG CAO NHẤT (TIER 1)
    charMesh.position.set(0, 2.3, -11.5);
    top1DevoteeMesh = charMesh;
  } else if (isTop2) {
    charMesh.position.set(-2.6, 2.2, -11.3);
    top2DevoteeMesh = charMesh;
  } else if (isTop3) {
    charMesh.position.set(2.6, 2.2, -11.3);
    top3DevoteeMesh = charMesh;
  } else {
    // Ngồi trên bồ đoàn phía dưới (TIER 3)
    const matIndex = (activeDevoteesMap.size) % matPositions.length;
    const pos = matPositions[matIndex];
    charMesh.position.set(pos.x, 0.12, pos.z);
  }

  scene.add(charMesh);
  activeDevoteesMap.set(key, { mesh: charMesh, user, topRank, originPos: charMesh.position.clone() });
}

// Khi người xem comment: Nhân vật bước lên bàn thờ dâng hương
function devoteeOfferIncenseAction(user, commentText) {
  const key = (user.name || '').toLowerCase();
  let devotee = activeDevoteesMap.get(key);
  if (!devotee) {
    spawnDevotee(user);
    devotee = activeDevoteesMap.get(key);
  }
  if (!devotee) return;

  const mesh = devotee.mesh;

  // Hiển thị bong bóng thoại 3D
  const bubbleSprite = createTextSprite(`💬 ${commentText}`, 'rgba(255, 255, 255, 0.95)', '#4d1a00', 28);
  bubbleSprite.position.y = 2.4;
  mesh.add(bubbleSprite);
  setTimeout(() => bubbleSprite.remove(), 4500);

  // Nếu là người ở dưới: di chuyển lên trước lư hương dâng nén hương
  if (!devotee.topRank) {
    const startPos = mesh.position.clone();
    const altarFrontPos = new THREE.Vector3(0, 0.12, -4.8);

    // Di chuyển lên
    let step = 0;
    const walkInterval = setInterval(() => {
      step += 0.05;
      mesh.position.lerpVectors(startPos, altarFrontPos, Math.min(1, step));
      mesh.rotation.y = Math.sin(step * 20) * 0.15; // lắc lư bước đi

      if (step >= 1) {
        clearInterval(walkInterval);
        // Vái lạy dâng hương
        mesh.rotation.x = 0.5;
        triggerIncense3DEffect();

        setTimeout(() => {
          mesh.rotation.x = 0;
          // Đi về vị trí cũ
          let backStep = 0;
          const returnInterval = setInterval(() => {
            backStep += 0.05;
            mesh.position.lerpVectors(altarFrontPos, startPos, Math.min(1, backStep));
            if (backStep >= 1) {
              clearInterval(returnInterval);
              mesh.position.copy(startPos);
              mesh.rotation.set(0, 0, 0);
            }
          }, 30);
        }, 2000);
      }
    }, 30);
  } else {
    // Nếu là TOP trên đỉnh đài sen: lạy đại lễ và tỏa sáng
    mesh.rotation.x = 0.6;
    setTimeout(() => { mesh.rotation.x = 0; }, 1800);
  }
}

// ========================================================
// HỆ THỐNG HIỆU ỨNG 3D PARTICLE & QUÀ TẶNG
// ========================================================

// 1. Hệ Thống Khói Hương 3D (Incense Smoke Particles)
const smokeCount = 100;
const smokeGeo = new THREE.BufferGeometry();
const smokePos = new Float32Array(smokeCount * 3);
const smokeVel = [];

for (let i = 0; i < smokeCount; i++) {
  smokePos[i * 3] = (Math.random() - 0.5) * 0.3;
  smokePos[i * 3 + 1] = 2.5 + Math.random() * 3.5;
  smokePos[i * 3 + 2] = -6.8 + (Math.random() - 0.5) * 0.3;
  smokeVel.push({
    vx: (Math.random() - 0.5) * 0.008,
    vy: Math.random() * 0.02 + 0.015,
    vz: (Math.random() - 0.5) * 0.008
  });
}
smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));

const smokeMat = new THREE.PointsMaterial({
  color: 0xfff2e0,
  size: 0.35,
  transparent: true,
  opacity: 0.45,
  depthWrite: false
});
const smokeParticles = new THREE.Points(smokeGeo, smokeMat);
scene.add(smokeParticles);

let smokeBoost = 1;
function triggerIncense3DEffect() {
  smokeBoost = 4;
  setTimeout(() => { smokeBoost = 1; }, 4000);
}

// 2. Thỉnh Chuông 3D (Rung chuông & Sóng âm vòng tròn)
function triggerBell3DEffect() {
  playBellSound();
  let ringTime = 0;
  const shakeInterval = setInterval(() => {
    ringTime += 0.2;
    bellMesh.rotation.z = Math.sin(ringTime * 8) * 0.15;
    if (ringTime > 2.5) {
      clearInterval(shakeInterval);
      bellMesh.rotation.z = 0;
    }
  }, 30);

  // Tạo sóng âm 3D lan tỏa
  const shockRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.06, 12, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.9 })
  );
  shockRing.position.copy(bellGroup.position);
  scene.add(shockRing);

  let scale = 1;
  const waveInterval = setInterval(() => {
    scale += 0.15;
    shockRing.scale.set(scale, scale, scale);
    shockRing.material.opacity -= 0.025;
    if (shockRing.material.opacity <= 0) {
      clearInterval(waveInterval);
      scene.remove(shockRing);
    }
  }, 30);
}

// 3. RỒNG VÀNG 3D HỘ PHÁP (Kim Long Giáng Thế)
function triggerDragon3DEffect() {
  playDragonRoar();

  const dragonGroup = new THREE.Group();
  const dragonSegments = [];
  const segCount = 18;

  for (let i = 0; i < segCount; i++) {
    const size = i === 0 ? 0.9 : 0.65 - (i * 0.02);
    const segMesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.9,
        roughness: 0.15,
        emissive: 0xff6600,
        emissiveIntensity: 0.3
      })
    );
    dragonGroup.add(segMesh);
    dragonSegments.push(segMesh);
  }
  scene.add(dragonGroup);

  let t = 0;
  const dragonAnim = setInterval(() => {
    t += 0.04;
    // Đường bay uốn lượn hình xoắn ốc quanh chánh điện
    const headX = Math.sin(t * 2) * 5.5;
    const headY = 4 + Math.sin(t * 3) * 3;
    const headZ = 12 - t * 6;

    dragonSegments[0].position.set(headX, headY, headZ);

    for (let i = 1; i < segCount; i++) {
      dragonSegments[i].position.lerp(dragonSegments[i - 1].position, 0.35);
    }

    if (t > 5.5) {
      clearInterval(dragonAnim);
      scene.remove(dragonGroup);
    }
  }, 25);
}

// 4. Phật Phát Hào Quang 3D (Đủ Tim)
function triggerHalo3DEffect() {
  playBellSound();
  let count = 0;
  const haloAnim = setInterval(() => {
    count++;
    haloRing1.scale.multiplyScalar(1.03);
    haloRing2.scale.multiplyScalar(1.03);
    mandalaDisk.material.opacity = 0.8;
    if (count > 25) {
      clearInterval(haloAnim);
      haloRing1.scale.set(1, 1, 1);
      haloRing2.scale.set(1, 1, 1);
      mandalaDisk.material.opacity = 0.35;
    }
  }, 40);
}

// 5. Mưa Vàng 3D (Chia Sẻ Đạt Mốc)
function triggerGoldRain3DEffect() {
  playCoinShowerSound();
  const coinGroup = new THREE.Group();
  const coinCount = 60;
  const coins = [];

  for (let i = 0; i < coinCount; i++) {
    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12),
      new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.1 })
    );
    coin.position.set((Math.random() - 0.5) * 12, 12 + Math.random() * 6, (Math.random() - 0.5) * 14);
    coinGroup.add(coin);
    coins.push({ mesh: coin, vy: Math.random() * 0.15 + 0.12 });
  }
  scene.add(coinGroup);

  let rainTime = 0;
  const rainInterval = setInterval(() => {
    rainTime += 0.05;
    coins.forEach(c => {
      c.mesh.position.y -= c.vy;
      c.mesh.rotation.x += 0.1;
      c.mesh.rotation.y += 0.1;
      if (c.mesh.position.y < 0.1) c.mesh.position.y = 0.1; // nằm trên sàn
    });

    if (rainTime > 4.5) {
      clearInterval(rainInterval);
      scene.remove(coinGroup);
    }
  }, 30);
}

// ========================================================
// RENDER LOOP & ANIMATION HOÀN HẢO
// ========================================================

let clock = new THREE.Clock();
let chantTimer = 0;

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  // 1. Vòng hào quang Phật xoay chuyển luân hồi
  haloGroup.rotation.z = time * 0.15;
  mandalaDisk.rotation.z = -time * 0.08;

  // 2. Ngọn nến bập bùng
  candleLightLeft.intensity = 1.6 + Math.sin(time * 12) * 0.3;
  candleLightRight.intensity = 1.6 + Math.cos(time * 10) * 0.3;

  // 3. Sư thầy gõ mõ tụng kinh đều đặn
  chantTimer += delta;
  if (chantTimer > 2.2) {
    chantTimer = 0;
    // Đánh mõ
    monkArmGroup.rotation.x = -0.5;
    monkHead.rotation.x = 0.2;
    playMoSound();
    setTimeout(() => {
      monkArmGroup.rotation.x = 0;
      monkHead.rotation.x = 0;
    }, 120);
  }

  // 4. Phật tử đung đưa bái lạy nhẹ nhàng
  activeDevoteesMap.forEach(({ mesh }) => {
    mesh.position.y = mesh.position.y + Math.sin(time * 2 + mesh.position.x) * 0.0008;
  });

  // 5. Khói hương 3D bay lên
  const positions = smokeGeo.attributes.position.array;
  for (let i = 0; i < smokeCount; i++) {
    positions[i * 3 + 1] += smokeVel[i].vy * smokeBoost;
    positions[i * 3] += Math.sin(time * 2 + i) * 0.005;

    if (positions[i * 3 + 1] > 7.0) {
      positions[i * 3 + 1] = 2.4;
      positions[i * 3] = (Math.random() - 0.5) * 0.3;
    }
  }
  smokeGeo.attributes.position.needsUpdate = true;

  // 6. Camera mượt mà theo Presets
  if (currentCamMode === 'auto') {
    autoCamAngle += 0.002;
    camera.position.x = Math.sin(autoCamAngle) * 12;
    camera.position.z = Math.cos(autoCamAngle) * 12;
    camera.position.y = 5.8;
    camera.lookAt(0, 3.2, -6);
  } else {
    camera.position.lerp(targetCamPos, 0.05);
    camera.lookAt(targetCamLook);
  }

  renderer.render(scene, camera);
}
animate();
initDefaultDevotees();

// ========================================================
// XỬ LÝ SỰ KIỆN GIAO DIỆN & TIỆN ÍCH LIVESTREAM ĐIỆN THOẠI
// ========================================================

// Resize cửa sổ
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Chuyển góc quay Camera 3D
const camSwitchBtn = document.getElementById('btn-cam-switch');
const camNameSpan = document.getElementById('cam-name');
const camKeys = ['full', 'top', 'incense', 'auto'];
let camIndex = 0;

camSwitchBtn?.addEventListener('click', () => {
  camIndex = (camIndex + 1) % camKeys.length;
  currentCamMode = camKeys[camIndex];
  const preset = cameraPresets[currentCamMode];
  targetCamPos = preset.pos.clone();
  targetCamLook = preset.target.clone();
  if (camNameSpan) camNameSpan.textContent = preset.name;
});

// Toàn màn hình (Fullscreen cho điện thoại)
const fullscreenBtn = document.getElementById('btn-fullscreen');
fullscreenBtn?.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
    fullscreenBtn.classList.add('active');
  } else {
    document.exitFullscreen().catch(() => {});
    fullscreenBtn.classList.remove('active');
  }
});

// Khóa màn hình luôn sáng (WakeLock API)
const wakelockBtn = document.getElementById('btn-wakelock');
let wakeLock = null;
wakelockBtn?.addEventListener('click', async () => {
  if ('wakeLock' in navigator) {
    try {
      if (!wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakelockBtn.classList.add('active');
        wakelockBtn.textContent = '🔒 Đang Giữ Sáng';
      } else {
        await wakeLock.release();
        wakeLock = null;
        wakelockBtn.classList.remove('active');
        wakelockBtn.textContent = '🔒 Giữ Sáng';
      }
    } catch (err) {
      alert('Trình duyệt chưa hỗ trợ WakeLock hoặc cần tương tác người dùng.');
    }
  }
});

// Bật tắt âm thanh
const soundBtn = document.getElementById('btn-sound');
soundBtn?.addEventListener('click', () => {
  initAudio();
  soundEnabled = !soundEnabled;
  soundBtn.textContent = soundEnabled ? '🔊 Âm Thanh' : '🔇 Tắt Âm';
  soundBtn.style.opacity = soundEnabled ? '1' : '0.6';
});

// Ẩn/Hiện HUD (Cho Livestream Màn Hình Điện Thoại Cực Sạch Sẽ)
const toggleHudBtn = document.getElementById('btn-toggle-hud');
const hudContainer = document.getElementById('hud-container');
let hudVisible = true;
toggleHudBtn?.addEventListener('click', () => {
  hudVisible = !hudVisible;
  if (hudVisible) {
    hudContainer.classList.remove('hud-hidden');
    toggleHudBtn.textContent = '👁️ Ẩn Bảng';
  } else {
    hudContainer.classList.add('hud-hidden');
    toggleHudBtn.textContent = '👁️ Hiện Bảng';
  }
});

// ========================================================
// KẾT NỐI SOCKET.IO VÀ XỬ LÝ SỰ KIỆN TIKTOK LIVE REALTIME
// ========================================================

const socket = io();

// Hiển thị Toast thông báo
function showToast(icon, msg) {
  const container = document.getElementById('gift-toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'hud-toast';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3800);
}

// Cập nhật Bảng Công Đức
function renderLeaderboard3D(leaderboard) {
  const container = document.getElementById('ui-leaderboard-list');
  if (!container) return;
  container.innerHTML = '';

  (leaderboard || []).slice(0, 5).forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'hud-rank-row';

    let rankClass = 'r-other';
    let badgeText = `${index + 1}`;
    let vipTag = '';

    if (index === 0) {
      rankClass = 'r-1';
      badgeText = '🥇';
      vipTag = '<span class="hud-rank-vip">Ngự Đỉnh Sen</span>';
    } else if (index === 1) {
      rankClass = 'r-2';
      badgeText = '🥈';
      vipTag = '<span class="hud-rank-vip">Thượng Điện</span>';
    } else if (index === 2) {
      rankClass = 'r-3';
      badgeText = '🥉';
      vipTag = '<span class="hud-rank-vip">Thượng Điện</span>';
    }

    row.innerHTML = `
      <div class="hud-rank-left">
        <span class="hud-rank-badge ${rankClass}">${badgeText}</span>
        <span class="hud-rank-name">${item.nickname || item.name}</span>
        ${vipTag}
      </div>
      <span class="hud-rank-points">${item.points}</span>
    `;
    container.appendChild(row);
  });
}

// Cập nhật danh sách quà
function renderGiftGuide3D(gifts) {
  const container = document.getElementById('ui-gift-list');
  if (!container) return;
  container.innerHTML = '';
  gifts.filter(g => g.enabled).forEach(gift => {
    const row = document.createElement('div');
    row.className = 'hud-gift-row';
    row.innerHTML = `
      <div class="hud-gift-name"><span>${gift.icon || '🎁'}</span><span>${gift.giftName}</span></div>
      <div class="hud-gift-action">🪷 ${gift.actionName}</div>
    `;
    container.appendChild(row);
  });
}

// Trạng thái ban đầu
socket.on('init_state', (data) => {
  const { config, liveStats } = data;
  if (!config) return;

  if (config.temple?.name) {
    const nameEl = document.getElementById('ui-temple-name');
    if (nameEl) nameEl.textContent = config.temple.name + ' 3D';
  }

  if (config.gifts) renderGiftGuide3D(config.gifts);
  if (config.leaderboard) renderLeaderboard3D(config.leaderboard);

  const totalPointsEl = document.getElementById('ui-total-points');
  if (totalPointsEl) totalPointsEl.textContent = liveStats.totalPoints || 56;
});

// Nhận bình luận TikTok Live
socket.on('tiktok_chat', (data) => {
  const { user, comment } = data;
  devoteeOfferIncenseAction(user, comment);
});

// Nhận quà TikTok Live
socket.on('gift_triggered', (data) => {
  const { user, gift, repeatCount, points, totalPoints, leaderboard } = data;

  // Thực thi hiệu ứng 3D
  switch (gift.actionType) {
    case 'incense':
      triggerIncense3DEffect();
      break;
    case 'bell':
      triggerBell3DEffect();
      break;
    case 'dragon':
      triggerDragon3DEffect();
      break;
    default:
      triggerIncense3DEffect();
  }

  showToast(gift.icon || '🎁', `<strong class="toast-user">${user.nickname || user.name}</strong> vừa <span class="toast-act">${gift.actionName}</span> <span class="toast-pts">+${points} công đức</span>`);

  const totalPointsEl = document.getElementById('ui-total-points');
  if (totalPointsEl) totalPointsEl.textContent = totalPoints;

  if (leaderboard) renderLeaderboard3D(leaderboard);
});

// Nhận tim
socket.on('tiktok_like', (data) => {
  const { totalLikes, goal } = data;
  const likesCurEl = document.getElementById('ui-likes-current');
  const likesBar = document.getElementById('ui-likes-bar');
  if (likesCurEl) likesCurEl.textContent = totalLikes.toLocaleString('vi-VN');
  if (likesBar && goal) {
    likesBar.style.width = Math.min(100, Math.round((totalLikes / goal) * 100)) + '%';
  }
});

// Nhận chia sẻ
socket.on('tiktok_share', (data) => {
  const { totalShares, goal } = data;
  const sharesCurEl = document.getElementById('ui-shares-current');
  const sharesBar = document.getElementById('ui-shares-bar');
  if (sharesCurEl) sharesCurEl.textContent = totalShares.toLocaleString('vi-VN');
  if (sharesBar && goal) {
    sharesBar.style.width = Math.min(100, Math.round((totalShares / goal) * 100)) + '%';
  }
});

// Nhận thành viên mới vào phòng
socket.on('tiktok_member', (data) => {
  const { user } = data;
  spawnDevotee(user);
  devoteeOfferIncenseAction(user, 'vừa vào chùa lễ Phật 🙏');
});

// Đạt mốc mục tiêu
socket.on('goal_reached', (data) => {
  if (data.type === 'like') {
    triggerHalo3DEffect();
    showToast('✨', 'Đạt mốc Thả Tim: Đức Phật Phát Hào Quang Cát Tường!');
  } else if (data.type === 'share') {
    triggerGoldRain3DEffect();
    showToast('🪙', 'Đạt mốc Chia Sẻ: Mưa Vàng Phước Lành Giáng Lâm!');
  }
});

socket.on('leaderboard_updated', (data) => {
  renderLeaderboard3D(data.leaderboard);
});
