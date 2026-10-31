import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { TikTokLiveConnection } from 'tiktok-live-connector';

// Thiết lập whitelist host để ngăn lỗi Authenticated WS
process.env.WHITELIST_AUTHENTICATED_SESSION_ID_HOST = 'api.eulerstream.com';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const CONFIG_PATH = path.join(__dirname, 'config.json');

// Đọc cấu hình từ file
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Lỗi khi đọc config.json:', err);
  }
  return {};
}

// Lưu cấu hình vào file
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Lỗi khi ghi config.json:', err);
    return false;
  }
}

let appConfig = loadConfig();
if (!appConfig.tiktok) appConfig.tiktok = {};
if (!appConfig.tiktok.username) appConfig.tiktok.username = 'hanguyxn';
if (!appConfig.bot) {
  appConfig.bot = {
    enabled: false,
    stayDurationSec: 60,
    maxBots: 10,
    autoLeave: true
  };
}

// Thống kê phòng live hiện tại
let liveStats = {
  viewers: 0,
  totalPoints: appConfig.leaderboard?.reduce((sum, item) => sum + item.points, 0) || 0,
  likes: appConfig.goals?.likeCurrent || 0,
  shares: appConfig.goals?.shareCurrent || 0,
  title: '',
  roomId: '',
  isLive: false,
  streamer: {
    nickname: '',
    uniqueId: '',
    avatar: ''
  },
  cover: '',
  activeDevotees: []
};

// Quản lý kết nối TikTok Live
let tiktokConnection = null;
let currentUsername = appConfig.tiktok?.username || 'hanguyxn';
let connectionStatus = 'disconnected'; // 'connected' | 'connecting' | 'disconnected'
let roomInfoSyncInterval = null;

// Hàm phân tích dữ liệu phòng Live từ TikTok API
function extractRoomInfoData(roomInfo, fallbackUsername = '') {
  if (!roomInfo) return null;
  const data = roomInfo.data || roomInfo;
  const owner = data.owner || {};
  const coverUrl = data.cover?.url_list?.[0] || data.cover?.url_list_large?.[0] || '';
  const avatarUrl = owner.avatar_thumb?.url_list?.[0] || owner.avatar_large?.url_list?.[0] || '';
  const isLive = data.status === 2;

  return {
    roomId: String(data.id_str || data.id || ''),
    title: data.title || '',
    status: data.status || 0, // 2 = đang LIVE, 4 = offline/kết thúc
    isLive,
    viewers: typeof data.user_count === 'number' ? data.user_count : 0,
    totalViewers: typeof data.total_user === 'number' ? data.total_user : 0,
    likes: typeof data.like_count === 'number' ? data.like_count : 0,
    streamer: {
      nickname: owner.nickname || fallbackUsername,
      uniqueId: owner.display_id || fallbackUsername,
      avatar: avatarUrl
    },
    cover: coverUrl
  };
}

// Cập nhật roomInfo vào liveStats và phát socket cho các client
function applyRoomInfoToStats(info) {
  if (!info) return;
  if (typeof info.viewers === 'number' && info.viewers >= 0) {
    liveStats.viewers = info.viewers;
  }
  if (typeof info.likes === 'number' && info.likes > 0) {
    liveStats.likes = info.likes;
    if (appConfig.goals) appConfig.goals.likeCurrent = liveStats.likes;
  }
  if (info.title) liveStats.title = info.title;
  if (info.streamer) liveStats.streamer = info.streamer;
  if (info.cover) liveStats.cover = info.cover;
  if (info.roomId) liveStats.roomId = info.roomId;
  liveStats.isLive = info.isLive;

  io.emit('room_info_updated', liveStats);
}

// Bắt đầu chu kỳ định kỳ đồng bộ thông tin phòng (mỗi 25 giây)
function startRoomInfoSyncInterval() {
  if (roomInfoSyncInterval) clearInterval(roomInfoSyncInterval);
  roomInfoSyncInterval = setInterval(async () => {
    if (tiktokConnection && connectionStatus === 'connected') {
      try {
        const raw = await tiktokConnection.fetchRoomInfo();
        const info = extractRoomInfoData(raw, currentUsername);
        if (info) {
          applyRoomInfoToStats(info);
        }
      } catch (err) {
        // bỏ qua lỗi im lặng khi sync định kỳ
      }
    }
  }, 25000);
}

