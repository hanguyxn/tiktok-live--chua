/* ========================================================
   BẢNG QUẢN TRỊ - CHÙA ONLINE 2.5D TIKTOK LIVE STUDIO
   ======================================================== */

const socket = io();

let currentConfig = {};
let currentLiveStats = {};
let currentEditingGiftId = null;

// Tab Navigation
const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
const tabPanes = document.querySelectorAll('.tab-pane');
const pageTitle = document.getElementById('page-title');
const pageDesc = document.getElementById('page-desc');

const tabMeta = {
  'tab-tiktok': {
    title: '📡 Kết Nối TikTok Live',
    desc: 'Nhập Username kênh TikTok để bắt đầu truyền dữ liệu vào màn hình Chánh Điện 2.5D'
  },
  'tab-studio': {
    title: '🎥 Hướng Dẫn Phát Live Bằng TikTok LIVE Studio',
    desc: 'Sử dụng ứng dụng chính thức TikTok LIVE Studio trên máy tính để phát sóng Chánh Điện chuẩn 1080x1920 sắc nét'
  },
  'tab-simulator': {
    title: '🎮 Trình Giả Lập Test',
    desc: 'Thử nghiệm phật tử bước đi, an tọa, cúi đầu lễ Phật, chuông mõ và cánh sen trước khi live'
  },
  'tab-gifts': {
    title: '🎁 Cài Đặt Quà & Nghi Lễ',
    desc: 'Tùy chỉnh quà TikTok nào kích hoạt nghi lễ nào và số điểm công đức tương ứng'
  },
  'tab-goals': {
    title: '🎯 Thiết Lập Mục Tiêu',
    desc: 'Cấu hình mốc thả tim và chia sẻ nhận phước lành Hào Quang Phật / Mưa Sen'
  },
  'tab-leaderboard': {
    title: '🏆 Bảng Công Đức & Top 1',
    desc: 'Quản lý danh sách Phật tử, Top 1 sẽ tự động nhận vương miện 👑 vàng trên thẻ tên'
  },
  'tab-music': {
    title: '🎵 Quản Lý Thư Viện Nhạc Chùa',
    desc: 'Tải lên các file âm thanh và chủ động chọn bài nhạc đang phát ra luồng Chánh Điện'
  },
  'tab-speech': {
    title: '📢 Admin Chủ Động Phát Thoại Ra Chánh Điện',
    desc: 'Phát giọng đọc AI (TTS) và hiển thị thẻ lời thoại của Thầy Trụ Trì ra luồng trực tiếp'
  },
  'tab-templates': {
    title: '🖼️ Chọn Template Background Chánh Điện',
    desc: 'Chuyển đổi hình nền Chánh Điện trực tiếp theo thời gian thực (real-time) không cần tải lại trang'
  },
  'tab-temple': {
    title: '⚙️ Cài Đặt Chung',
    desc: 'Tùy chỉnh tên chùa, lời tựa, chuông mõ và các bảng hiển thị'
  }
};

navItems.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetTab = btn.getAttribute('data-tab');

    navItems.forEach(i => i.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    const pane = document.getElementById(targetTab);
    if (pane) pane.classList.add('active');

    if (tabMeta[targetTab]) {
      pageTitle.textContent = tabMeta[targetTab].title;
      pageDesc.textContent = tabMeta[targetTab].desc;
    }
  });
});

// Copy WebApp URL
const copyObsBtn = document.getElementById('copy-obs-url-btn');
const obsUrlInput = document.getElementById('obs-url-input');
if (copyObsBtn && obsUrlInput) {
  copyObsBtn.addEventListener('click', () => {
    obsUrlInput.select();
    navigator.clipboard.writeText(obsUrlInput.value);
    const oldText = copyObsBtn.textContent;
    copyObsBtn.textContent = '✅ Đã Copy!';
    setTimeout(() => { copyObsBtn.textContent = oldText; }, 2000);
  });
}

// ========================================================
// KẾT NỐI TIKTOK
// ========================================================

const tiktokUsernameInput = document.getElementById('tiktok-username-input');
const tiktokCookieInput = document.getElementById('tiktok-cookie-input');
const tiktokApikeyInput = document.getElementById('tiktok-apikey-input');
const btnConnectTiktok = document.getElementById('btn-connect-tiktok');
const btnDisconnectTiktok = document.getElementById('btn-disconnect-tiktok');
const btnCheckRoom = document.getElementById('btn-check-room');
const connStatusPill = document.getElementById('conn-status-pill');
const connStatusText = document.getElementById('conn-status-text');

// Live preview elements
const livePreviewCard = document.getElementById('live-preview-card');
const previewStreamerAvatar = document.getElementById('preview-streamer-avatar');
const previewStreamerName = document.getElementById('preview-streamer-name');
const previewStatusBadge = document.getElementById('preview-status-badge');
const previewRoomTitle = document.getElementById('preview-room-title');
const previewViewers = document.getElementById('preview-viewers');
const previewLikes = document.getElementById('preview-likes');
const previewRoomId = document.getElementById('preview-room-id');

// Detail box
const liveStreamerName = document.getElementById('live-streamer-name');
const liveRoomTitle = document.getElementById('live-room-title');
const liveRoomStatus = document.getElementById('live-room-status');
const liveRoomId = document.getElementById('live-room-id');
const liveViewersCount = document.getElementById('live-viewers-count');
const liveLikesCount = document.getElementById('live-likes-count');

// Kiểm tra thông tin phòng Live
if (btnCheckRoom) {
  btnCheckRoom.addEventListener('click', async () => {
    const rawUser = tiktokUsernameInput.value.trim();
    if (!rawUser) {
      alert('Vui lòng nhập Username TikTok cần kiểm tra!');
      return;
    }
    const cleanUser = rawUser.replace(/^@/, '').trim();
    const cookie = tiktokCookieInput ? tiktokCookieInput.value.trim() : '';
    const apiKey = tiktokApikeyInput ? tiktokApikeyInput.value.trim() : '';

    btnCheckRoom.disabled = true;
    btnCheckRoom.textContent = '⏳ Đang quét...';

    try {
      const q = new URLSearchParams({ username: cleanUser });
      if (cookie) q.append('cookie', cookie);
      if (apiKey) q.append('apiKey', apiKey);

      const res = await fetch(`/api/tiktok/room-info?${q.toString()}`);
      const data = await res.json();

      if (data.success && data.roomInfo) {
        updateLivePreviewUI(data.roomInfo);
      } else {
        alert(`Không tìm thấy phòng Live của @${cleanUser} hoặc phòng chưa mở.\nChi tiết: ${data.error || 'Offline'}`);
      }
    } catch (err) {
      alert('Lỗi kiểm tra thông tin: ' + err.message);
    } finally {
      btnCheckRoom.disabled = false;
      btnCheckRoom.textContent = '🔍 Kiểm Tra Phòng Live';
    }
  });
}

