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