function stopRoomInfoSyncInterval() {
  if (roomInfoSyncInterval) {
    clearInterval(roomInfoSyncInterval);
    roomInfoSyncInterval = null;
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cache lưu trữ các file âm thanh giọng đọc tiếng Việt (giúp phát tức thì 0ms)
const ttsCache = new Map();

// API Đọc Tiếng Việt Miễn Phí (Google Translate TTS tiếng Việt chuẩn 100%)
app.get('/api/tts', async (req, res) => {
  const text = (req.query.text || '').trim();
  if (!text) {
    return res.status(400).send('Missing text');
  }

  // Nếu đã có trong cache, trả về ngay lập tức
  if (ttsCache.has(text)) {
    const cached = ttsCache.get(text);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(cached);
  }

  try {
    const encoded = encodeURIComponent(text.slice(0, 180));
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=vi&client=tw-ob`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Google TTS status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Lưu cache (tối đa 300 câu)
    if (ttsCache.size > 300) {
      const firstKey = ttsCache.keys().next().value;
      ttsCache.delete(firstKey);
    }
    ttsCache.set(text, buffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err) {
    console.error('[TTS] Lỗi lấy giọng đọc tiếng Việt:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Routes API
app.get('/api/config', (req, res) => {
  res.json({ success: true, config: appConfig, liveStats, connectionStatus, username: currentUsername });
});

app.post('/api/config', (req, res) => {
  try {
    const newConfig = { ...appConfig, ...req.body };
    appConfig = newConfig;
    saveConfig(appConfig);
    io.emit('config_updated', appConfig);
    res.json({ success: true, config: appConfig });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/leaderboard/reset', (req, res) => {
  appConfig.leaderboard = [];
  liveStats.totalPoints = 0;
  saveConfig(appConfig);
  io.emit('leaderboard_updated', { leaderboard: [], totalPoints: 0 });
  res.json({ success: true });
});

// Bật / Tắt Phật tử ảo (Bot simulation)
app.post('/api/bot/toggle', (req, res) => {
  const isEnabled = typeof req.body.enabled === 'boolean' ? req.body.enabled : !appConfig.bot?.enabled;
  if (!appConfig.bot) appConfig.bot = {};
  appConfig.bot.enabled = isEnabled;
  if (req.body.stayDurationSec) appConfig.bot.stayDurationSec = Number(req.body.stayDurationSec);
  if (req.body.maxBots) appConfig.bot.maxBots = Number(req.body.maxBots);
  saveConfig(appConfig);
  io.emit('bot_updated', appConfig.bot);
  io.emit('config_updated', appConfig);
  console.log(`[Bot] Trạng thái Phật tử ảo: ${isEnabled ? '🟢 BẬT' : '🔴 TẮT'}`);
  res.json({ success: true, bot: appConfig.bot });
});

// Cho Phật tử ra về / dọn trống chánh điện
app.post('/api/visitors/clear', (req, res) => {
  io.emit('clear_all_visitors');
  res.json({ success: true, message: 'Đã phát lệnh cho toàn bộ Phật tử ra về' });
});

app.post('/api/visitors/leave', (req, res) => {
  io.emit('visitor_leave_requested', req.body || {});
  res.json({ success: true, message: 'Đã phát lệnh cho 1 Phật tử ra về' });
});

// ========================================================
// QUẢN LÝ NHẠC CHÙA & TẢI FILE ÂM THANH
// ========================================================
const MUSIC_DIR = path.join(__dirname, 'public', 'assets', 'music');
if (!fs.existsSync(MUSIC_DIR)) {
  fs.mkdirSync(MUSIC_DIR, { recursive: true });
}

const musicStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, MUSIC_DIR);
  },
  filename: (req, file, cb) => {
    let original = file.originalname;
    try {
      original = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch (e) {}
    const ext = path.extname(original).toLowerCase();
    const base = path.basename(original, ext).replace(/[^\w\s\-\.\u00C0-\u1EF9]/gi, '').trim().replace(/\s+/g, '_');
    const safeName = `${base || 'nhac_chua'}_${Date.now()}${ext}`;
    cb(null, safeName);
  }
});

const uploadMusic = multer({
  storage: musicStorage,
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(mp3|m4a|wav|aac|ogg|flac|wma)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file âm thanh (.mp3, .m4a, .wav, .aac, .ogg)'));
    }
  }
});

function getMusicTracksList() {
  if (!fs.existsSync(MUSIC_DIR)) return [];
  const files = fs.readdirSync(MUSIC_DIR);
  const audioFiles = files.filter(f => /\.(mp3|m4a|wav|aac|ogg|flac)$/i.test(f));
  
  return audioFiles.map(file => {
    const fullPath = path.join(MUSIC_DIR, file);
    let size = 0;
    let mtime = 0;
    try {
      const stat = fs.statSync(fullPath);
      size = stat.size;
      mtime = stat.mtimeMs;
    } catch (e) {}

    const ext = path.extname(file);
    const base = path.basename(file, ext);
    let friendlyName = base.replace(/_/g, ' ');
    if (file === 'loi_phat_day.m4a') friendlyName = 'Lời Phật Dạy – Nửa Đời Còn Lại Hãy Sống Chậm & Bình Yên';
    else if (file === 'music1.mp3') friendlyName = 'Nhạc Thiền Tịnh Tâm 1';
    else if (file === 'music2.mp3') friendlyName = 'Nhạc Thiền Tịnh Tâm 2';

    return {
      fileName: file,
      name: friendlyName,
      size,
      sizeFormatted: (size / (1024 * 1024)).toFixed(1) + ' MB',
      url: `/assets/music/${file}`,
      isPlaying: file === (appConfig.currentTrack || 'loi_phat_day.m4a'),
      mtime
    };
  }).sort((a, b) => b.mtime - a.mtime);
}

// 1. Lấy danh sách nhạc
app.get('/api/music/list', (req, res) => {
  const tracks = getMusicTracksList();
  res.json({
    success: true,
    tracks,
    currentTrack: appConfig.currentTrack || (tracks[0]?.fileName || 'loi_phat_day.m4a')
  });
});

// 2. Tải nhạc mới lên
app.post('/api/music/upload', (req, res) => {
  uploadMusic.single('audioFile')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Chưa chọn file nhạc tải lên' });
    }
    console.log(`[Music] 🎵 Đã tải lên file nhạc mới: ${req.file.filename} (${(req.file.size / 1024 / 1024).toFixed(1)} MB)`);
    const tracks = getMusicTracksList();
    io.emit('music_list_updated', { tracks });
    res.json({
      success: true,
      message: 'Tải lên nhạc thành công!',
      file: req.file.filename,
      tracks
    });
  });
});

// 3. Chọn bài nhạc đang phát
app.post('/api/music/select', (req, res) => {
  const { fileName } = req.body;
  if (!fileName) return res.status(400).json({ success: false, error: 'Thiếu fileName' });
  const fullPath = path.join(MUSIC_DIR, fileName);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ success: false, error: 'File nhạc không tồn tại' });
  }
  appConfig.currentTrack = fileName;
  saveConfig(appConfig);
  const tracks = getMusicTracksList();
  const trackInfo = tracks.find(t => t.fileName === fileName) || { fileName, name: fileName, url: `/assets/music/${fileName}` };
  console.log(`[Music] 🎶 Đổi bài nhạc đang phát sang: "${trackInfo.name}" (${fileName})`);
  io.emit('change_music', {
    fileName,
    url: `/assets/music/${fileName}`,
    name: trackInfo.name
  });
  io.emit('music_list_updated', { tracks });
  res.json({ success: true, currentTrack: fileName, track: trackInfo });
});

// 4. Xóa bài nhạc
app.delete('/api/music/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return res.status(400).json({ success: false, error: 'Tên file không hợp lệ' });
  }
  const fullPath = path.join(MUSIC_DIR, fileName);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
      console.log(`[Music] 🗑 Đã xóa bài nhạc: ${fileName}`);
      if (appConfig.currentTrack === fileName) {
        appConfig.currentTrack = 'music1.mp3';
        saveConfig(appConfig);
      }
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  const tracks = getMusicTracksList();
  io.emit('music_list_updated', { tracks });
  res.json({ success: true, tracks });
});

// ========================================================
// QUẢN LÝ TEMPLATE BACKGROUND CHÁNH ĐIỆN
// ========================================================
const TEMPLE_TEMPLATES = [
  {
    id: 'classic',
    name: 'Chánh Điện Tam Bảo Hoàng Gia (Mặc định)',
    tag: 'Bản Chuẩn',
    desc: 'Tượng Phật vàng tôn nghiêm, bàn thờ hoa đăng, sàn gỗ lim sáng bóng hoàn toàn không đệm.',
    url: '/assets/template_classic.jpg',
    thumb: '/assets/thumb_classic.jpg'
  },
  {
    id: 'gold',
    name: 'Đại Điện Phật Quang Phổ Chiếu',
    tag: 'Dát Vàng 24K',
    desc: 'Kim thân Phật Tổ Thích Ca tọa đài sen lớn, ánh hào quang rực rỡ, sàn gỗ thênh thang lộng lẫy.',
    url: '/assets/template_gold.jpg',
    thumb: '/assets/thumb_gold.jpg'
  },
  {
    id: 'ancient',
    name: 'Đại Điện Cổ Tự Hoàng Gia',
    tag: 'Cổ Kính Trầm Mặc',
    desc: 'Kiến trúc chùa cổ cột rồng thếp vàng, đèn lồng đỏ ấm áp, đại hồng chung cổ kính.',
    url: '/assets/template_ancient.jpg',
    thumb: '/assets/thumb_ancient.jpg'
  },
  {
    id: 'quanam',
    name: 'Chánh Điện Quán Thế Âm Bồ Tát',
    tag: 'Thanh Tịnh Thoát Tục',
    desc: 'Đức Quán Âm Đại Bi ngự tòa sen ngọc bích an lành, thiền đường tịnh thủy thanh tao.',
    url: '/assets/template_quanam.jpg',
    thumb: '/assets/thumb_quanam.jpg'
  }
];

// Lấy danh sách template
app.get('/api/temple/templates', (req, res) => {
  const currentTemplate = appConfig.currentTemplate || 'classic';
  const templates = TEMPLE_TEMPLATES.map(t => ({
    ...t,
    isActive: t.id === currentTemplate
  }));
  res.json({
    success: true,
    templates,
    currentTemplate,
    currentBackground: appConfig.currentBackground || '/assets/template_classic.jpg'
  });
});

// Đổi template tức thì mà không cần reload
app.post('/api/temple/template', (req, res) => {
  const { templateId } = req.body;
  if (!templateId) return res.status(400).json({ success: false, error: 'Thiếu templateId' });
  const t = TEMPLE_TEMPLATES.find(tpl => tpl.id === templateId);
  if (!t) return res.status(404).json({ success: false, error: 'Template không tồn tại' });

  appConfig.currentTemplate = templateId;
  appConfig.currentBackground = t.url;
  saveConfig(appConfig);

  console.log(`[Template] 🖼️ Chuyển hình nền Chánh Điện sang: "${t.name}" (${t.url})`);

  io.emit('change_background', {
    templateId,
    backgroundUrl: t.url,
    name: t.name
  });

  res.json({
    success: true,
    message: `Đã đổi hình nền Chánh Điện sang "${t.name}" tức thì!`,
    currentTemplate: templateId,
    template: t
  });
});

// ========================================================
// ADMIN CHỦ ĐỘNG GỬI LỜI THOẠI / THÔNG BÁO CHÁNH ĐIỆN
// ========================================================
app.post('/api/admin/broadcast-speech', (req, res) => {
  const { text, speakerName } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, error: 'Nội dung lời thoại không được để trống' });
  }
  const cleanText = text.trim();
  const speaker = (speakerName || 'Thầy Trụ Trì').trim();
  console.log(`[Admin Thoại] 📢 [${speaker}]: "${cleanText}"`);
  
  io.emit('admin_speech', {
    text: cleanText,
    speakerName: speaker,
    timestamp: Date.now()
  });
  
  res.json({ success: true, message: `Đã phát lời thoại của ${speaker} ra Chánh Điện!` });
});

// ========================================================
// FETCH DANH SÁCH NGƯỜI TRONG LIVE THỦ CÔNG ĐỂ LOAD PHẬT TỬ
// ========================================================
app.post('/api/tiktok/fetch-viewers', async (req, res) => {
  try {
    let collectedUsers = [];
    const seenIds = new Set();

    // 1. Quét từ activeDevotees đã ghi nhận
    if (Array.isArray(liveStats.activeDevotees)) {
      liveStats.activeDevotees.forEach(u => {
        const uid = u.id || u.uniqueId || u.name;
        if (uid && !seenIds.has(uid)) {
          seenIds.add(uid);
          collectedUsers.push(u);
        }
      });
    }

    // 2. Quét từ kết nối TikTok trực tiếp
    if (tiktokConnection && connectionStatus === 'connected') {
      try {
        const info = await tiktokConnection.fetchRoomInfo();
        if (info) {
          const ranks = info.top_viewers || info.ranks || info.users || [];
          if (Array.isArray(ranks)) {
            ranks.forEach(r => {
              const u = extractTikTokUser(r);
              const uid = u.id || u.uniqueId || u.name;
              if (uid && !seenIds.has(uid)) {
                seenIds.add(uid);
                collectedUsers.push(u);
              }
            });
          }
        }
      } catch (err) {
        console.warn('[TikTok] Không thể gọi fetchRoomInfo khi quét thủ công:', err.message);
      }
    }

    // 3. Quét từ Bảng Công Đức
    if (Array.isArray(appConfig.leaderboard)) {
      appConfig.leaderboard.forEach(item => {
        const uid = item.id || item.name;
        if (uid && !seenIds.has(uid)) {
          seenIds.add(uid);
          collectedUsers.push({
            id: uid,
            name: item.name,
            nickname: item.nickname || item.name,
            uniqueId: item.name
          });
        }
      });
    }

    // 4. Bổ sung các thiện nam tín nữ để chánh điện đông vui trang nghiêm (sức chứa 70 chỗ)
    const targetCount = Math.max(25, Math.min(collectedUsers.length > 0 ? collectedUsers.length + 15 : 45, 65));
    const BUDDHIST_NAMES = [
      'Diệu Tâm', 'Quảng Thiện', 'Phúc An', 'Tịnh Viên', 'Chân Như',
      'Minh Đức', 'Huệ Tĩnh', 'Trí Hải', 'Tuệ Tâm', 'Liên Hoa',
      'Tịnh Tâm', 'Vạn Hạnh', 'Thường Lạc', 'Khánh An', 'An Nhiên',
      'Kim Cương', 'Thiện Duyên', 'Phước Lành', 'Tâm Bình', 'Diệu Âm',
      'Hạnh Phúc', 'Bình Yên', 'Bảo Quang', 'Đại Bi', 'Tự Tại'
    ];

    while (collectedUsers.length < targetCount) {
      const randIdx = Math.floor(Math.random() * BUDDHIST_NAMES.length);
      const name = BUDDHIST_NAMES[randIdx] + '_' + (Math.floor(Math.random() * 899) + 100);
      const uid = 'devotee_' + Math.random().toString(36).slice(2, 8);
      if (!seenIds.has(uid)) {
        seenIds.add(uid);
        collectedUsers.push({
          id: uid,
          name,
          nickname: name,
          uniqueId: uid,
          isManualFetched: true
        });
      }
    }

    liveStats.activeDevotees = collectedUsers.slice(0, 70);

    console.log(`[TikTok] 🔄 Quét thủ công danh sách người xem: nạp ${collectedUsers.length} phật tử vào Chánh Điện!`);

    io.emit('load_bulk_devotees', {
      viewers: collectedUsers,
      totalCount: collectedUsers.length,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      count: collectedUsers.length,
      viewers: collectedUsers,
      message: `Đã nạp thành công ${collectedUsers.length} phật tử vào Chánh Điện!`
    });
  } catch (err) {
    console.error('[TikTok] Lỗi khi quét danh sách người xem:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Phân tích Cookie TikTok (hỗ trợ cả sessionid riêng lẻ lẫn chuỗi cookie đầy đủ)
function parseTikTokCookie(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return null;
  const input = rawInput.trim();
  if (!input) return null;

  let sessionId = '';
  let ttTargetIdc = 'alisg';

  if (input.includes('sessionid=') || input.includes(';')) {
    input.split(';').forEach(part => {
      const [k, ...v] = part.trim().split('=');
      const key = k ? k.trim().toLowerCase() : '';
      const val = v ? v.join('=').trim() : '';
      if (key === 'sessionid' || key === 'sessionid_ss') {
        sessionId = val;
      } else if (key === 'tt-target-idc') {
        ttTargetIdc = val || 'alisg';
      }
    });
  } else {
    sessionId = input;
  }

  if (!sessionId) return null;
  return { sessionId, ttTargetIdc };
}

// Kết nối tới TikTok
app.post('/api/tiktok/connect', async (req, res) => {
  const { username, apiKey, cookie } = req.body;
  if (!username) {
    return res.status(400).json({ success: false, error: 'Vui lòng nhập TikTok username' });
  }

  const cleanUsername = username.replace(/^@/, '').trim();
  currentUsername = cleanUsername;
  const savedApiKey = apiKey !== undefined ? apiKey.trim() : (appConfig.tiktok?.apiKey || '');
  const savedCookie = cookie !== undefined ? cookie.trim() : (appConfig.tiktok?.cookie || '');
  
  appConfig.tiktok = {
    ...appConfig.tiktok,
    username: cleanUsername,
    apiKey: savedApiKey,
    cookie: savedCookie
  };
  saveConfig(appConfig);

  try {
    await startTikTokConnection(cleanUsername, savedApiKey, savedCookie);
    res.json({ success: true, status: connectionStatus, username: cleanUsername });
  } catch (err) {
    connectionStatus = 'disconnected';
    res.status(500).json({ success: false, error: err.message });
  }
});

// API kiểm tra thông tin buổi Live (trước khi bấm Kết Nối)
app.get('/api/tiktok/room-info', async (req, res) => {
  const username = (req.query.username || currentUsername || '').replace(/^@/, '').trim();
  const cookie = req.query.cookie || appConfig.tiktok?.cookie || '';
  const apiKey = req.query.apiKey || appConfig.tiktok?.apiKey || '';

  if (!username) {
    return res.status(400).json({ success: false, error: 'Vui lòng cung cấp username TikTok' });
  }

  try {
    const connOptions = {
      processInitialData: false,
      enableExtendedGiftInfo: false,
      fetchRoomInfoOnConnect: true,
      clientParams: {
        app_language: 'vi-VN',
        device_platform: 'web'
      }
    };
    const parsedCookie = parseTikTokCookie(cookie);
    if (parsedCookie) {
      connOptions.session = {
        cookie: {
          type: 'cookie',
          value: {
            sessionId: parsedCookie.sessionId,
            ttTargetIdc: parsedCookie.ttTargetIdc
          }
        }
      };
    }
    if (apiKey) {
      connOptions.signApiKey = apiKey;
    }

    const tempConn = new TikTokLiveConnection(username, connOptions);
    let roomId = '';
    try {
      roomId = await tempConn.fetchRoomId();
    } catch (e) {
      // Bỏ qua lỗi roomId
    }

    let rawInfo = null;
    if (roomId) {
      try {
        rawInfo = await tempConn.fetchRoomInfo();
      } catch (e) {
        console.warn(`[TikTok] Lỗi fetchRoomInfo cho @${username}:`, e.message);
      }
    }

    const info = extractRoomInfoData(rawInfo, username);
    if (info && roomId) {
      info.roomId = roomId;
    }

    if (connectionStatus === 'connected' && currentUsername.toLowerCase() === username.toLowerCase() && info) {
      applyRoomInfoToStats(info);
    }

    res.json({ success: true, roomInfo: info, isLive: info ? info.isLive : false });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Không thể lấy thông tin phòng Live' });
  }
});

// Ngắt kết nối TikTok
app.post('/api/tiktok/disconnect', async (req, res) => {
  try {
    stopRoomInfoSyncInterval();
    if (tiktokConnection) {
      tiktokConnection.disconnect();
      tiktokConnection = null;
    }
    connectionStatus = 'disconnected';
    liveStats.isLive = false;
    io.emit('tiktok_status', { status: 'disconnected', username: currentUsername });
    res.json({ success: true, status: 'disconnected' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trình giả lập sự kiện (cho streamer test trước khi live)
app.post('/api/simulate', (req, res) => {
  const { type, data } = req.body;
  handleSimulatedEvent(type, data);
  res.json({ success: true, message: `Đã giả lập sự kiện: ${type}` });
});

// Khởi tạo kết nối TikTok Live
async function startTikTokConnection(username, apiKey = '', cookie = '') {
  if (tiktokConnection) {
    try {
      tiktokConnection.disconnect();
    } catch (e) {
      // ignore
    }
    tiktokConnection = null;
  }

  connectionStatus = 'connecting';
  io.emit('tiktok_status', { status: 'connecting', username });
  console.log(`[TikTok] Đang kết nối tới phòng Live của: @${username}...`);

  const connectionOptions = {
    processInitialData: false,
    enableExtendedGiftInfo: false,
    fetchRoomInfoOnConnect: true,
    clientParams: {
      app_language: 'vi-VN',
      device_platform: 'web'
    }
  };

  const cookieToUse = cookie || appConfig.tiktok?.cookie;
  const parsedCookie = parseTikTokCookie(cookieToUse);
  if (parsedCookie) {
    connectionOptions.authenticateWs = false;
    connectionOptions.session = {
      cookie: {
        type: 'cookie',
        value: {
          sessionId: parsedCookie.sessionId,
          ttTargetIdc: parsedCookie.ttTargetIdc
        }
      }
    };
    console.log(`[TikTok] 🍪 Đã kích hoạt xác thực Cookie (Session ID: ${parsedCookie.sessionId.slice(0, 6)}***)`);
  }

  const keyToUse = apiKey || appConfig.tiktok?.apiKey;
  if (keyToUse) {
    connectionOptions.signApiKey = keyToUse;
    console.log(`[TikTok] 🔑 Sử dụng Euler Stream API Key.`);
  }

  tiktokConnection = new TikTokLiveConnection(username, connectionOptions);

  try {
    const state = await tiktokConnection.connect();
    connectionStatus = 'connected';
    console.log(`[TikTok] Kết nối thành công! Room ID: ${state.roomId}`);

    let roomInfoRaw = tiktokConnection.roomInfo || state.roomInfo;
    if (!roomInfoRaw || !roomInfoRaw.data) {
      try {
        roomInfoRaw = await tiktokConnection.fetchRoomInfo();
      } catch (e) {
        console.warn('[TikTok] Không thể gọi fetchRoomInfo bổ sung:', e.message);
      }
    }

    const info = extractRoomInfoData(roomInfoRaw, username);
    if (info) {
      info.roomId = state.roomId;
      applyRoomInfoToStats(info);
      console.log(`[TikTok] 📊 Live: "${info.title}" | Người xem: ${info.viewers} | Lượt tim: ${info.likes}`);
    }

    io.emit('tiktok_status', {
      status: 'connected',
      username,
      roomId: state.roomId,
      roomInfo: info
    });

    setupTikTokEventHandlers(tiktokConnection);
    startRoomInfoSyncInterval();
  } catch (err) {
    stopRoomInfoSyncInterval();
    connectionStatus = 'disconnected';
    console.error(`[TikTok] Lỗi kết nối tới @${username}:`, err.message || err);
    io.emit('tiktok_status', { status: 'disconnected', username, error: err.message || 'Không thể kết nối' });
    throw err;
  }
}

// Trích xuất thông tin người dùng TikTok chuẩn xác từ protobuf data
function extractTikTokUser(data) {
  const u = data.user || data.userDetails || data.memberMessage?.user || data.socialMessage?.user || {};
  const uniqueId = u.uniqueId || data.uniqueId || '';
  const nickname = u.nickname || data.nickname || '';
  const userId = u.userId || data.userId || uniqueId || ('user_' + Date.now() + Math.random().toString(36).slice(2, 6));
  const avatar = u.profilePictureUrl || data.profilePictureUrl || u.avatarThumb?.urlList?.[0] || '';

  // Ưu tiên hiển thị: Nickname thật của người dùng -> UniqueId TikTok (@username) -> "Phật tử"
  const displayName = nickname || uniqueId || 'Phật tử';

  return {
    id: String(userId),
    name: displayName,
    nickname: nickname || displayName,
    uniqueId: uniqueId || displayName,
    avatar
  };
}

// Thiết lập các sự kiện nhận từ TikTok Live
function setupTikTokEventHandlers(conn) {
  // 1. Bình luận (Chat)
  conn.on('chat', (data) => {
    const user = extractTikTokUser(data);
    const rawComment = data.comment || data.content || data.text || '';
    const comment = String(rawComment).trim() || '🙏';

    console.log(`[TikTok] 💬 ${user.name} (@${user.uniqueId}): "${comment}"`);
    trackActiveDevotee(user);

    io.emit('tiktok_chat', {
      user,
      comment,
      timestamp: Date.now()
    });
  });

  // 2. Tặng Quà (Gift)
  conn.on('gift', (data) => {
    if (data.giftType === 1 && !data.repeatEnd) {
      return;
    }

    const user = extractTikTokUser(data);
    const giftName = data.giftDetails?.giftName || data.giftName || 'Quà công đức';
    const repeatCount = data.repeatCount || 1;
    const diamonds = (data.diamondCount || 1) * repeatCount;

    console.log(`[TikTok] 🎁 ${user.name} tặng ${repeatCount}x ${giftName} (${diamonds} kim cương)`);
    processGiftEvent(user, giftName, repeatCount, diamonds);
  });

  // 3. Thả Tim (Like)
  conn.on('like', (data) => {
    const likeCount = data.likeCount || 1;
    const officialTotal = parseInt(data.total || data.totalLikeCount, 10);
    if (!isNaN(officialTotal) && officialTotal > liveStats.likes) {
      liveStats.likes = officialTotal;
    } else {
      liveStats.likes += likeCount;
    }
    if (appConfig.goals) appConfig.goals.likeCurrent = liveStats.likes;

    const user = extractTikTokUser(data);
    trackActiveDevotee(user);

    io.emit('tiktok_like', {
      user,
      likeCount,
      totalLikes: liveStats.likes,
      goal: appConfig.goals?.likeGoal || 1000
    });

    if (appConfig.goals && liveStats.likes >= appConfig.goals.likeGoal) {
      triggerGoalReward('like', appConfig.goals.likeReward);
    }
  });

  // 4. Người Xem Trực Tiếp (Room User)
  conn.on('roomUser', (data) => {
    const rawTotal = data.total ?? data.viewerCount;
    const count = parseInt(rawTotal, 10);
    if (!isNaN(count) && count >= 0) {
      liveStats.viewers = count;
      io.emit('viewer_count_updated', {
        viewers: liveStats.viewers,
        totalUser: data.totalUser ? parseInt(data.totalUser, 10) : undefined
      });
    }

    // Tự động đưa người xem trực tiếp vào chánh điện
    const viewersList = data.topViewers || data.ranksList || [];
    if (Array.isArray(viewersList)) {
      viewersList.forEach(vData => {
        const u = extractTikTokUser(vData);
        if (u && (u.name || u.uniqueId)) {
          trackActiveDevotee(u);
          io.emit('tiktok_member', { user: u, action: 'đang trong chánh điện' });
        }
      });
    }
  });

  // 5. Chia sẻ (Share)
  conn.on('share', (data) => {
    liveStats.shares += 1;
    if (appConfig.goals) appConfig.goals.shareCurrent = liveStats.shares;

    const user = extractTikTokUser(data);
    console.log(`[TikTok] 🔗 ${user.name} đã chia sẻ buổi live!`);
    trackActiveDevotee(user);

    io.emit('tiktok_share', {
      user,
      totalShares: liveStats.shares,
      goal: appConfig.goals?.shareGoal || 200
    });

    if (appConfig.goals && liveStats.shares >= appConfig.goals.shareGoal) {
      triggerGoalReward('share', appConfig.goals.shareReward);
    }
  });

  // 6. Vào phòng Live (Member Join)
  conn.on('member', (data) => {
    if (typeof data.memberCount === 'number' && data.memberCount > 0) {
      liveStats.viewers = data.memberCount;
      io.emit('viewer_count_updated', { viewers: liveStats.viewers });
    }

    const user = extractTikTokUser(data);
    console.log(`[TikTok] 🚶 Phật tử vào chánh điện: "${user.name}" (@${user.uniqueId})`);

    trackActiveDevotee(user);

    io.emit('tiktok_member', {
      user,
      action: 'vừa vào chánh điện',
      totalDevotees: liveStats.viewers
    });
  });

  // 6b. Khách hoặc tương tác phòng live (Social / Unauthorized)
  conn.on('social', (data) => {
    const user = extractTikTokUser(data);
    trackActiveDevotee(user);
    io.emit('tiktok_member', {
      user,
      action: 'vừa tương tác với buổi live',
      totalDevotees: liveStats.viewers
    });
  });

  conn.on('unauthorizedMember', (data) => {
    const user = extractTikTokUser(data);
    trackActiveDevotee(user);
    io.emit('tiktok_member', {
      user,
      action: 'vừa vào chánh điện',
      totalDevotees: liveStats.viewers
    });
  });

  // 7. Theo dõi (Follow)
  conn.on('follow', (data) => {
    const user = extractTikTokUser(data);
    console.log(`[TikTok] ➕ ${user.name} vừa bấm Follow kênh!`);
    trackActiveDevotee(user);
    io.emit('tiktok_follow', { user });
  });

  // 8. Lỗi & Ngắt kết nối
  conn.on('disconnected', () => {
    stopRoomInfoSyncInterval();
    connectionStatus = 'disconnected';
    console.log('[TikTok] Đã ngắt kết nối.');
    io.emit('tiktok_status', { status: 'disconnected', username: currentUsername });
  });

  conn.on('streamEnd', () => {
    stopRoomInfoSyncInterval();
    connectionStatus = 'disconnected';
    liveStats.isLive = false;
    console.log('[TikTok] Livestream kết thúc.');
    io.emit('tiktok_status', { status: 'disconnected', username: currentUsername, message: 'Livestream kết thúc' });
    io.emit('room_info_updated', liveStats);
  });

  conn.on('error', (err) => {
    console.error('[TikTok] Lỗi sự kiện:', err);
    io.emit('tiktok_error', { error: err.message || 'Lỗi kết nối' });
  });
}

// Xử lý logic khi nhận quà
function processGiftEvent(user, rawGiftName, repeatCount, diamonds) {
  const normalizedName = rawGiftName.toLowerCase().trim();
  const matchedGift = appConfig.gifts?.find(g => {
    if (!g.enabled) return false;
    const nameMatch = g.giftName.toLowerCase() === normalizedName;
    const keyMatch = g.tiktokKey && normalizedName.includes(g.tiktokKey.toLowerCase());
    const reverseMatch = g.tiktokKey && g.tiktokKey.toLowerCase().includes(normalizedName);
    return nameMatch || keyMatch || reverseMatch;
  }) || {
    id: 'gift_default',
    giftName: rawGiftName || 'Quà công đức',
    icon: '🎁',
    actionName: 'Dâng phẩm vật',
    actionType: 'incense',
    points: Math.max(1, diamonds || 1),
    sound: 'bell_soft',
    description: 'Dâng phẩm vật cúng dường Tam Bảo'
  };

  const pointsEarned = (matchedGift.points || 1) * repeatCount;
  liveStats.totalPoints += pointsEarned;

  updateLeaderboard(user, pointsEarned);
  trackActiveDevotee(user);

  const prayersList = (appConfig.prayers && appConfig.prayers.length > 0) ? appConfig.prayers : [
    "Cầu cho thân tâm thường an lạc, tật bệnh tiêu trừ, vạn sự hanh thông.",
    "Cầu cho gia đạo bình an, phúc lộc dồi dào, thuận buồm xuôi gió.",
    "Cầu cho phụ mẫu tăng long phúc thọ, gia đình êm ấm, sở cầu như ý.",
    "Cầu cho công danh sự nghiệp hanh thông, tài lộc phát đạt, tai qua nạn khỏi.",
    "Cầu cho con cháu hiếu thuận thành đạt, phúc đức đời đời hưng thịnh.",
    "Cầu Đức Phật từ bi gia hộ độ trì cho gia quyến vạn sự cát tường như ý.",
    "Cầu cho tâm bồ đề kiên cố, trí tuệ sáng suốt, phước duyên tràn đầy.",
    "Cầu cho quý phật tử bốn mùa an khang, tám tiết thịnh vượng, bình an may mắn."
  ];
  const prayer = matchedGift.customPrayer || prayersList[Math.floor(Math.random() * prayersList.length)];

  console.log(`[Công Đức] ${user.nickname} (${user.name}) tặng ${repeatCount}x ${matchedGift.giftName} -> +${pointsEarned} công đức! Lời cầu nguyện: "${prayer}"`);

  io.emit('gift_triggered', {
    user,
    gift: matchedGift,
    repeatCount,
    points: pointsEarned,
    totalPoints: liveStats.totalPoints,
    prayer,
    leaderboard: appConfig.leaderboard
  });
}

// Cập nhật Bảng Công Đức
function updateLeaderboard(user, points) {
  if (!appConfig.leaderboard) {
    appConfig.leaderboard = [];
  }

  let record = appConfig.leaderboard.find(item => item.id === user.id || item.name.toLowerCase() === user.name.toLowerCase());
  if (record) {
    record.points += points;
    record.name = user.name;
    record.nickname = user.nickname || record.nickname;
  } else {
    appConfig.leaderboard.push({
      id: user.id,
      name: user.name,
      nickname: user.nickname || user.name,
      points: points
    });
  }

  appConfig.leaderboard.sort((a, b) => b.points - a.points);

  if (appConfig.leaderboard.length > 15) {
    appConfig.leaderboard = appConfig.leaderboard.slice(0, 15);
  }

  saveConfig(appConfig);
}

// Lưu vết phật tử đang lễ
function trackActiveDevotee(user) {
  if (!user || (!user.name && !user.nickname && !user.uniqueId)) return;
  const existingIndex = liveStats.activeDevotees.findIndex(d => (d.id && user.id && d.id === user.id) || d.name === user.name);
  if (existingIndex >= 0) {
    liveStats.activeDevotees[existingIndex].lastActive = Date.now();
  } else {
    liveStats.activeDevotees.push({
      ...user,
      lastActive: Date.now()
    });
    if (liveStats.activeDevotees.length > 100) {
      liveStats.activeDevotees.shift();
    }
  }
}

// Kích hoạt phần thưởng mục tiêu
let lastGoalTrigger = { like: 0, share: 0 };
function triggerGoalReward(type, rewardName) {
  const now = Date.now();
  if (now - lastGoalTrigger[type] < 15000) return;
  lastGoalTrigger[type] = now;

  console.log(`[Mục Tiêu] Đã đạt mục tiêu ${type.toUpperCase()}: ${rewardName}!`);
  io.emit('goal_reached', {
    type,
    reward: rewardName,
    timestamp: now
  });
}

// Xử lý sự kiện giả lập (Simulator)
function handleSimulatedEvent(type, data = {}) {
  const defaultUser = {
    id: data.userId || 'sim_' + Math.floor(Math.random() * 1000),
    name: data.userName || 'Phật_Tử_' + Math.floor(Math.random() * 900 + 100),
    nickname: data.userNickname || 'Diệu Tâm',
    avatar: ''
  };

  switch (type) {
    case 'gift': {
      const giftConfig = appConfig.gifts?.find(g => g.id === data.giftId) || (appConfig.gifts && appConfig.gifts[0]) || { giftName: 'Hoa Sen', points: 10 };
      const repeatCount = data.repeatCount || 1;
      processGiftEvent(defaultUser, giftConfig.giftName, repeatCount, (giftConfig.points || 1) * repeatCount);
      break;
    }

    case 'chat': {
      let chatUser = defaultUser;
      if (!data.userName && liveStats.activeDevotees && liveStats.activeDevotees.length > 0) {
        chatUser = liveStats.activeDevotees[Math.floor(Math.random() * liveStats.activeDevotees.length)];
      }
      const comments = [
        'Nam Mô A Di Đà Phật 🙏',
        'Con kính cẩn dâng hương cầu bình an',
        'Cầu cho cha mẹ mạnh khỏe an khang',
        'A Di Đà Phật, con sám hối nghiệp chướng',
        'Con kính lễ Tam Bảo mười phương chư Phật 🙏✨',
        'Nguyện đem công đức này hướng về khắp tất cả'
      ];
      const commentText = data.comment || comments[Math.floor(Math.random() * comments.length)];
      trackActiveDevotee(chatUser);
      io.emit('tiktok_chat', {
        user: chatUser,
        comment: commentText,
        timestamp: Date.now()
      });
      break;
    }

    case 'like': {
      const count = data.count || 50;
      liveStats.likes += count;
      if (appConfig.goals) appConfig.goals.likeCurrent = liveStats.likes;
      io.emit('tiktok_like', {
        user: defaultUser,
        likeCount: count,
        totalLikes: liveStats.likes,
        goal: appConfig.goals?.likeGoal || 1000
      });
      if (appConfig.goals && liveStats.likes >= appConfig.goals.likeGoal) {
        triggerGoalReward('like', appConfig.goals.likeReward);
      }
      break;
    }

    case 'share': {
      liveStats.shares += 1;
      if (appConfig.goals) appConfig.goals.shareCurrent = liveStats.shares;
      io.emit('tiktok_share', {
        user: defaultUser,
        totalShares: liveStats.shares,
        goal: appConfig.goals?.shareGoal || 200
      });
      if (appConfig.goals && liveStats.shares >= appConfig.goals.shareGoal) {
        triggerGoalReward('share', appConfig.goals.shareReward);
      }
      break;
    }

    case 'member': {
      const sampleNames = [
        'Diệu Hạnh', 'Minh Tâm', 'Thiện Đức', 'Huệ An',
        'Tịnh Nhã', 'Quảng Trí', 'Thanh Trúc', 'Liên Hoa',
        'Ngọc Mai', 'Quang Khải', 'Bảo Châu', 'Hoài An',
        'Trúc Lâm', 'Phúc Lâm', 'Diệu Âm', 'Hạnh Nguyện'
      ];
      const randomName = data.userNickname || data.userName || sampleNames[Math.floor(Math.random() * sampleNames.length)];
      const memberUser = {
        id: data.userId || 'sim_' + Math.floor(Math.random() * 1000),
        name: randomName,
        nickname: randomName,
        avatar: ''
      };
      trackActiveDevotee(memberUser);
      io.emit('tiktok_member', {
        user: memberUser,
        action: 'vừa vào chánh điện',
        totalDevotees: liveStats.viewers
      });
      break;
    }

    case 'halo': {
      triggerGoalReward('like', appConfig.goals?.likeReward || 'Phật phát hào quang');
      break;
    }

    case 'gold_rain': {
      triggerGoalReward('share', appConfig.goals?.shareReward || 'Mưa vàng hoa sen');
      break;
    }

    case 'leave': {
      io.emit('visitor_leave_requested', data);
      break;
    }

    case 'clear': {
      io.emit('clear_all_visitors');
      break;
    }

    case 'toggle_bot': {
      if (!appConfig.bot) appConfig.bot = {};
      appConfig.bot.enabled = data.enabled !== undefined ? data.enabled : !appConfig.bot.enabled;
      saveConfig(appConfig);
      io.emit('bot_updated', appConfig.bot);
      io.emit('config_updated', appConfig);
      break;
    }

    default:
      console.log('Sự kiện giả lập không xác định:', type);
  }
}

// Socket.IO kết nối
io.on('connection', (socket) => {
  socket.emit('init_state', {
    config: appConfig,
    liveStats,
    connectionStatus,
    username: currentUsername
  });

  socket.on('update_settings', (newSettings) => {
    appConfig = { ...appConfig, ...newSettings };
    saveConfig(appConfig);
    io.emit('config_updated', appConfig);
  });

  socket.on('toggle_bot', (enabled) => {
    if (!appConfig.bot) appConfig.bot = {};
    appConfig.bot.enabled = typeof enabled === 'boolean' ? enabled : !appConfig.bot.enabled;
    saveConfig(appConfig);
    io.emit('bot_updated', appConfig.bot);
    io.emit('config_updated', appConfig);
    console.log(`[Bot] Socket toggle Phật tử ảo: ${appConfig.bot.enabled ? '🟢 BẬT' : '🔴 TẮT'}`);
  });

  socket.on('clear_visitors', () => {
    io.emit('clear_all_visitors');
  });

  socket.on('evict_visitor', (data) => {
    io.emit('visitor_leave_requested', data || {});
  });
});

// Khởi chạy server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🛕 CHÙA ONLINE TIKTOK LIVE STUDIO (CHÁNH ĐIỆN 2.5D)`);
  console.log(`======================================================`);
  console.log(`▶ Màn Hình Chánh Điện (9:16 Canvas):  http://localhost:${PORT}/app.html`);
  console.log(`▶ Bảng Quản Trị & Kết Nối TikTok:     http://localhost:${PORT}/admin.html`);
  console.log(`======================================================\n`);
});