function updateLivePreviewUI(info) {
  if (!livePreviewCard) return;
  livePreviewCard.style.display = 'block';

  if (previewStreamerAvatar) {
    previewStreamerAvatar.src = info.streamer?.avatar || 'assets/monk_master.png';
  }
  if (previewStreamerName) {
    previewStreamerName.textContent = info.streamer?.nickname || info.streamer?.uniqueId || '--';
  }
  if (previewRoomTitle) {
    previewRoomTitle.textContent = info.title || '(Chưa có tiêu đề)';
  }
  if (previewViewers) {
    previewViewers.textContent = Number(info.viewers || 0).toLocaleString('vi-VN');
  }
  if (previewLikes) {
    previewLikes.textContent = Number(info.likes || 0).toLocaleString('vi-VN');
  }
  if (previewRoomId) {
    previewRoomId.textContent = info.roomId || '--';
  }
  if (previewStatusBadge) {
    if (info.isLive) {
      previewStatusBadge.style.background = '#27ae60';
      previewStatusBadge.textContent = '🟢 ĐANG LIVE';
    } else {
      previewStatusBadge.style.background = '#7f8c8d';
      previewStatusBadge.textContent = '⚪ CHƯA LIVE (OFFLINE)';
    }
  }
}

// Bấm Kết Nối
btnConnectTiktok?.addEventListener('click', async () => {
  const rawUser = tiktokUsernameInput.value.trim();
  if (!rawUser) {
    alert('Vui lòng nhập Username kênh TikTok!');
    return;
  }
  const cleanUsername = rawUser.replace(/^@/, '').trim();
  const cookie = tiktokCookieInput ? tiktokCookieInput.value.trim() : '';
  const apiKey = tiktokApikeyInput ? tiktokApikeyInput.value.trim() : '';

  setConnectionUI('connecting', cleanUsername);

  try {
    const res = await fetch('/api/tiktok/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUsername, cookie, apiKey })
    });
    const data = await res.json();
    if (!data.success) {
      alert('Không thể kết nối tới phòng TikTok Live: ' + (data.error || 'Lỗi không xác định'));
      setConnectionUI('disconnected', cleanUsername);
    }
  } catch (err) {
    alert('Lỗi kết nối server: ' + err.message);
    setConnectionUI('disconnected', cleanUsername);
  }
});

// Bấm Ngắt Kết Nối
btnDisconnectTiktok?.addEventListener('click', async () => {
  try {
    await fetch('/api/tiktok/disconnect', { method: 'POST' });
    setConnectionUI('disconnected', tiktokUsernameInput.value);
  } catch (err) {
    alert('Lỗi khi ngắt kết nối: ' + err.message);
  }
});

function setConnectionUI(status, username) {
  if (!connStatusPill || !connStatusText) return;
  connStatusPill.className = `connection-status-pill ${status}`;

  if (status === 'connected') {
    connStatusText.textContent = `Đang kết nối: @${username}`;
    if (btnConnectTiktok) btnConnectTiktok.style.display = 'none';
    if (btnDisconnectTiktok) btnDisconnectTiktok.style.display = 'inline-block';
    if (liveRoomStatus) {
      liveRoomStatus.textContent = '🟢 Đã kết nối';
      liveRoomStatus.style.color = '#00ff88';
    }
  } else if (status === 'connecting') {
    connStatusText.textContent = `Đang kết nối @${username}...`;
    if (btnConnectTiktok) btnConnectTiktok.disabled = true;
    if (liveRoomStatus) {
      liveRoomStatus.textContent = '⏳ Đang kết nối...';
      liveRoomStatus.style.color = '#ffd700';
    }
  } else {
    connStatusText.textContent = 'Chưa kết nối TikTok';
    if (btnConnectTiktok) {
      btnConnectTiktok.style.display = 'inline-block';
      btnConnectTiktok.disabled = false;
    }
    if (btnDisconnectTiktok) btnDisconnectTiktok.style.display = 'none';
    if (liveRoomStatus) {
      liveRoomStatus.textContent = '⚪ Đã ngắt kết nối';
      liveRoomStatus.style.color = '#aaa';
    }
  }
}

// ========================================================
// TRÌNH GIẢ LẬP TEST (SIMULATOR)
// ========================================================

const simGiftsGrid = document.getElementById('sim-gifts-grid');
const simChatBtn = document.getElementById('sim-chat-btn');
const simMemberBtn = document.getElementById('sim-member-btn');
const simLikeBtn = document.getElementById('sim-like-btn');
const simShareBtn = document.getElementById('sim-share-btn');
const simHaloBtn = document.getElementById('sim-halo-btn');
const simGoldBtn = document.getElementById('sim-gold-btn');

function renderSimulatorGifts(gifts) {
  if (!simGiftsGrid) return;
  simGiftsGrid.innerHTML = '';
  gifts.forEach(gift => {
    if (!gift.enabled) return;
    const btn = document.createElement('button');
    btn.className = 'sim-btn';
    btn.innerHTML = `
      <span class="sim-icon">${gift.icon || '🎁'}</span>
      <div class="sim-btn-info">
        <strong>${gift.giftName}</strong>
        <small>${gift.actionName} (+${gift.points}đ)</small>
      </div>
    `;
    btn.addEventListener('click', () => {
      fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'gift',
          data: { giftId: gift.id, repeatCount: 1 }
        })
      });
      // Flash effect
      btn.style.borderColor = '#00ff88';
      setTimeout(() => { btn.style.borderColor = ''; }, 300);
    });
    simGiftsGrid.appendChild(btn);
  });
}

