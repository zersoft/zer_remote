/* ==========================================================================
   ZerRemote - Remote Desktop Client & Host Logic Engine
   ========================================================================== */

(function () {
  'use strict';

  // Socket.IO Connection (Points to Central Server https://remote.zersoft.net)
  const defaultServerUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'https://remote.zersoft.net'
    : window.location.origin;

  const targetServerUrl = localStorage.getItem('zer_server_url') || defaultServerUrl;
  const socket = io(targetServerUrl);

  // State Variables
  let myDeviceId = '';
  let myPassword = '';
  let myDeviceName = 'Bu Masaüstü';
  let activeSessionId = null;
  let peerConnection = null;
  let localMediaStream = null;
  let remoteMediaStream = null;
  let isHost = false;
  let isBroadcasting = false;
  let isRecording = false;
  let mediaRecorder = null;
  let recordedChunks = [];
  let fitMode = 'fit'; // 'fit', '1:1', 'fill'

  // WebRTC ICE Servers Configuration (Public STUN servers)
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // DOM Elements - Navigation & Headers
  const elServerStatus = document.getElementById('server-status-text');
  const elPingVal = document.getElementById('ping-val');
  const elMyDeviceId = document.getElementById('my-device-id');
  const elMyPassword = document.getElementById('my-password');
  const elHostStateBadge = document.getElementById('host-state-badge');
  const elBtnStartHost = document.getElementById('btn-start-host');
  const elBtnRefreshPass = document.getElementById('btn-refresh-pass');
  const elBtnCopyId = document.getElementById('btn-copy-id');
  const elBtnCopyPass = document.getElementById('btn-copy-pass');
  
  // DOM Elements - Connect Form
  const elConnectForm = document.getElementById('connect-form');
  const elRemoteIdInput = document.getElementById('remote-id-input');
  const elRemotePassInput = document.getElementById('remote-pass-input');
  const elBtnConnect = document.getElementById('btn-connect');
  const elQuickTagsContainer = document.getElementById('quick-tags-container');

  // DOM Elements - Remote Viewport Stage
  const elViewportOverlay = document.getElementById('remote-viewport-overlay');
  const elRemoteVideo = document.getElementById('remote-video');
  const elInputCanvas = document.getElementById('input-canvas');
  const elVirtualPointer = document.getElementById('virtual-pointer');
  const elPointerUserName = document.getElementById('pointer-user-name');
  const elStageLoading = document.getElementById('stage-loading');
  const elStageLoadingText = document.getElementById('stage-loading-text');
  const elRemoteSessionTitle = document.getElementById('remote-session-title');

  // DOM Elements - Viewport Toolbar Controls
  const elTbFitMode = document.getElementById('tb-fit-mode');
  const elTbFullscreen = document.getElementById('tb-fullscreen');
  const elTbScreenshot = document.getElementById('tb-screenshot');
  const elTbRecord = document.getElementById('tb-record');
  const elRecStatusText = document.getElementById('rec-status-text');
  const elTbLockRemote = document.getElementById('tb-lock-remote');
  const elTbCtrlAltDel = document.getElementById('tb-ctrl-alt-del');
  const elTbToggleChat = document.getElementById('tb-toggle-chat');
  const elTbToggleFiles = document.getElementById('tb-toggle-files');
  const elTbDisconnect = document.getElementById('tb-disconnect');
  const elTbPing = document.getElementById('tb-ping');
  const elTbFps = document.getElementById('tb-fps');
  const elChatUnreadDot = document.getElementById('chat-unread-dot');

  // DOM Elements - Drawers
  const elChatDrawer = document.getElementById('chat-drawer');
  const elBtnCloseChat = document.getElementById('btn-close-chat');
  const elChatForm = document.getElementById('chat-form');
  const elChatInput = document.getElementById('chat-input');
  const elChatMessages = document.getElementById('chat-messages-container');

  const elFileDrawer = document.getElementById('file-drawer');
  const elBtnCloseFiles = document.getElementById('btn-close-files');
  const elFileDropZone = document.getElementById('file-drop-zone');
  const elFileInputElement = document.getElementById('file-input-element');
  const elFileTransferList = document.getElementById('file-transfer-list');

  // DOM Elements - Modal Incoming Request
  const elModalIncoming = document.getElementById('modal-incoming-connection');
  const elIncomingViewerName = document.getElementById('incoming-viewer-name');
  const elBtnAcceptIncoming = document.getElementById('btn-accept-incoming');
  const elBtnRejectIncoming = document.getElementById('btn-reject-incoming');
  let currentIncomingSession = null;

  // DOM Elements - Modal Download App
  const elBtnHeaderDownload = document.getElementById('btn-header-download');
  const elModalDownloadApp = document.getElementById('modal-download-app');
  const elBtnCloseDownloadModal = document.getElementById('btn-close-download-modal');

  if (elBtnHeaderDownload && elModalDownloadApp) {
    elBtnHeaderDownload.addEventListener('click', () => {
      elModalDownloadApp.classList.remove('hidden');
    });
  }

  if (elBtnCloseDownloadModal && elModalDownloadApp) {
    elBtnCloseDownloadModal.addEventListener('click', () => {
      elModalDownloadApp.classList.add('hidden');
    });
  }

  // DOM Elements - Theme & Settings
  const elBtnToggleTheme = document.getElementById('btn-toggle-theme');
  const elBtnOpenSettings = document.getElementById('btn-open-settings');
  const elModalSettings = document.getElementById('modal-settings');
  const elBtnCloseSettingsModal = document.getElementById('btn-close-settings-modal');
  const elBtnSaveSettings = document.getElementById('btn-save-settings');

  // Load saved theme
  const savedTheme = localStorage.getItem('zer_theme');
  if (savedTheme === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    if (elBtnToggleTheme) elBtnToggleTheme.innerHTML = '<i class="fa-solid fa-sun"></i>';
  }

  if (elBtnToggleTheme) {
    elBtnToggleTheme.addEventListener('click', () => {
      if (document.body.classList.contains('light-theme')) {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        localStorage.setItem('zer_theme', 'dark');
        elBtnToggleTheme.innerHTML = '<i class="fa-solid fa-moon"></i>';
        showToast('Karanlık tema aktif edildi.', 'info');
      } else {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        localStorage.setItem('zer_theme', 'light');
        elBtnToggleTheme.innerHTML = '<i class="fa-solid fa-sun"></i>';
        showToast('Aydınlık tema aktif edildi.', 'info');
      }
    });
  }

  if (elBtnOpenSettings && elModalSettings) {
    elBtnOpenSettings.addEventListener('click', () => {
      elModalSettings.classList.remove('hidden');
    });
  }

  if (elBtnCloseSettingsModal && elModalSettings) {
    elBtnCloseSettingsModal.addEventListener('click', () => {
      elModalSettings.classList.add('hidden');
    });
  }

  if (elBtnSaveSettings && elModalSettings) {
    elBtnSaveSettings.addEventListener('click', () => {
      elModalSettings.classList.add('hidden');
      showToast('Ayarlar başarıyla kaydedildi.', 'success');
    });
  }

  // DOM Elements - Tabs
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');

  // ==========================================================================
  // 1. INITIALIZATION & SOCKET HANDLERS
  // ==========================================================================

  // Helper to generate local fallback credentials immediately
  function generateLocalCredentials() {
    if (!myDeviceId || myDeviceId === '000 000 000') {
      const raw = Math.floor(100000000 + Math.random() * 900000000).toString();
      myDeviceId = `${raw.substring(0, 3)} ${raw.substring(3, 6)} ${raw.substring(6, 9)}`;
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let pass = '';
      for (let i = 0; i < 6; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      myPassword = pass;

      if (elMyDeviceId) elMyDeviceId.textContent = myDeviceId;
      if (elMyPassword) elMyPassword.textContent = myPassword;
    }
  }

  function registerHost() {
    generateLocalCredentials();
    const savedName = localStorage.getItem('zer_device_name') || `PC-${Math.floor(1000 + Math.random() * 9000)}`;
    socket.emit('register-host', { requestedId: myDeviceId, password: myPassword, deviceName: savedName }, (res) => {
      if (res && res.success) {
        myDeviceId = res.deviceId;
        myPassword = res.password;
        myDeviceName = res.deviceName;
        
        if (elMyDeviceId) elMyDeviceId.textContent = myDeviceId;
        if (elMyPassword) elMyPassword.textContent = myPassword;
      }
    });
  }

  // Generate ID immediately on script execution
  generateLocalCredentials();

  socket.on('connect', () => {
    if (elServerStatus) {
      elServerStatus.textContent = 'Sunucu Bağlı';
    }
    showToast('ZerRemote sinyalleşme sunucusuna bağlandı.', 'success');
    registerHost();
  });

  // If socket is already connected when script loads
  if (socket.connected) {
    if (elServerStatus) elServerStatus.textContent = 'Sunucu Bağlı';
    registerHost();
  }

  socket.on('disconnect', () => {
    if (elServerStatus) elServerStatus.textContent = 'Bağlantı Koptu';
    showToast('Sunucu bağlantısı kesildi. Yeniden bağlanılıyor...', 'error');
  });

  // Host Password Refresh
  if (elBtnRefreshPass) {
    elBtnRefreshPass.addEventListener('click', () => {
      socket.emit('refresh-password', (res) => {
        if (res && res.success) {
          myPassword = res.password;
          if (elMyPassword) elMyPassword.textContent = myPassword;
          showToast('Yeni güvenlik parolası üretildi.', 'info');
        }
      });
    });
  }

  // Copy Buttons
  if (elBtnCopyId) {
    elBtnCopyId.addEventListener('click', () => {
      navigator.clipboard.writeText(myDeviceId.replace(/\s+/g, ''));
      showToast('Cihaz ID\'si panoya kopyalandı.', 'info');
    });
  }

  if (elBtnCopyPass) {
    elBtnCopyPass.addEventListener('click', () => {
      navigator.clipboard.writeText(myPassword);
      showToast('Güvenlik parolası kopyalandı.', 'info');
    });
  }

  // Formatting Remote ID input (auto insert space)
  if (elRemoteIdInput) {
    elRemoteIdInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '').substring(0, 9);
      if (val.length > 6) {
        val = `${val.substring(0, 3)} ${val.substring(3, 6)} ${val.substring(6)}`;
      } else if (val.length > 3) {
        val = `${val.substring(0, 3)} ${val.substring(3)}`;
      }
      e.target.value = val;
    });
  }

  // Tab Navigation
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      navItems.forEach(n => n.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      item.classList.add('active');
      const targetTab = document.getElementById(`tab-${tabId}`);
      if (targetTab) targetTab.classList.add('active');
    });
  });

  // Ping Check Loop
  setInterval(() => {
    const start = Date.now();
    socket.emit('ping-check', start, (ts) => {
      const rtt = Date.now() - ts;
      if (elPingVal) elPingVal.textContent = rtt;
      if (elTbPing) elTbPing.textContent = rtt;
      const latencyMetric = document.getElementById('metric-latency');
      if (latencyMetric) latencyMetric.textContent = `${rtt} ms`;
    });
  }, 3000);

  // ==========================================================================
  // 2. HOST SCREEN SHARING LOGIC
  // ==========================================================================

  async function startHostStream() {
    try {
      try {
        localMediaStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            frameRate: { ideal: 60, max: 60 }
          },
          audio: true
        });
      } catch (audioErr) {
        // Fallback without system audio if OS/browser denies audio constraint
        console.warn('System audio denied/unsupported, falling back to video only stream:', audioErr);
        localMediaStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            frameRate: { ideal: 60, max: 60 }
          }
        });
      }

      if (!localMediaStream || localMediaStream.getVideoTracks().length === 0) {
        throw new Error('Geçerli bir video akışı alınamadı.');
      }

      isBroadcasting = true;
      socket.emit('set-broadcasting', true);

      const previewVideo = document.getElementById('host-local-video');
      const placeholder = document.getElementById('no-stream-placeholder');

      if (previewVideo) {
        previewVideo.srcObject = localMediaStream;
        previewVideo.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';

      if (elHostStateBadge) {
        elHostStateBadge.className = 'badge badge-ready';
        elHostStateBadge.innerHTML = '<i class="fa-solid fa-signal"></i> Ekran Yayınlanıyor';
      }

      showToast('Canlı masaüstü paylaşımı başlatıldı.', 'success');

      // Detect stream stop by user from browser bar
      localMediaStream.getVideoTracks()[0].onended = () => {
        stopHostStream();
      };
      return true;
    } catch (err) {
      console.error('Ekran paylaşımı başlatılamadı:', err);
      showToast('Ekran paylaşım izni reddedildi veya iptal edildi.', 'error');
      localMediaStream = null;
      isBroadcasting = false;
      return false;
    }
  }

  function stopHostStream() {
    if (localMediaStream) {
      localMediaStream.getTracks().forEach(track => track.stop());
      localMediaStream = null;
    }
    isBroadcasting = false;
    socket.emit('set-broadcasting', false);

    const previewVideo = document.getElementById('host-local-video');
    const placeholder = document.getElementById('no-stream-placeholder');
    if (previewVideo) previewVideo.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';

    if (elHostStateBadge) {
      elHostStateBadge.className = 'badge badge-ready';
      elHostStateBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Hazır';
    }

    showToast('Ekran yayınlaması durduruldu.', 'info');
  }

  if (elBtnStartHost) {
    elBtnStartHost.addEventListener('click', () => {
      if (!isBroadcasting) {
        startHostStream();
      } else {
        stopHostStream();
      }
    });
  }

  // Incoming Connection Request to Host
  socket.on('incoming-connection', ({ sessionId, viewerName }) => {
    currentIncomingSession = sessionId;
    const autoAccept = document.getElementById('auto-accept-toggle')?.checked;

    if (autoAccept) {
      acceptIncomingConnection();
    } else {
      if (elIncomingViewerName) elIncomingViewerName.textContent = viewerName;
      if (elModalIncoming) elModalIncoming.classList.remove('hidden');
    }
  });

  async function acceptIncomingConnection() {
    if (!currentIncomingSession) return;

    // Ensure host screen stream is acquired BEFORE sending connection-response
    if (!localMediaStream) {
      showToast('Gelen bağlantı kabul ediliyor, lütfen ekrandan pencere iznini onaylayın...', 'info');
      const success = await startHostStream();
      if (!success || !localMediaStream || localMediaStream.getVideoTracks().length === 0) {
        showToast('Ekran izin verilmediği için bağlantı isteği iptal edildi.', 'error');
        socket.emit('connection-response', {
          sessionId: currentIncomingSession,
          accepted: false,
          reason: 'Ev sahibi bilgisayarda ekran paylaşım izni onaylanmadı.'
        });
        currentIncomingSession = null;
        if (elModalIncoming) elModalIncoming.classList.add('hidden');
        return;
      }
    }

    socket.emit('connection-response', { sessionId: currentIncomingSession, accepted: true });
    if (elModalIncoming) elModalIncoming.classList.add('hidden');
    isHost = true;
    activeSessionId = currentIncomingSession;

    setupWebRTCHost(currentIncomingSession);
    showToast('Uzak kullanıcının erişim isteği onaylandı.', 'success');
  }

  function rejectIncomingConnection() {
    if (!currentIncomingSession) return;
    socket.emit('connection-response', { sessionId: currentIncomingSession, accepted: false, reason: 'Bağlantı isteği reddedildi.' });
    if (elModalIncoming) elModalIncoming.classList.add('hidden');
    currentIncomingSession = null;
    showToast('Bağlantı isteği reddedildi.', 'info');
  }

  if (elBtnAcceptIncoming) elBtnAcceptIncoming.addEventListener('click', acceptIncomingConnection);
  if (elBtnRejectIncoming) elBtnRejectIncoming.addEventListener('click', rejectIncomingConnection);

  // Setup WebRTC as Host
  async function setupWebRTCHost(sessionId) {
    peerConnection = new RTCPeerConnection(rtcConfig);

    if (localMediaStream) {
      localMediaStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localMediaStream);
      });
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-candidate', { sessionId, candidate: event.candidate });
      }
    };

    // Create Offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('webrtc-offer', { sessionId, offer });
  }

  // ==========================================================================
  // 3. VIEWER CONNECT & WEBRTC CLIENT LOGIC
  // ==========================================================================

  let connectionApprovalTimeout = null;
  let currentConnectedTargetId = '';

  if (elConnectForm) {
    elConnectForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const targetId = elRemoteIdInput.value.trim();
      const password = elRemotePassInput.value.trim();

      if (!targetId || !password) {
        return showToast('Lütfen geçerli ID ve Parola girin.', 'error');
      }

      currentConnectedTargetId = targetId;

      if (elBtnConnect) {
        elBtnConnect.disabled = true;
        elBtnConnect.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Bağlanılıyor...';
      }

      socket.emit('connect-request', { deviceId: targetId, password, viewerName: 'Uzak Kontrolcü' }, (res) => {
        if (!res.success) {
          showToast(res.message, 'error');
          if (elBtnConnect) {
            elBtnConnect.disabled = false;
            elBtnConnect.innerHTML = '<i class="fa-solid fa-plug"></i> Uzak Masaüstüne Bağlan';
          }
          return;
        }

        activeSessionId = res.sessionId;
        isHost = false;
        saveToRecentDevices(targetId, res.hostDeviceName);

        showToast(`Parola doğrulandı. ${targetId} cihazından onay bekleniyor...`, 'info');
        if (elBtnConnect) {
          elBtnConnect.disabled = true;
          elBtnConnect.innerHTML = '<i class="fa-solid fa-clock fa-spin"></i> Ev Sahibi Onayı Bekleniyor...';
        }

        // 12 Second Approval Timeout Safety
        if (connectionApprovalTimeout) clearTimeout(connectionApprovalTimeout);
        connectionApprovalTimeout = setTimeout(() => {
          if (elBtnConnect && elBtnConnect.disabled) {
            elBtnConnect.disabled = false;
            elBtnConnect.innerHTML = '<i class="fa-solid fa-plug"></i> Uzak Masaüstüne Bağlan';
            showToast('⚠️ Ev sahibi bilgisayardan yanıt alınamadı (Zaman Aşımı). Lütfen Cihaz ID ve Parolasını kontrol edin.', 'warning');
          }
        }, 12000);
      });
    });
  }

  // Viewer receives approval & opens remote stage view
  socket.on('connection-established', ({ sessionId, hostDeviceName, hostDeviceId }) => {
    if (connectionApprovalTimeout) clearTimeout(connectionApprovalTimeout);
    showToast(`${hostDeviceName || 'Uzak Masaüstü'} bağlantısı kabul edildi!`, 'success');

    const targetIdStr = currentConnectedTargetId || hostDeviceId || '';
    const displayTitle = targetIdStr ? `ID: ${targetIdStr}` : (hostDeviceName || 'Uzak Masaüstü');

    showRemoteStage(displayTitle);
    if (elBtnConnect) {
      elBtnConnect.disabled = false;
      elBtnConnect.innerHTML = '<i class="fa-solid fa-plug"></i> Uzak Masaüstüne Bağlan';
    }
  });

  socket.on('connection-rejected', ({ reason }) => {
    if (connectionApprovalTimeout) clearTimeout(connectionApprovalTimeout);
    showToast(`Bağlantı Reddedildi: ${reason}`, 'error');
    hideRemoteStage();
    if (elBtnConnect) {
      elBtnConnect.disabled = false;
      elBtnConnect.innerHTML = '<i class="fa-solid fa-plug"></i> Uzak Masaüstüne Bağlan';
    }
  });

  socket.on('webrtc-offer', async ({ offer }) => {
    if (isHost) return; // Only viewer processes offer

    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Remote Track Received:', event);
      const stream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
      if (elRemoteVideo) {
        elRemoteVideo.srcObject = stream;
        remoteMediaStream = stream;
        elRemoteVideo.play().catch(err => {
          console.warn('[WebRTC] Autoplay play() retry with muted:', err);
          elRemoteVideo.muted = true;
          elRemoteVideo.play();
        });
      }
      if (elStageLoading) elStageLoading.classList.add('hidden');
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && activeSessionId) {
        socket.emit('webrtc-candidate', { sessionId: activeSessionId, candidate: event.candidate });
      }
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('webrtc-answer', { sessionId: activeSessionId, answer });
  });

  socket.on('webrtc-answer', async ({ answer }) => {
    if (peerConnection && isHost) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  });

  socket.on('webrtc-candidate', async ({ candidate }) => {
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('ICE candidate error:', err);
      }
    }
  });

  socket.on('webrtc-candidate', async ({ candidate }) => {
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('ICE candidate error:', err);
      }
    }
  });

  socket.on('session-ended', ({ reason }) => {
    showToast(reason || 'Oturum sonlandırıldı.', 'info');
    hideRemoteStage();
    if (elBtnConnect) {
      elBtnConnect.disabled = false;
      elBtnConnect.innerHTML = '<i class="fa-solid fa-plug"></i> Uzak Masaüstüne Bağlan';
    }
  });

  // ==========================================================================
  // 4. INTERACTIVE REMOTE CONTROL (MOUSE & KEYBOARD FORWARDING)
  // ==========================================================================

  function setupInputForwarding() {
    if (!elInputCanvas) return;

    // Normalize coordinates (0.0 to 1.0) for both Mouse & Touch Events
    function getNormalizedCoords(e) {
      const rect = elInputCanvas.getBoundingClientRect();
      const touch = (e.touches && e.touches[0]) ? e.touches[0] : ((e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : e);
      const x = (touch.clientX - rect.left) / rect.width;
      const y = (touch.clientY - rect.top) / rect.height;
      return {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
        clientX: touch.clientX,
        clientY: touch.clientY
      };
    }

    // Mobile Touch Event Support (iOS & Android Touchscreen Remote Control)
    let touchStartTime = 0;

    elInputCanvas.addEventListener('touchstart', (e) => {
      if (!activeSessionId || isHost) return;
      touchStartTime = Date.now();
      const coords = getNormalizedCoords(e);

      socket.emit('remote-input', {
        sessionId: activeSessionId,
        type: 'mousemove',
        data: { x: coords.x, y: coords.y }
      });

      socket.emit('remote-input', {
        sessionId: activeSessionId,
        type: 'mousedown',
        data: { x: coords.x, y: coords.y, button: 0 }
      });
    }, { passive: true });

    elInputCanvas.addEventListener('touchmove', (e) => {
      if (!activeSessionId || isHost) return;
      const coords = getNormalizedCoords(e);

      socket.emit('remote-input', {
        sessionId: activeSessionId,
        type: 'mousemove',
        data: { x: coords.x, y: coords.y }
      });
    }, { passive: true });

    elInputCanvas.addEventListener('touchend', (e) => {
      if (!activeSessionId || isHost) return;
      const coords = getNormalizedCoords(e);
      const duration = Date.now() - touchStartTime;

      socket.emit('remote-input', {
        sessionId: activeSessionId,
        type: 'mouseup',
        data: { x: coords.x, y: coords.y, button: duration > 600 ? 2 : 0 }
      });

      if (duration <= 600) {
        socket.emit('remote-input', {
          sessionId: activeSessionId,
          type: 'click',
          data: { x: coords.x, y: coords.y, button: 0 }
        });
      } else {
        socket.emit('remote-input', {
          sessionId: activeSessionId,
          type: 'contextmenu',
          data: { x: coords.x, y: coords.y }
        });
      }
    }, { passive: true });

    // Mouse Move
    elInputCanvas.addEventListener('mousemove', (e) => {
      if (!activeSessionId || isHost) return;
      const coords = getNormalizedCoords(e);
      socket.emit('remote-input', {
        sessionId: activeSessionId,
        type: 'mousemove',
        data: { x: coords.x, y: coords.y }
      });
    });

    // Mouse Clicks
    ['mousedown', 'mouseup', 'click', 'dblclick'].forEach(eventType => {
      elInputCanvas.addEventListener(eventType, (e) => {
        if (!activeSessionId || isHost) return;
        const coords = getNormalizedCoords(e);
        socket.emit('remote-input', {
          sessionId: activeSessionId,
          type: eventType,
          data: {
            x: coords.x,
            y: coords.y,
            button: e.button // 0: left, 1: middle, 2: right
          }
        });
      });
    });

    // Context Menu (Right Click)
    elInputCanvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!activeSessionId || isHost) return;
      const coords = getNormalizedCoords(e);
      socket.emit('remote-input', {
        sessionId: activeSessionId,
        type: 'contextmenu',
        data: { x: coords.x, y: coords.y }
      });
    });

    // Keyboard Input
    window.addEventListener('keydown', (e) => {
      if (!activeSessionId || isHost || elViewportOverlay.classList.contains('hidden')) return;
      // Don't forward if typing in chat
      if (document.activeElement === elChatInput) return;

      socket.emit('remote-input', {
        sessionId: activeSessionId,
        type: 'keydown',
        data: { key: e.key, code: e.code, ctrlKey: e.ctrlKey, altKey: e.altKey, shiftKey: e.shiftKey }
      });
    });

    window.addEventListener('keyup', (e) => {
      if (!activeSessionId || isHost || elViewportOverlay.classList.contains('hidden')) return;
      if (document.activeElement === elChatInput) return;

      socket.emit('remote-input', {
        sessionId: activeSessionId,
        type: 'keyup',
        data: { key: e.key, code: e.code }
      });
    });
  }

  // Mobile Virtual Keyboard Handler
  const elTbToggleKeyboard = document.getElementById('tb-toggle-keyboard');
  const elMobileKeyboardInput = document.getElementById('mobile-virtual-keyboard-input');

  if (elTbToggleKeyboard && elMobileKeyboardInput) {
    elTbToggleKeyboard.addEventListener('click', () => {
      elMobileKeyboardInput.focus();
      showToast('Sanal klavye aktif edildi. Yazmaya başlayabilirsiniz.', 'info');
    });

    elMobileKeyboardInput.addEventListener('input', (e) => {
      if (!activeSessionId || isHost) return;
      const char = e.data;
      if (char) {
        socket.emit('remote-input', {
          sessionId: activeSessionId,
          type: 'keydown',
          data: { key: char, code: `Key${char.toUpperCase()}` }
        });
      }
      elMobileKeyboardInput.value = '';
    });
  }

  // Initialize Local Windows OS Input Automation in Node/Electron environment
  let localPsWorker = null;
  if (typeof require !== 'undefined') {
    try {
      const { spawn } = require('child_process');
      if (typeof process !== 'undefined' && process.platform === 'win32') {
        localPsWorker = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '-'], {
          stdio: ['pipe', 'ignore', 'ignore']
        });
        const initScript = `
$signature = @"
using System;
using System.Runtime.InteropServices;

public class WinInput {
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);
}
"@
Add-Type -TypeDefinition $signature -ErrorAction SilentlyContinue
`;
        localPsWorker.stdin.write(initScript + "\n");
      }
    } catch (err) {
      console.warn('Local PowerShell worker initialization skipped:', err);
    }
  }

  function executeLocalWinInput(type, data) {
    if (!localPsWorker || !localPsWorker.stdin) return;
    try {
      if (type === 'mousemove' || type === 'click' || type === 'mousedown' || type === 'mouseup' || type === 'contextmenu') {
        const xRatio = Math.max(0, Math.min(1, data.x || 0));
        const yRatio = Math.max(0, Math.min(1, data.y || 0));
        const psCmd = `$sw=[WinInput]::GetSystemMetrics(0);$sh=[WinInput]::GetSystemMetrics(1);[WinInput]::SetCursorPos([math]::Round(${xRatio}*$sw),[math]::Round(${yRatio}*$sh));`;
        localPsWorker.stdin.write(psCmd + "\n");

        if (type === 'click' || type === 'mousedown') {
          const flag = data.button === 2 ? '0x0008' : '0x0002';
          localPsWorker.stdin.write(`[WinInput]::mouse_event(${flag}, 0, 0, 0, 0)\n`);
        }
        if (type === 'click' || type === 'mouseup') {
          const flag = data.button === 2 ? '0x0010' : '0x0004';
          localPsWorker.stdin.write(`[WinInput]::mouse_event(${flag}, 0, 0, 0, 0)\n`);
        }
        if (type === 'contextmenu') {
          localPsWorker.stdin.write(`[WinInput]::mouse_event(0x0008, 0, 0, 0, 0)\n`);
          localPsWorker.stdin.write(`[WinInput]::mouse_event(0x0010, 0, 0, 0, 0)\n`);
        }
      } else if (type === 'keydown' && data.key) {
        if (data.key.length === 1) {
          const code = data.key.toUpperCase().charCodeAt(0);
          localPsWorker.stdin.write(`[WinInput]::keybd_event(${code}, 0, 0, 0)\n`);
        }
      }
    } catch (e) {
      console.error('Local OS Input Error:', e);
    }
  }

  // Host receives Remote Input Events & Executes Native Windows OS Control
  socket.on('remote-input', ({ type, data, senderId }) => {
    if (!isHost) return;

    // Send input directly to local Windows OS Agent running on http://127.0.0.1:3001
    fetch('http://127.0.0.1:3001/input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data })
    }).catch(() => {});

    // Fallback for standalone Node environment
    executeLocalWinInput(type, data);
    socket.emit('execute-host-os-input', { type, data });

    // Show virtual pointer feedback on host screen
    if (elVirtualPointer) {
      elVirtualPointer.classList.remove('hidden');
      const stageRect = document.getElementById('screen-stage').getBoundingClientRect();
      const xPx = data.x * stageRect.width;
      const yPx = data.y * stageRect.height;

      elVirtualPointer.style.left = `${xPx}px`;
      elVirtualPointer.style.top = `${yPx}px`;

      if (type === 'click' || type === 'mousedown') {
        elVirtualPointer.classList.add('active');
        setTimeout(() => elVirtualPointer.classList.remove('active'), 200);
      }
    }
  });

  // ==========================================================================
  // 5. VIEWPORT TOOLBAR & FEATURE COMMANDS
  // ==========================================================================

  function showRemoteStage(title) {
    if (elViewportOverlay) elViewportOverlay.classList.remove('hidden');
    if (elStageLoading) elStageLoading.classList.remove('hidden');
    if (elRemoteSessionTitle) elRemoteSessionTitle.textContent = `Uzak Masaüstü: ${title}`;

    // Safety timeout: Auto-hide spinner after 2.5s so connection view is never blocked
    setTimeout(() => {
      if (elStageLoading) elStageLoading.classList.add('hidden');
    }, 2500);

    setupInputForwarding();
  }

  function hideRemoteStage() {
    if (elViewportOverlay) elViewportOverlay.classList.add('hidden');
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    activeSessionId = null;
    if (elRemoteVideo) elRemoteVideo.srcObject = null;
  }

  if (elTbDisconnect) {
    elTbDisconnect.addEventListener('click', () => {
      if (activeSessionId) {
        socket.emit('end-session', { sessionId: activeSessionId });
      }
      hideRemoteStage();
      showToast('Oturum kapatıldı.', 'info');
    });
  }

  // Fit Mode Toggle
  if (elTbFitMode) {
    elTbFitMode.addEventListener('click', () => {
      if (fitMode === 'fit') {
        fitMode = '1:1';
        if (elRemoteVideo) elRemoteVideo.style.objectFit = 'none';
        elTbFitMode.querySelector('span').textContent = 'Orijinal';
      } else if (fitMode === '1:1') {
        fitMode = 'fill';
        if (elRemoteVideo) elRemoteVideo.style.objectFit = 'cover';
        elTbFitMode.querySelector('span').textContent = 'Doldur';
      } else {
        fitMode = 'fit';
        if (elRemoteVideo) elRemoteVideo.style.objectFit = 'contain';
        elTbFitMode.querySelector('span').textContent = 'Sığdır';
      }
    });
  }

  // Fullscreen Toggle
  if (elTbFullscreen) {
    elTbFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        elViewportOverlay.requestFullscreen().catch(err => {
          showToast('Tam ekran modu açılamadı.', 'error');
        });
      } else {
        document.exitFullscreen();
      }
    });
  }

  // Screenshot Feature
  if (elTbScreenshot) {
    elTbScreenshot.addEventListener('click', () => {
      if (!elRemoteVideo || !remoteMediaStream) {
        return showToast('Aktif yayın akışı bulunamadı.', 'error');
      }

      const canvas = document.createElement('canvas');
      canvas.width = elRemoteVideo.videoWidth || 1920;
      canvas.height = elRemoteVideo.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(elRemoteVideo, 0, 0, canvas.width, canvas.height);

      const image = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = image;
      a.download = `ZerRemote_Screenshot_${Date.now()}.png`;
      a.click();
      showToast('Ekran görüntüsü alındı ve indirildi.', 'success');
    });
  }

  // Screen Recording Feature
  if (elTbRecord) {
    elTbRecord.addEventListener('click', () => {
      if (!remoteMediaStream) {
        return showToast('Kayıt yapılacak akış bulunamadı.', 'error');
      }

      if (!isRecording) {
        // Start Recording
        recordedChunks = [];
        try {
          mediaRecorder = new MediaRecorder(remoteMediaStream, { mimeType: 'video/webm;codecs=vp9' });
        } catch (e) {
          mediaRecorder = new MediaRecorder(remoteMediaStream);
        }

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) recordedChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `ZerRemote_Kayit_${Date.now()}.webm`;
          a.click();
          showToast('Oturum kaydı tamamlandı ve indirildi.', 'success');
        };

        mediaRecorder.start();
        isRecording = true;
        if (elRecStatusText) elRecStatusText.textContent = 'Durdur';
        if (elTbRecord) elTbRecord.classList.add('active');
        showToast('Oturum video kaydı başlatıldı.', 'info');
      } else {
        // Stop Recording
        mediaRecorder.stop();
        isRecording = false;
        if (elRecStatusText) elRecStatusText.textContent = 'Kaydet';
        if (elTbRecord) elTbRecord.classList.remove('active');
      }
    });
  }

  // Send Ctrl+Alt+Del Signal
  if (elTbCtrlAltDel) {
    elTbCtrlAltDel.addEventListener('click', () => {
      if (!activeSessionId) return;
      socket.emit('remote-command', { sessionId: activeSessionId, command: 'CTRL_ALT_DEL' });
      showToast('Uzaktaki bilgisayara Ctrl+Alt+Del sinyali gönderildi.', 'info');
    });
  }

  // Lock Remote Screen
  if (elTbLockRemote) {
    elTbLockRemote.addEventListener('click', () => {
      if (!activeSessionId) return;
      socket.emit('remote-command', { sessionId: activeSessionId, command: 'LOCK_SCREEN' });
      showToast('Uzaktaki bilgisayarı kilitleme komutu gönderildi.', 'info');
    });
  }

  socket.on('remote-command', ({ command }) => {
    if (command === 'CTRL_ALT_DEL') {
      showToast('[Sistem] Uzak istemciden Ctrl+Alt+Del komutu alındı.', 'warning');
    } else if (command === 'LOCK_SCREEN') {
      showToast('[Sistem] Uzak masaüstü kilitleme talebi işlendi.', 'warning');
    }
  });

  // ==========================================================================
  // 6. IN-SESSION CHAT SYSTEM
  // ==========================================================================

  if (elTbToggleChat) {
    elTbToggleChat.addEventListener('click', () => {
      elChatDrawer.classList.toggle('hidden');
      if (elChatUnreadDot) elChatUnreadDot.classList.add('hidden');
    });
  }
  if (elBtnCloseChat) {
    elBtnCloseChat.addEventListener('click', () => elChatDrawer.classList.add('hidden'));
  }

  if (elChatForm) {
    elChatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = elChatInput.value.trim();
      if (!msg || !activeSessionId) return;

      socket.emit('chat-message', {
        sessionId: activeSessionId,
        message: msg,
        senderName: isHost ? 'Ev Sahibi (Host)' : 'Uzak Kontrolcü'
      });

      elChatInput.value = '';
    });
  }

  socket.on('chat-message', ({ senderId, senderName, message, timestamp }) => {
    const isMe = senderId === socket.id;
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg-bubble ${isMe ? 'me' : 'them'}`;
    msgDiv.innerHTML = `
      <div><strong>${isMe ? 'Siz' : senderName}:</strong> ${escapeHtml(message)}</div>
      <div class="msg-meta">${timestamp}</div>
    `;

    if (elChatMessages) {
      elChatMessages.appendChild(msgDiv);
      elChatMessages.scrollTop = elChatMessages.scrollHeight;
    }

    // Automatically open chat drawer on receiver's screen when message arrives
    if (!isMe) {
      if (elChatDrawer) elChatDrawer.classList.remove('hidden');
      if (elChatUnreadDot) elChatUnreadDot.classList.add('hidden');
      showToast(`💬 ${senderName}: ${message}`, 'info');
    }
  });

  // ==========================================================================
  // 7. FILE TRANSFER SYSTEM
  // ==========================================================================

  if (elTbToggleFiles) {
    elTbToggleFiles.addEventListener('click', () => {
      elFileDrawer.classList.toggle('hidden');
    });
  }
  if (elBtnCloseFiles) {
    elBtnCloseFiles.addEventListener('click', () => elFileDrawer.classList.add('hidden'));
  }

  if (elFileDropZone && elFileInputElement) {
    elFileDropZone.addEventListener('click', () => elFileInputElement.click());

    elFileDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      elFileDropZone.classList.add('drag-over');
    });

    elFileDropZone.addEventListener('dragleave', () => {
      elFileDropZone.classList.remove('drag-over');
    });

    elFileDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      elFileDropZone.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) {
        handleSendFiles(e.dataTransfer.files);
      }
    });

    elFileInputElement.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleSendFiles(e.target.files);
      }
    });
  }

  function handleSendFiles(files) {
    if (!activeSessionId) return showToast('Aktif bir uzak oturum bulunmuyor.', 'error');

    Array.from(files).forEach(file => {
      const metaId = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      
      createFileProgressUI(metaId, file.name, file.size, true);

      socket.emit('file-transfer-meta', {
        sessionId: activeSessionId,
        meta: { id: metaId, name: file.name, size: file.size }
      });

      const chunkSize = 64 * 1024; // 64KB chunks
      let offset = 0;
      const reader = new FileReader();

      reader.onload = (e) => {
        socket.emit('file-transfer-chunk', {
          sessionId: activeSessionId,
          metaId: metaId,
          chunk: e.target.result
        });

        offset += e.target.result.byteLength;
        updateFileProgressUI(metaId, offset, file.size);

        if (offset < file.size) {
          readNextChunk();
        } else {
          socket.emit('file-transfer-complete', { sessionId: activeSessionId, metaId });
          showToast(`${file.name} başarıyla gönderildi.`, 'success');
        }
      };

      function readNextChunk() {
        const slice = file.slice(offset, offset + chunkSize);
        reader.readAsArrayBuffer(slice);
      }

      readNextChunk();
    });
  }

  const incomingFiles = new Map(); // metaId -> { name, size, chunks, receivedBytes }

  socket.on('file-transfer-meta', ({ meta }) => {
    incomingFiles.set(meta.id, {
      name: meta.name,
      size: meta.size,
      chunks: [],
      receivedBytes: 0
    });
    createFileProgressUI(meta.id, meta.name, meta.size, false);
    showToast(`Dosya aktarımı alınıyor: ${meta.name}`, 'info');
    if (elFileDrawer) elFileDrawer.classList.remove('hidden');
  });

  socket.on('file-transfer-chunk', ({ chunk, metaId }) => {
    const fileObj = incomingFiles.get(metaId);
    if (fileObj) {
      fileObj.chunks.push(chunk);
      fileObj.receivedBytes += chunk.byteLength;
      updateFileProgressUI(metaId, fileObj.receivedBytes, fileObj.size);
    }
  });

  socket.on('file-transfer-complete', ({ metaId }) => {
    const fileObj = incomingFiles.get(metaId);
    if (fileObj) {
      const blob = new Blob(fileObj.chunks);
      const url = URL.createObjectURL(blob);
      
      const itemEl = document.getElementById(`file-item-${metaId}`);
      if (itemEl) {
        const actionBox = itemEl.querySelector('.file-action');
        if (actionBox) {
          actionBox.innerHTML = `<a href="${url}" download="${fileObj.name}" class="btn btn-accent btn-sm"><i class="fa-solid fa-download"></i> İndir</a>`;
        }
      }
      showToast(`${fileObj.name} tam olarak alındı!`, 'success');
    }
  });

  function createFileProgressUI(id, fileName, fileSize, isSending) {
    if (!elFileTransferList) return;
    const item = document.createElement('div');
    item.className = 'file-transfer-item';
    item.id = `file-item-${id}`;
    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-center" style="display:flex; justify-content:space-between;">
        <strong>${isSending ? ' Gönderiliyor: ' : ' Alınıyor: '}${escapeHtml(fileName)}</strong>
        <span class="file-size">${formatBytes(fileSize)}</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" id="progress-${id}"></div>
      </div>
      <div class="file-action mt-2" style="margin-top:6px; text-align:right;">
        <small id="status-${id}">Transfer Ediliyor (%0)...</small>
      </div>
    `;
    elFileTransferList.prepend(item);
  }

  function updateFileProgressUI(id, current, total) {
    const percent = Math.min(100, Math.floor((current / total) * 100));
    const fill = document.getElementById(`progress-${id}`);
    const status = document.getElementById(`status-${id}`);

    if (fill) fill.style.width = `${percent}%`;
    if (status) status.textContent = `Transfer Ediliyor (%${percent})...`;
  }

  // ==========================================================================
  // 8. SAVED DEVICES & HISTORY STORAGE
  // ==========================================================================

  function saveToRecentDevices(id, name) {
    let saved = JSON.parse(localStorage.getItem('zer_saved_devices') || '[]');
    saved = saved.filter(item => item.id !== id);
    saved.unshift({ id, name: name || `Cihaz ${id}`, lastConnected: new Date().toLocaleDateString('tr-TR') });
    localStorage.setItem('zer_saved_devices', JSON.stringify(saved.slice(0, 8)));
    renderRecentDevices();
  }

  function renderRecentDevices() {
    const saved = JSON.parse(localStorage.getItem('zer_saved_devices') || '[]');
    if (!elQuickTagsContainer) return;

    if (saved.length === 0) {
      elQuickTagsContainer.innerHTML = '<div class="quick-tag-empty">Henüz kaydedilmiş cihaz yok.</div>';
      return;
    }

    elQuickTagsContainer.innerHTML = '';
    saved.forEach(device => {
      const tag = document.createElement('div');
      tag.className = 'quick-tag-item';
      tag.innerHTML = `<i class="fa-solid fa-desktop"></i> ${device.id} (${device.name})`;
      tag.addEventListener('click', () => {
        if (elRemoteIdInput) elRemoteIdInput.value = device.id;
      });
      elQuickTagsContainer.appendChild(tag);
    });

    // Populate Saved Devices Tab
    const savedContainer = document.getElementById('saved-devices-container');
    if (savedContainer) {
      savedContainer.innerHTML = '';
      saved.forEach(device => {
        const card = document.createElement('div');
        card.className = 'card glass-card';
        card.innerHTML = `
          <div class="d-flex align-items-center gap-3" style="display:flex; gap:12px; align-items:center;">
            <i class="fa-solid fa-desktop highlight-icon"></i>
            <div>
              <h4 style="font-size:16px;">${escapeHtml(device.name)}</h4>
              <p style="font-family:var(--font-mono); color:var(--accent-cyan); font-size:14px;">ID: ${device.id}</p>
              <small style="color:var(--text-dim);">Son Bağlantı: ${device.lastConnected}</small>
            </div>
          </div>
          <button class="btn btn-accent btn-block mt-3" style="margin-top:14px;" onclick="document.getElementById('remote-id-input').value='${device.id}'; document.querySelector('[data-tab=remote-control]').click();">
            <i class="fa-solid fa-plug"></i> Hızlı Bağlan
          </button>
        `;
        savedContainer.appendChild(card);
      });
    }
  }

  renderRecentDevices();

  // ==========================================================================
  // 9. UTILITIES & TOASTS
  // ==========================================================================

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';

    let iconClass = 'fa-info-circle info';
    if (type === 'success') iconClass = 'fa-circle-check success';
    if (type === 'error') iconClass = 'fa-circle-xmark error';
    if (type === 'warning') iconClass = 'fa-triangle-exclamation warning';

    toast.innerHTML = `
      <i class="fa-solid ${iconClass} toast-icon ${type}"></i>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

})();