simChatBtn?.addEventListener('click', () => {
  fetch('/api/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'chat' }) });
});

simMemberBtn?.addEventListener('click', () => {
  fetch('/api/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'member' }) });
});

simLikeBtn?.addEventListener('click', () => {
  fetch('/api/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'like', data: { count: 50 } }) });
});

simShareBtn?.addEventListener('click', () => {
  fetch('/api/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'share' }) });
});

simHaloBtn?.addEventListener('click', () => {
  fetch('/api/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'halo' }) });
});

simGoldBtn?.addEventListener('click', () => {
  fetch('/api/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'gold_rain' }) });
});

const simLeaveBtn = document.getElementById('sim-leave-btn');
const simClearBtn = document.getElementById('sim-clear-btn');

simLeaveBtn?.addEventListener('click', () => {
  fetch('/api/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'leave' }) });
});

simClearBtn?.addEventListener('click', () => {
  fetch('/api/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'clear' }) });
});

// ========================================================
// QUẢN LÝ QUÀ TẶNG & NGHI LỄ
// ========================================================

const giftsTableBody = document.getElementById('gifts-table-body');
const btnAddGift = document.getElementById('btn-add-gift');
const btnSaveGifts = document.getElementById('btn-save-gifts');

// Modal Elements
const giftModal = document.getElementById('gift-modal');
const modalTitle = document.getElementById('modal-title');
const modalGiftId = document.getElementById('modal-gift-id');
const modalGiftName = document.getElementById('modal-gift-name');
const modalGiftKey = document.getElementById('modal-gift-key');
const modalGiftIcon = document.getElementById('modal-gift-icon');
const modalActionName = document.getElementById('modal-action-name');
const modalActionType = document.getElementById('modal-action-type');
const modalGiftPoints = document.getElementById('modal-gift-points');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalSaveBtn = document.getElementById('modal-save-btn');

function renderGiftsTable(gifts) {
  if (!giftsTableBody) return;
  giftsTableBody.innerHTML = '';
  gifts.forEach((gift, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <input type="checkbox" ${gift.enabled ? 'checked' : ''} data-index="${index}" class="gift-toggle-chk">
      </td>
      <td style="font-size: 20px;">${gift.icon || '🎁'}</td>
      <td><strong>${gift.giftName}</strong></td>
      <td><code>${gift.tiktokKey || '--'}</code></td>
      <td><span class="badge-tag">${gift.actionName || '--'}</span></td>
      <td><small style="color: #ffd700;">${gift.actionType || 'lotus'}</small></td>
      <td><strong style="color: #00ff88;">+${gift.points || 1}</strong></td>
      <td>
        <button class="btn-sm btn-outline edit-gift-btn" data-id="${gift.id}">✏️ Sửa</button>
        <button class="btn-sm btn-danger delete-gift-btn" data-id="${gift.id}">🗑️</button>
      </td>
    `;
    giftsTableBody.appendChild(tr);
  });

  // Bind toggle
  document.querySelectorAll('.gift-toggle-chk').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const idx = e.target.getAttribute('data-index');
      currentConfig.gifts[idx].enabled = e.target.checked;
    });
  });

  // Bind edit
  document.querySelectorAll('.edit-gift-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openGiftModal(id);
    });
  });

  // Bind delete
  document.querySelectorAll('.delete-gift-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Bạn có chắc muốn xóa quà này khỏi danh sách?')) {
        currentConfig.gifts = currentConfig.gifts.filter(g => g.id !== id);
        renderGiftsTable(currentConfig.gifts);
        renderSimulatorGifts(currentConfig.gifts);
      }
    });
  });
}

function openGiftModal(giftId = null) {
  currentEditingGiftId = giftId;
  if (giftId) {
    const gift = currentConfig.gifts.find(g => g.id === giftId);
    if (!gift) return;
    modalTitle.textContent = 'Chỉnh Sửa Quà & Nghi Lễ';
    modalGiftId.value = gift.id;
    modalGiftName.value = gift.giftName;
    modalGiftKey.value = gift.tiktokKey || '';
    modalGiftIcon.value = gift.icon || '';
    modalActionName.value = gift.actionName;
    modalActionType.value = gift.actionType || 'lotus';
    modalGiftPoints.value = gift.points || 1;
  } else {
    modalTitle.textContent = 'Thêm Quà Mới';
    modalGiftId.value = 'gift_' + Date.now();
    modalGiftName.value = '';
    modalGiftKey.value = '';
    modalGiftIcon.value = '🪷';
    modalActionName.value = 'Dâng hoa sen';
    modalActionType.value = 'lotus';
    modalGiftPoints.value = 10;
  }
  giftModal.classList.add('active');
}

function closeGiftModal() {
  giftModal.classList.remove('active');
}

modalCloseBtn?.addEventListener('click', closeGiftModal);
modalCancelBtn?.addEventListener('click', closeGiftModal);

modalSaveBtn?.addEventListener('click', () => {
  const id = modalGiftId.value;
  const giftName = modalGiftName.value.trim();
  const tiktokKey = modalGiftKey.value.trim().toLowerCase();
  const icon = modalGiftIcon.value.trim() || '🎁';
  const actionName = modalActionName.value.trim() || 'Dâng phẩm vật';
  const actionType = modalActionType.value;
  const points = parseInt(modalGiftPoints.value, 10) || 1;

  if (!giftName) {
    alert('Vui lòng nhập tên quà TikTok!');
    return;
  }

  if (currentEditingGiftId) {
    const idx = currentConfig.gifts.findIndex(g => g.id === currentEditingGiftId);
    if (idx >= 0) {
      currentConfig.gifts[idx] = {
        ...currentConfig.gifts[idx],
        giftName,
        tiktokKey,
        icon,
        actionName,
        actionType,
        points
      };
    }
  } else {
    currentConfig.gifts.push({
      id,
      giftName,
      tiktokKey,
      icon,
      actionName,
      actionType,
      points,
      enabled: true
    });
  }

  renderGiftsTable(currentConfig.gifts);
  renderSimulatorGifts(currentConfig.gifts);
  closeGiftModal();
});

btnAddGift?.addEventListener('click', () => openGiftModal(null));

btnSaveGifts?.addEventListener('click', async () => {
  btnSaveGifts.disabled = true;
  btnSaveGifts.textContent = '⏳ Đang lưu...';
  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gifts: currentConfig.gifts })
    });
    alert('✅ Đã lưu cấu hình quà tặng thành công!');
  } catch (err) {
    alert('Lỗi lưu cấu hình: ' + err.message);
  } finally {
    btnSaveGifts.disabled = false;
    btnSaveGifts.textContent = '💾 Lưu Cấu Hình Quà Tặng';
  }
});

// ========================================================
// THIẾT LẬP MỤC TIÊU
// ========================================================

const inputLikeGoal = document.getElementById('input-like-goal');
const inputLikeCurrent = document.getElementById('input-like-current');
const inputLikeReward = document.getElementById('input-like-reward');
const inputShareGoal = document.getElementById('input-share-goal');
const inputShareCurrent = document.getElementById('input-share-current');
const inputShareReward = document.getElementById('input-share-reward');
const btnSaveGoals = document.getElementById('btn-save-goals');

btnSaveGoals?.addEventListener('click', async () => {
  const goals = {
    likeGoal: parseInt(inputLikeGoal.value, 10) || 1000,
    likeCurrent: parseInt(inputLikeCurrent.value, 10) || 0,
    likeReward: inputLikeReward.value.trim() || 'Phật phát hào quang',
    shareGoal: parseInt(inputShareGoal.value, 10) || 50,
    shareCurrent: parseInt(inputShareCurrent.value, 10) || 0,
    shareReward: inputShareReward.value.trim() || 'Mưa sen thanh tịnh'
  };

  btnSaveGoals.disabled = true;
  btnSaveGoals.textContent = '⏳ Đang lưu...';
  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goals })
    });
    alert('✅ Đã lưu mục tiêu thành công!');
  } catch (err) {
    alert('Lỗi lưu mục tiêu: ' + err.message);
  } finally {
    btnSaveGoals.disabled = false;
    btnSaveGoals.textContent = '💾 Lưu Mục Tiêu';
  }
});

// ========================================================
// BẢNG CÔNG ĐỨC
// ========================================================

const leaderboardTableBody = document.getElementById('leaderboard-table-body');
const btnResetLeaderboard = document.getElementById('btn-reset-leaderboard');

function renderLeaderboardTable(list) {
  if (!leaderboardTableBody) return;
  leaderboardTableBody.innerHTML = '';
  if (!list || list.length === 0) {
    leaderboardTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #aaa;">Chưa có Phật tử nào trong bảng công đức hôm nay.</td></tr>`;
    return;
  }

  list.forEach((item, index) => {
    const tr = document.createElement('tr');
    let rankBadge = `${index + 1}`;
    let roleText = 'Bồ đoàn thường';

    if (index === 0) {
      rankBadge = '🥇';
      roleText = '👑 Vương Miện Vàng (Top 1)';
    } else if (index === 1) {
      rankBadge = '🥈';
      roleText = '✨ Tấm Lòng Thành (Top 2)';
    } else if (index === 2) {
      rankBadge = '🥉';
      roleText = '✨ Tấm Lòng Thành (Top 3)';
    }

    tr.innerHTML = `
      <td style="font-size: 18px; font-weight: bold;">${rankBadge}</td>
      <td><span class="badge-tag" style="background: ${index === 0 ? '#ffd700' : 'rgba(217, 164, 65, 0.2)'}; color: ${index === 0 ? '#000' : '#ffd700'};">${roleText}</span></td>
      <td><strong>${item.name || '--'}</strong></td>
      <td>${item.nickname || item.name || '--'}</td>
      <td><strong style="color: #00ff88; font-size: 15px;">${item.points.toLocaleString('vi-VN')}</strong></td>
    `;
    leaderboardTableBody.appendChild(tr);
  });
}

btnResetLeaderboard?.addEventListener('click', async () => {
  if (confirm('Bạn có chắc muốn Reset toàn bộ điểm Bảng Công Đức về 0 để đón ngày mới?')) {
    try {
      await fetch('/api/leaderboard/reset', { method: 'POST' });
      currentConfig.leaderboard = [];
      renderLeaderboardTable([]);
      alert('✅ Đã reset Bảng Công Đức thành công!');
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
  }
});

// ========================================================
// CÀI ĐẶT CHUNG (TEMPLE & GIỌNG NÓI AI)
// ========================================================

const inputTempleName = document.getElementById('input-temple-name');
const inputTempleSub = document.getElementById('input-temple-sub');
const chkAutoChant = document.getElementById('chk-auto-chant');
const chkShowLeaderboard = document.getElementById('chk-show-leaderboard');
const chkTtsMember = document.getElementById('chk-tts-member');
const chkTtsGift = document.getElementById('chk-tts-gift');
const inputTtsTemplate = document.getElementById('input-tts-template');
const inputTtsSpeed = document.getElementById('input-tts-speed');
const valTtsSpeed = document.getElementById('val-tts-speed');
const btnSaveTemple = document.getElementById('btn-save-temple');

inputTtsSpeed?.addEventListener('input', (e) => {
  if (valTtsSpeed) {
    valTtsSpeed.textContent = (parseFloat(e.target.value) / 100).toFixed(2) + 'x';
  }
});

btnSaveTemple?.addEventListener('click', async () => {
  const temple = {
    name: inputTempleName.value.trim() || 'Chùa Online',
    subTitle: inputTempleSub.value.trim() || 'Tịnh tâm - Tích đức - Cầu an'
  };

  const tts = {
    enabledMember: chkTtsMember ? chkTtsMember.checked : true,
    enabledGift: chkTtsGift ? chkTtsGift.checked : true,
    memberTemplate: inputTtsTemplate ? inputTtsTemplate.value.trim() : 'Hoan nghênh {name} vào chánh điện',
    speed: inputTtsSpeed ? parseFloat(inputTtsSpeed.value) / 100 : 1.05,
    pitch: 1.0
  };

  btnSaveTemple.disabled = true;
  btnSaveTemple.textContent = '⏳ Đang lưu...';
  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temple, tts })
    });
    alert('✅ Đã lưu cài đặt chùa và giọng nói AI thành công!');
  } catch (err) {
    alert('Lỗi lưu cài đặt: ' + err.message);
  } finally {
    btnSaveTemple.disabled = false;
    btnSaveTemple.textContent = '💾 Lưu Cài Đặt';
  }
});

// ========================================================
// QUẢN LÝ PHẬT TỬ ẢO (BOT) & VÀO / RA CHÁNH ĐIỆN
// ========================================================

const btnHeaderBotToggle = document.getElementById('btn-header-bot-toggle');
const headerBotDot = document.getElementById('header-bot-dot');
const headerBotLabel = document.getElementById('header-bot-label');
const chkBotEnabled = document.getElementById('chk-bot-enabled');
const inputBotStay = document.getElementById('input-bot-stay');
const inputBotMax = document.getElementById('input-bot-max');
const btnSaveBot = document.getElementById('btn-save-bot');
const btnQuickEvict = document.getElementById('btn-quick-evict');
const btnQuickClear = document.getElementById('btn-quick-clear');

function updateBotUI(bot) {
  const isEnabled = Boolean(bot && bot.enabled);
  if (chkBotEnabled) chkBotEnabled.checked = isEnabled;
  if (headerBotDot) headerBotDot.style.background = isEnabled ? '#00ff88' : '#e74c3c';
  if (headerBotLabel) headerBotLabel.textContent = isEnabled ? 'Bot Phật tử: ĐANG BẬT' : 'Bot Phật tử: TẮT';
  if (inputBotStay && bot && bot.stayDurationSec) inputBotStay.value = bot.stayDurationSec;
  if (inputBotMax && bot && bot.maxBots) inputBotMax.value = bot.maxBots;
}

btnHeaderBotToggle?.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/bot/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const data = await res.json();
    if (data.success && data.bot) {
      updateBotUI(data.bot);
    }
  } catch (e) {
    alert('Lỗi toggle bot: ' + e.message);
  }
});

btnSaveBot?.addEventListener('click', async () => {
  const bot = {
    enabled: chkBotEnabled ? chkBotEnabled.checked : false,
    stayDurationSec: inputBotStay ? parseInt(inputBotStay.value, 10) || 60 : 60,
    maxBots: inputBotMax ? parseInt(inputBotMax.value, 10) || 10 : 10
  };
  btnSaveBot.disabled = true;
  btnSaveBot.textContent = '⏳ Đang lưu...';
  try {
    const res = await fetch('/api/bot/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bot)
    });
    const data = await res.json();
    if (data.success && data.bot) {
      updateBotUI(data.bot);
      alert('✅ Đã lưu cài đặt Phật tử ảo thành công!');
    }
  } catch (err) {
    alert('Lỗi: ' + err.message);
  } finally {
    btnSaveBot.disabled = false;
    btnSaveBot.textContent = '💾 Lưu Cài Đặt Bot';
  }
});

btnQuickEvict?.addEventListener('click', () => {
  fetch('/api/visitors/leave', { method: 'POST' });
});

btnQuickClear?.addEventListener('click', () => {
  if (confirm('Cho toàn bộ Phật tử hiện tại đứng dậy rời khỏi Chánh Điện?')) {
    fetch('/api/visitors/clear', { method: 'POST' });
  }
});

// ========================================================
// SOCKET SYNC STATE
// ========================================================

socket.on('init_state', (data) => {
  currentConfig = data.config || {};
  currentLiveStats = data.liveStats || {};

  if (currentConfig.bot) {
    updateBotUI(currentConfig.bot);
  }

  // Cập nhật cấu hình lên giao diện
  if (currentConfig.tiktok) {
    if (tiktokUsernameInput) tiktokUsernameInput.value = currentConfig.tiktok.username || 'hanguyxn';
    if (tiktokCookieInput) tiktokCookieInput.value = currentConfig.tiktok.cookie || '';
    if (tiktokApikeyInput) tiktokApikeyInput.value = currentConfig.tiktok.apiKey || '';
  }

  if (currentConfig.gifts) {
    renderGiftsTable(currentConfig.gifts);
    renderSimulatorGifts(currentConfig.gifts);
  }

  if (currentConfig.goals) {
    if (inputLikeGoal) inputLikeGoal.value = currentConfig.goals.likeGoal || 1000;
    if (inputLikeCurrent) inputLikeCurrent.value = currentConfig.goals.likeCurrent || 0;
    if (inputLikeReward) inputLikeReward.value = currentConfig.goals.likeReward || 'Phật phát hào quang';
    if (inputShareGoal) inputShareGoal.value = currentConfig.goals.shareGoal || 50;
    if (inputShareCurrent) inputShareCurrent.value = currentConfig.goals.shareCurrent || 0;
    if (inputShareReward) inputShareReward.value = currentConfig.goals.shareReward || 'Mưa sen thanh tịnh';
  }

  if (currentConfig.leaderboard) {
    renderLeaderboardTable(currentConfig.leaderboard);
  }

  if (currentConfig.prayers) {
    renderPrayersTable(currentConfig.prayers);
  }
  loadMusicList();
  loadTemplatesList();
  loadFortuneSettings();
  loadCleanupSettings();

  if (currentConfig.temple) {
    if (inputTempleName) inputTempleName.value = currentConfig.temple.name || 'Chùa Online';
    if (inputTempleSub) inputTempleSub.value = currentConfig.temple.subTitle || 'Tịnh tâm - Tích đức - Cầu an';
  }

  if (currentConfig.tts) {
    if (chkTtsMember) chkTtsMember.checked = currentConfig.tts.enabledMember !== false;
    if (chkTtsGift) chkTtsGift.checked = currentConfig.tts.enabledGift !== false;
    if (inputTtsTemplate) inputTtsTemplate.value = currentConfig.tts.memberTemplate || 'Hoan nghênh {name} vào chánh điện';
    if (inputTtsSpeed) {
      const spd = Math.round((currentConfig.tts.speed || 1.05) * 100);
      inputTtsSpeed.value = spd;
      if (valTtsSpeed) valTtsSpeed.textContent = (spd / 100).toFixed(2) + 'x';
    }
  }

  setConnectionUI(data.connectionStatus || 'disconnected', data.username || currentConfig.tiktok?.username || 'hanguyxn');
});

socket.on('tiktok_status', (data) => {
  setConnectionUI(data.status, data.username || tiktokUsernameInput.value);
  if (data.roomInfo) {
    updateLivePreviewUI(data.roomInfo);
  }
});

socket.on('room_info_updated', (stats) => {
  currentLiveStats = stats;
  if (stats.streamer && liveStreamerName) {
    liveStreamerName.textContent = stats.streamer.nickname || stats.streamer.uniqueId || '--';
  }
  if (stats.title && liveRoomTitle) {
    liveRoomTitle.textContent = stats.title;
  }
  if (stats.roomId && liveRoomId) {
    liveRoomId.textContent = stats.roomId;
  }
  if (liveViewersCount) {
    liveViewersCount.textContent = Number(stats.viewers || 0).toLocaleString('vi-VN');
  }
  if (liveLikesCount) {
    liveLikesCount.textContent = Number(stats.likes || 0).toLocaleString('vi-VN');
  }
  updateLivePreviewUI(stats);
});

socket.on('viewer_count_updated', (data) => {
  if (data && typeof data.viewers === 'number' && liveViewersCount) {
    liveViewersCount.textContent = Number(data.viewers).toLocaleString('vi-VN');
  }
});

socket.on('leaderboard_updated', (data) => {
  if (data && data.leaderboard) {
    renderLeaderboardTable(data.leaderboard);
  }
});

socket.on('bot_updated', (bot) => {
  if (currentConfig) currentConfig.bot = bot;
  updateBotUI(bot);
});

// ========================================================
// 1. FETCH DANH SÁCH NGƯỜI XEM TRONG LIVE THỦ CÔNG
// ========================================================
const btnFetchViewers = document.getElementById('btn-fetch-viewers');
const fetchViewersAlert = document.getElementById('fetch-viewers-alert');

if (btnFetchViewers) {
  btnFetchViewers.addEventListener('click', async () => {
    btnFetchViewers.disabled = true;
    const oldText = btnFetchViewers.textContent;
    btnFetchViewers.textContent = '⏳ Đang Quét Người Xem...';
    if (fetchViewersAlert) {
      fetchViewersAlert.style.display = 'block';
      fetchViewersAlert.textContent = 'Đang quét danh sách người xem trên phòng Live và chuẩn bị chỗ an tọa...';
    }

    try {
      const res = await fetch('/api/tiktok/fetch-viewers', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (fetchViewersAlert) {
          fetchViewersAlert.style.display = 'block';
          fetchViewersAlert.textContent = `✅ ${data.message}`;
          setTimeout(() => { if (fetchViewersAlert) fetchViewersAlert.style.display = 'none'; }, 6000);
        }
      } else {
        if (fetchViewersAlert) {
          fetchViewersAlert.style.display = 'block';
          fetchViewersAlert.textContent = `❌ ${data.error || 'Không thể quét danh sách'}`;
        }
      }
    } catch (err) {
      if (fetchViewersAlert) {
        fetchViewersAlert.style.display = 'block';
        fetchViewersAlert.textContent = `❌ Lỗi kết nối: ${err.message}`;
      }
    } finally {
      btnFetchViewers.disabled = false;
      btnFetchViewers.textContent = oldText;
    }
  });
}

// ========================================================
// 2. QUẢN LÝ DANH SÁCH CÂU CẦU AN KHI TẶNG QUÀ
// ========================================================
const prayersTableBody = document.getElementById('prayers-table-body');
const newPrayerInput = document.getElementById('new-prayer-input');
const btnAddPrayer = document.getElementById('btn-add-prayer');

function renderPrayersTable(prayers) {
  if (!prayersTableBody) return;
  prayersTableBody.innerHTML = '';
  if (!Array.isArray(prayers) || prayers.length === 0) {
    prayersTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #999; padding: 15px;">Chưa có câu cầu an nào. Hãy thêm câu mới bên trên.</td></tr>';
    return;
  }

  prayers.forEach((text, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align: center; color: #ffd700; font-weight: bold;">${idx + 1}</td>
      <td style="color: #fff8e7;">${text}</td>
      <td style="text-align: center;">
        <button class="btn-sm btn-danger btn-delete-prayer" data-index="${idx}">🗑 Xóa</button>
      </td>
    `;
    prayersTableBody.appendChild(tr);
  });

  document.querySelectorAll('.btn-delete-prayer').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.getAttribute('data-index'), 10);
      if (isNaN(index)) return;
      if (!confirm('Bạn có chắc muốn xóa câu cầu an này?')) return;
      currentConfig.prayers.splice(index, 1);
      renderPrayersTable(currentConfig.prayers);
      await savePrayersConfig();
    });
  });
}

async function savePrayersConfig() {
  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prayers: currentConfig.prayers })
    });
  } catch (e) {
    console.error('Lỗi lưu prayers:', e);
  }
}

if (btnAddPrayer && newPrayerInput) {
  btnAddPrayer.addEventListener('click', async () => {
    const text = newPrayerInput.value.trim();
    if (!text) {
      alert('Vui lòng nhập nội dung câu cầu an');
      return;
    }
    if (!currentConfig.prayers) currentConfig.prayers = [];
    currentConfig.prayers.push(text);
    newPrayerInput.value = '';
    renderPrayersTable(currentConfig.prayers);
    await savePrayersConfig();
  });

  newPrayerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnAddPrayer.click();
    }
  });
}

// ========================================================
// 3. QUẢN LÝ NHẠC CHÙA & UPLOAD FILE
// ========================================================
const btnBrowseMusic = document.getElementById('btn-browse-music');
const musicFileInput = document.getElementById('music-file-input');
const musicFileChosen = document.getElementById('music-file-chosen');
const btnUploadMusic = document.getElementById('btn-upload-music');
const uploadMusicProgress = document.getElementById('upload-music-progress');
const musicTableBody = document.getElementById('music-table-body');
const adminAudioPlayer = document.getElementById('admin-audio-player');
const adminAudioName = document.getElementById('admin-audio-name');
const adminAudioElement = document.getElementById('admin-audio-element');

let currentMusicTracks = [];

async function loadMusicList() {
  if (!musicTableBody) return;
  try {
    const res = await fetch('/api/music/list');
    const data = await res.json();
    if (data.success && Array.isArray(data.tracks)) {
      currentMusicTracks = data.tracks;
      renderMusicTable(data.tracks, data.currentTrack);
    }
  } catch (err) {
    console.error('Lỗi tải danh sách nhạc:', err);
    musicTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #ff6b6b; padding: 15px;">Lỗi kết nối tải danh sách nhạc</td></tr>';
  }
}

function renderMusicTable(tracks, currentTrack) {
  if (!musicTableBody) return;
  musicTableBody.innerHTML = '';
  if (tracks.length === 0) {
    musicTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999; padding: 20px;">Chưa có file nhạc nào trong thư viện.</td></tr>';
    return;
  }

  tracks.forEach(track => {
    const isPlaying = track.fileName === currentTrack || track.isPlaying;
    const tr = document.createElement('tr');
    tr.style.background = isPlaying ? 'rgba(0, 255, 136, 0.08)' : '';
    tr.innerHTML = `
      <td>
        <strong style="color: ${isPlaying ? '#00ff88' : '#ffd700'};">${track.name}</strong>
        <div style="font-size: 11px; color: #888; font-family: monospace;">${track.fileName}</div>
      </td>
      <td style="color: #ccc; font-size: 13px;">${track.sizeFormatted || '--'}</td>
      <td style="text-align: center;">
        ${isPlaying 
          ? '<span style="display: inline-block; padding: 3px 10px; border-radius: 12px; background: #27ae60; color: #fff; font-size: 11px; font-weight: bold;">▶ ĐANG PHÁT</span>'
          : '<span style="display: inline-block; padding: 3px 10px; border-radius: 12px; background: rgba(255, 255, 255, 0.1); color: #aaa; font-size: 11px;">Đang chờ</span>'
        }
      </td>
      <td style="text-align: center;">
        <div style="display: flex; gap: 6px; justify-content: center;">
          ${!isPlaying 
            ? `<button class="btn-sm btn-primary btn-select-track" data-file="${track.fileName}" style="background: #27ae60; border-color: #219653;">▶ Phát Bài Này</button>`
            : '<button class="btn-sm" disabled style="opacity: 0.6; cursor: default;">✅ Đang Live</button>'
          }
          <button class="btn-sm btn-secondary btn-preview-track" data-file="${track.fileName}" data-name="${track.name}" data-url="${track.url}">🔊 Nghe</button>
          <button class="btn-sm btn-danger btn-delete-track" data-file="${track.fileName}">🗑</button>
        </div>
      </td>
    `;
    musicTableBody.appendChild(tr);
  });

  // Gắn sự kiện chọn phát bài
  document.querySelectorAll('.btn-select-track').forEach(btn => {
    btn.addEventListener('click', async () => {
      const fileName = btn.getAttribute('data-file');
      if (!fileName) return;
      btn.disabled = true;
      btn.textContent = '⏳ Đang đổi...';
      try {
        const res = await fetch('/api/music/select', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName })
        });
        const data = await res.json();
        if (data.success) {
          loadMusicList();
        } else {
          alert('Không thể đổi bài nhạc: ' + (data.error || 'Lỗi'));
        }
      } catch (err) {
        alert('Lỗi kết nối: ' + err.message);
      }
    });
  });

  // Gắn sự kiện nghe thử trên admin
  document.querySelectorAll('.btn-preview-track').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      const name = btn.getAttribute('data-name');
      if (!url || !adminAudioElement || !adminAudioPlayer) return;
      adminAudioPlayer.style.display = 'flex';
      if (adminAudioName) adminAudioName.textContent = name;
      adminAudioElement.src = url;
      adminAudioElement.play().catch(e => console.warn('Preview error:', e));
    });
  });

  // Gắn sự kiện xóa bài
  document.querySelectorAll('.btn-delete-track').forEach(btn => {
    btn.addEventListener('click', async () => {
      const fileName = btn.getAttribute('data-file');
      if (!fileName) return;
      if (!confirm(`Bạn có chắc muốn xóa file nhạc "${fileName}"?`)) return;
      try {
        const res = await fetch('/api/music/' + encodeURIComponent(fileName), { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          loadMusicList();
        } else {
          alert('Không thể xóa file: ' + (data.error || 'Lỗi'));
        }
      } catch (err) {
        alert('Lỗi khi xóa file: ' + err.message);
      }
    });
  });
}

// Xử lý chọn file upload
if (btnBrowseMusic && musicFileInput) {
  btnBrowseMusic.addEventListener('click', () => musicFileInput.click());
  musicFileInput.addEventListener('change', () => {
    const file = musicFileInput.files[0];
    if (file) {
      if (musicFileChosen) musicFileChosen.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
      if (btnUploadMusic) btnUploadMusic.style.display = 'inline-block';
    } else {
      if (musicFileChosen) musicFileChosen.textContent = 'Chưa chọn file';
      if (btnUploadMusic) btnUploadMusic.style.display = 'none';
    }
  });
}

// Xử lý tải lên file nhạc
if (btnUploadMusic && musicFileInput) {
  btnUploadMusic.addEventListener('click', async () => {
    const file = musicFileInput.files[0];
    if (!file) {
      alert('Vui lòng chọn file âm thanh');
      return;
    }
    const formData = new FormData();
    formData.append('audioFile', file);

    btnUploadMusic.disabled = true;
    btnUploadMusic.textContent = '⏳ Đang Tải Lên...';
    if (uploadMusicProgress) {
      uploadMusicProgress.style.display = 'block';
      uploadMusicProgress.style.color = '#00ff88';
      uploadMusicProgress.textContent = `Đang tải lên "${file.name}"... Vui lòng chờ trong giây lát.`;
    }

    try {
      const res = await fetch('/api/music/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        if (uploadMusicProgress) {
          uploadMusicProgress.textContent = `✅ Tải lên bài nhạc "${file.name}" thành công!`;
          setTimeout(() => { if (uploadMusicProgress) uploadMusicProgress.style.display = 'none'; }, 4000);
        }
        musicFileInput.value = '';
        if (musicFileChosen) musicFileChosen.textContent = 'Chưa chọn file';
        if (btnUploadMusic) btnUploadMusic.style.display = 'none';
        loadMusicList();
      } else {
        if (uploadMusicProgress) {
          uploadMusicProgress.style.color = '#ff6b6b';
          uploadMusicProgress.textContent = `❌ Lỗi tải lên: ${data.error || 'Không xác định'}`;
        }
      }
    } catch (err) {
      if (uploadMusicProgress) {
        uploadMusicProgress.style.color = '#ff6b6b';
        uploadMusicProgress.textContent = `❌ Lỗi kết nối tải lên: ${err.message}`;
      }
    } finally {
      btnUploadMusic.disabled = false;
      btnUploadMusic.textContent = '⬆️ Tải Lên Ngay';
    }
  });
}

socket.on('music_list_updated', (data) => {
  if (data && Array.isArray(data.tracks)) {
    renderMusicTable(data.tracks, currentConfig.currentTrack);
  }
});

// ========================================================
// 4. ADMIN CHỦ ĐỘNG GỬI LỜI THOẠI (TTS & THÔNG BÁO)
// ========================================================
const adminSpeechText = document.getElementById('admin-speech-text');
const adminSpeechSpeaker = document.getElementById('admin-speech-speaker');
const btnBroadcastSpeech = document.getElementById('btn-broadcast-speech');
const btnPreviewSpeech = document.getElementById('btn-preview-speech');
const speechStatusMsg = document.getElementById('speech-status-msg');

// Bấm câu gợi ý để điền nhanh
document.querySelectorAll('.quick-speech-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const text = chip.getAttribute('data-text');
    if (text && adminSpeechText) {
      adminSpeechText.value = text;
      adminSpeechText.focus();
    }
  });
});

// Phát giọng nói ra Chánh Điện
if (btnBroadcastSpeech && adminSpeechText) {
  btnBroadcastSpeech.addEventListener('click', async () => {
    const text = adminSpeechText.value.trim();
    if (!text) {
      alert('Vui lòng nhập nội dung lời thoại');
      return;
    }
    const speakerName = (adminSpeechSpeaker?.value || 'Thầy Trụ Trì').trim();

    btnBroadcastSpeech.disabled = true;
    btnBroadcastSpeech.textContent = '⏳ Đang Phát Ra Chánh Điện...';
    if (speechStatusMsg) speechStatusMsg.textContent = '';

    try {
      const res = await fetch('/api/admin/broadcast-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, speakerName })
      });
      const data = await res.json();
      if (data.success) {
        if (speechStatusMsg) {
          speechStatusMsg.textContent = `✅ Đã phát thành công ra Chánh Điện!`;
          setTimeout(() => { if (speechStatusMsg) speechStatusMsg.textContent = ''; }, 5000);
        }
      } else {
        alert('Lỗi: ' + (data.error || 'Không thể phát'));
      }
    } catch (err) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      btnBroadcastSpeech.disabled = false;
      btnBroadcastSpeech.textContent = '📢 Phát Giọng Nói (TTS) Ra Chánh Điện';
    }
  });
}

// Nghe thử giọng đọc trên máy Admin (Web Speech API)
if (btnPreviewSpeech && adminSpeechText) {
  btnPreviewSpeech.addEventListener('click', () => {
    const text = adminSpeechText.value.trim();
    if (!text) {
      alert('Vui lòng nhập lời thoại để nghe thử');
      return;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'vi-VN';
      u.rate = 1.05;
      const viVoice = window.speechSynthesis.getVoices().find(v => v.lang.includes('vi') || v.lang.includes('VN'));
      if (viVoice) u.voice = viVoice;
      window.speechSynthesis.speak(u);
    } else {
      alert('Trình duyệt của bạn không hỗ trợ SpeechSynthesis để nghe thử trực tiếp.');
    }
  });
}

// ========================================================
// 5. QUẢN LÝ & CHỌN TEMPLATE BACKGROUND CHÁNH ĐIỆN
// ========================================================
const templatesGrid = document.getElementById('templates-grid');
const currentTemplateName = document.getElementById('current-template-name');
const templateSwitchAlert = document.getElementById('template-switch-alert');

async function loadTemplatesList() {
  if (!templatesGrid) return;
  try {
    const res = await fetch('/api/temple/templates');
    const data = await res.json();
    if (data.success && Array.isArray(data.templates)) {
      renderTemplatesGrid(data.templates, data.currentTemplate);
    }
  } catch (err) {
    console.error('Lỗi tải danh sách template:', err);
  }
}

function renderTemplatesGrid(templates, currentTemplateId) {
  if (!templatesGrid) return;
  templatesGrid.innerHTML = '';

  const activeTpl = templates.find(t => t.id === currentTemplateId) || templates[0];
  if (currentTemplateName && activeTpl) {
    currentTemplateName.textContent = activeTpl.name;
  }

  templates.forEach(tpl => {
    const isCurrent = tpl.id === currentTemplateId || tpl.isActive;
    const card = document.createElement('div');
    card.className = 'template-card';
    card.style.cssText = `
      background: rgba(26, 14, 9, 0.95);
      border: 2px solid ${isCurrent ? '#27ae60' : 'rgba(217, 164, 65, 0.3)'};
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: ${isCurrent ? '0 0 20px rgba(39, 174, 96, 0.4)' : '0 4px 15px rgba(0,0,0,0.5)'};
      transition: all 0.3s ease;
    `;

    card.innerHTML = `
      <div style="position: relative; width: 100%; aspect-ratio: 9/16; background: #0c0705; overflow: hidden;">
        <img src="${tpl.thumb || tpl.url}" alt="${tpl.name}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease;" loading="lazy">
        <span style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.78); color: #ffd700; font-size: 11px; font-weight: bold; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(255,215,0,0.4);">
          ${tpl.tag || 'Chánh Điện'}
        </span>
        ${isCurrent ? `
          <span style="position: absolute; top: 10px; right: 10px; background: #27ae60; color: #fff; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">
            ✓ ĐANG LIVE
          </span>
        ` : ''}
      </div>
      <div style="padding: 14px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h4 style="color: ${isCurrent ? '#2ecc71' : '#ffd700'}; margin: 0 0 6px 0; font-size: 15px;">${tpl.name}</h4>
          <p style="font-size: 12px; color: #b59a76; margin: 0 0 12px 0; line-height: 1.4;">${tpl.desc}</p>
        </div>
        <div>
          ${isCurrent ? `
            <button class="btn btn-sm" disabled style="width: 100%; background: #27ae60; border-color: #219653; color: #fff; opacity: 0.9; cursor: default; font-weight: bold;">
              🟢 Đang Hiển Thị Trên Live
            </button>
          ` : `
            <button class="btn btn-sm btn-primary btn-select-template" data-id="${tpl.id}" data-name="${tpl.name}" style="width: 100%; font-weight: bold;">
              🎨 Áp Dụng Template Này
            </button>
          `}
        </div>
      </div>
    `;

    templatesGrid.appendChild(card);
  });

  // Gắn sự kiện chọn template
  document.querySelectorAll('.btn-select-template').forEach(btn => {
    btn.addEventListener('click', async () => {
      const templateId = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      if (!templateId) return;

      btn.disabled = true;
      btn.textContent = '⏳ Đang chuyển cảnh...';

      try {
        const res = await fetch('/api/temple/template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId })
        });
        const data = await res.json();
        if (data.success) {
          if (templateSwitchAlert) {
            templateSwitchAlert.style.display = 'block';
            templateSwitchAlert.textContent = `✅ Đã chuyển sang: "${name}" tức thì trên Chánh Điện!`;
            setTimeout(() => { if (templateSwitchAlert) templateSwitchAlert.style.display = 'none'; }, 4000);
          }
          loadTemplatesList();
        } else {
          alert('Lỗi đổi template: ' + (data.error || 'Lỗi'));
        }
      } catch (err) {
        alert('Lỗi kết nối: ' + err.message);
      }
    });
  });
}

socket.on('change_background', (data) => {
  if (data && data.templateId) {
    loadTemplatesList();
  }
});

// ========================================================
// QUẢN LÝ QUẺ XĂM PHẬT BẢN MỆNH & ZOOM-IN
// ========================================================
async function loadFortuneSettings() {
  try {
    const res = await fetch('/api/fortune/config');
    const data = await res.json();
    if (!data.success) return;

    const fCfg = data.fortune || {};
    const fortunes = data.fortunes || [];

    const chkEnabled = document.getElementById('fortune-enabled-input');
    const chkTts = document.getElementById('fortune-tts-input');
    const inMinCoins = document.getElementById('fortune-mincoins-input');
    const inDuration = document.getElementById('fortune-duration-input');
    const inZoom = document.getElementById('fortune-zoom-input');
    const countBadge = document.getElementById('fortune-count-badge');
    const tableBody = document.getElementById('fortunes-table-body');

    if (chkEnabled) chkEnabled.checked = fCfg.enabled !== false;
    if (chkTts) chkTts.checked = fCfg.ttsEnabled !== false;
    if (inMinCoins) inMinCoins.value = fCfg.minCoins || 1;
    if (inDuration) inDuration.value = fCfg.durationSec || 7.0;
    if (inZoom) inZoom.value = fCfg.zoomLevel || 1.75;
    if (countBadge) countBadge.textContent = fortunes.length;

    if (tableBody) {
      tableBody.innerHTML = fortunes.map(f => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
          <td style="padding: 10px; font-weight: bold; color: #ffd700;">${f.number || ''}</td>
          <td style="padding: 10px;"><span style="background: rgba(138,42,30,0.8); color: #fff; padding: 3px 8px; border-radius: 4px; font-size: 11.5px; font-weight: bold;">${f.grade || ''}</span></td>
          <td style="padding: 10px; font-weight: 600; color: #f1e3c8;">${f.title || ''}</td>
          <td style="padding: 10px; font-style: italic; color: #b59a76; font-size: 12.5px;">${(f.poem || '').replace(/\s*\/\s*/g, ' | ')}</td>
          <td style="padding: 10px; color: #e8dcc6; font-size: 12px;">${f.advice || f.meaning || ''}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.warn('[Quẻ Xăm] Lỗi tải cấu hình quẻ xăm:', err.message);
  }
}

// Lưu cấu hình Quẻ Xăm
const fortuneSettingsForm = document.getElementById('fortune-settings-form');
if (fortuneSettingsForm) {
  fortuneSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const enabled = document.getElementById('fortune-enabled-input')?.checked ?? true;
    const ttsEnabled = document.getElementById('fortune-tts-input')?.checked ?? true;
    const minCoins = parseInt(document.getElementById('fortune-mincoins-input')?.value, 10) || 1;
    const durationSec = parseFloat(document.getElementById('fortune-duration-input')?.value) || 7.0;
    const zoomLevel = parseFloat(document.getElementById('fortune-zoom-input')?.value) || 1.75;

    try {
      const res = await fetch('/api/fortune/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, ttsEnabled, minCoins, durationSec, zoomLevel })
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Đã lưu cấu hình Quẻ Xăm thành công!');
      } else {
        alert('Lỗi lưu cài đặt: ' + (data.error || 'Lỗi'));
      }
    } catch (err) {
      alert('Lỗi kết nối: ' + err.message);
    }
  });
}

// Test bốc quẻ ngay tức thì
const btnTestFortune = document.getElementById('btn-test-fortune');
const fortuneTestAlert = document.getElementById('fortune-test-alert');
if (btnTestFortune) {
  btnTestFortune.addEventListener('click', async () => {
    btnTestFortune.disabled = true;
    btnTestFortune.textContent = '⏳ Đang phát quẻ...';

    try {
      const res = await fetch('/api/fortune/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        if (fortuneTestAlert) {
          fortuneTestAlert.style.display = 'block';
          fortuneTestAlert.textContent = `🥠 Đã phát bốc quẻ thành công cho "${data.payload?.user?.name}"! Chánh Điện đang Zoom-in cận cảnh!`;
          setTimeout(() => { if (fortuneTestAlert) fortuneTestAlert.style.display = 'none'; }, 6000);
        }
      } else {
        alert('Lỗi test quẻ: ' + (data.error || 'Lỗi'));
      }
    } catch (err) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setTimeout(() => {
        btnTestFortune.disabled = false;
        btnTestFortune.textContent = '🥠 Test Bốc Quẻ Ngay';
      }, 1500);
    }
  });
}

// ========================================================
// TỰ ĐỘNG DỌN DẸP NGƯỜI KHÔNG CÒN Ở TRONG LIVE
// ========================================================
async function loadCleanupSettings() {
  try {
    const res = await fetch('/api/cleanup/config');
    const data = await res.json();
    if (!data.success) return;

    const cCfg = data.autoCleanup || {};
    const chkEnabled = document.getElementById('chk-cleanup-enabled');
    const chkKeepDonors = document.getElementById('chk-cleanup-keep-donors');
    const inTimeout = document.getElementById('input-cleanup-timeout');
    const inDonorTimeout = document.getElementById('input-cleanup-donor-timeout');

    if (chkEnabled) chkEnabled.checked = cCfg.enabled !== false;
    if (chkKeepDonors) chkKeepDonors.checked = cCfg.keepDonors !== false;
    if (inTimeout) inTimeout.value = cCfg.timeoutSec || 90;
    if (inDonorTimeout) inDonorTimeout.value = cCfg.donorTimeoutSec || 300;
  } catch (err) {
    console.warn('[Dọn Dẹp] Lỗi tải cấu hình dọn dẹp:', err.message);
  }
}

// Lưu cài đặt dọn dẹp
const btnSaveCleanup = document.getElementById('btn-save-cleanup');
if (btnSaveCleanup) {
  btnSaveCleanup.addEventListener('click', async () => {
    const enabled = document.getElementById('chk-cleanup-enabled')?.checked ?? true;
    const keepDonors = document.getElementById('chk-cleanup-keep-donors')?.checked ?? true;
    const timeoutSec = parseInt(document.getElementById('input-cleanup-timeout')?.value, 10) || 90;
    const donorTimeoutSec = parseInt(document.getElementById('input-cleanup-donor-timeout')?.value, 10) || 300;

    btnSaveCleanup.disabled = true;
    btnSaveCleanup.textContent = '⏳ Đang lưu...';

    try {
      const res = await fetch('/api/cleanup/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, keepDonors, timeoutSec, donorTimeoutSec })
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Đã lưu cài đặt tự động dọn dẹp thành công!');
      } else {
        alert('Lỗi lưu cài đặt: ' + (data.error || 'Lỗi'));
      }
    } catch (err) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      btnSaveCleanup.disabled = false;
      btnSaveCleanup.textContent = '💾 Lưu Cài Đặt Dọn Dẹp';
    }
  });
}

// Kích hoạt dọn dẹp tức thì
async function triggerImmediateCleanup(btnEl) {
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = '⏳ Đang dọn dẹp...';
  }

  const alertBox = document.getElementById('cleanup-alert');

  try {
    const res = await fetch('/api/cleanup/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.textContent = '🧹 Đã gửi lệnh dọn dẹp người xem rời live! Các phật tử hết hạn đang bước ra về.';
        setTimeout(() => { if (alertBox) alertBox.style.display = 'none'; }, 5000);
      }
      alert('🧹 Đã phát lệnh dọn dẹp người xem không còn ở trong live!');
    } else {
      alert('Lỗi kích hoạt dọn dẹp: ' + (data.error || 'Lỗi'));
    }
  } catch (err) {
    alert('Lỗi kết nối: ' + err.message);
  } finally {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.textContent = btnEl.id === 'btn-quick-cleanup-viewers' ? '🧹 Dọn Người Rời Live' : '🧹 Dọn Dẹp Ngay';
    }
  }
}

const btnTriggerCleanup = document.getElementById('btn-trigger-cleanup');
if (btnTriggerCleanup) {
  btnTriggerCleanup.addEventListener('click', () => triggerImmediateCleanup(btnTriggerCleanup));
}

const btnQuickCleanupViewers = document.getElementById('btn-quick-cleanup-viewers');
if (btnQuickCleanupViewers) {
  btnQuickCleanupViewers.addEventListener('click', () => triggerImmediateCleanup(btnQuickCleanupViewers));
}
