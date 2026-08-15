const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();

// Windows OS Native Input Automation Worker (user32.dll)
const { spawn } = require('child_process');
let psInputWorker = null;

if (process.platform === 'win32') {
  try {
    psInputWorker = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '-'], {
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
    psInputWorker.stdin.write(initScript + "\n");
  } catch (err) {
    console.error('PowerShell input worker failed:', err);
  }
}

function executeWinOSInput(type, data) {
  if (process.platform !== 'win32' || !psInputWorker || !psInputWorker.stdin) return;

  try {
    const screenW = 1920;
    const screenH = 1080;

    if (type === 'mousemove' || type === 'click' || type === 'mousedown' || type === 'mouseup' || type === 'contextmenu') {
      const targetX = Math.round((data.x || 0) * screenW);
      const targetY = Math.round((data.y || 0) * screenH);

      psInputWorker.stdin.write(`[WinInput]::SetCursorPos(${targetX}, ${targetY})\n`);

      if (type === 'click' || type === 'mousedown') {
        const flag = data.button === 2 ? '0x0008' : '0x0002';
        psInputWorker.stdin.write(`[WinInput]::mouse_event(${flag}, 0, 0, 0, 0)\n`);
      }
      if (type === 'click' || type === 'mouseup') {
        const flag = data.button === 2 ? '0x0010' : '0x0004';
        psInputWorker.stdin.write(`[WinInput]::mouse_event(${flag}, 0, 0, 0, 0)\n`);
      }
      if (type === 'contextmenu') {
        psInputWorker.stdin.write(`[WinInput]::mouse_event(0x0008, 0, 0, 0, 0)\n`);
        psInputWorker.stdin.write(`[WinInput]::mouse_event(0x0010, 0, 0, 0, 0)\n`);
      }
    } else if (type === 'keydown' && data.key) {
      if (data.key.length === 1) {
        const code = data.key.charCodeAt(0);
        psInputWorker.stdin.write(`[WinInput]::keybd_event(${code}, 0, 0, 0)\n`);
      }
    }
  } catch (err) {
    console.error('OS Input execution error:', err);
  }
}
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e8
});

app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 }));

// Store active hosts: deviceId -> { socketId, password, deviceName, isBroadcasting, createdAt }
const hosts = new Map();
// Store active sessions: sessionId -> { hostId, viewerSocketId, hostSocketId, startTime }
const sessions = new Map();

// Helper to generate formatted 9-digit Device ID (e.g. "842 190 312")
function generateDeviceId() {
  let id = '';
  do {
    const raw = Math.floor(100000000 + Math.random() * 900000000).toString();
    id = `${raw.substring(0, 3)} ${raw.substring(3, 6)} ${raw.substring(6, 9)}`;
  } while (hosts.has(id));
  return id;
}

// Helper to generate a random 6-character alphanumeric password
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pass = '';
  for (let i = 0; i < 6; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

io.on('connection', (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // 1. Host Registration
  socket.on('register-host', (data, callback) => {
    let deviceId = data?.requestedId;
    if (!deviceId || hosts.has(deviceId)) {
      deviceId = generateDeviceId();
    }
    const password = data?.password || generatePassword();
    const deviceName = data?.deviceName || `PC-${Math.floor(1000 + Math.random() * 9000)}`;

    hosts.set(deviceId, {
      socketId: socket.id,
      password: password,
      deviceName: deviceName,
      isBroadcasting: false,
      createdAt: Date.now()
    });

    socket.deviceId = deviceId;
    socket.isHost = true;
    socket.join(`host:${deviceId}`);

    console.log(`[Host Registered] Device ID: ${deviceId}, Password: ${password}`);

    if (typeof callback === 'function') {
      callback({
        success: true,
        deviceId: deviceId,
        password: password,
        deviceName: deviceName
      });
    }
  });

  // 2. Refresh Host Password
  socket.on('refresh-password', (callback) => {
    if (socket.isHost && socket.deviceId && hosts.has(socket.deviceId)) {
      const hostData = hosts.get(socket.deviceId);
      hostData.password = generatePassword();
      hosts.set(socket.deviceId, hostData);
      if (typeof callback === 'function') {
        callback({ success: true, password: hostData.password });
      }
    }
  });

  // 3. Update Host Broadcast State
  socket.on('set-broadcasting', (isBroadcasting) => {
    if (socket.isHost && socket.deviceId && hosts.has(socket.deviceId)) {
      const hostData = hosts.get(socket.deviceId);
      hostData.isBroadcasting = isBroadcasting;
      hosts.set(socket.deviceId, hostData);
    }
  });

  // Helper to normalize device IDs for robust lookup
  function normalizeId(id) {
    return (id || '').replace(/\D/g, '');
  }

  function findHostByNormalizedId(targetId) {
    const normTarget = normalizeId(targetId);
    if (!normTarget) return null;
    for (const [id, data] of hosts.entries()) {
      if (normalizeId(id) === normTarget) {
        return { deviceId: id, ...data };
      }
    }
    return null;
  }

  // 4. Viewer Requests Connection to Host
  socket.on('connect-request', ({ deviceId, password, viewerName }, callback) => {
    const hostData = findHostByNormalizedId(deviceId);

    if (!hostData) {
      return callback({ success: false, message: "Belirtilen ID ile cihaz bulunamadı. Lütfen ID'yi kontrol edin." });
    }

    if (hostData.password.trim().toUpperCase() !== (password || '').trim().toUpperCase()) {
      return callback({ success: false, message: 'Hatalı Parola! Lütfen parolayı tekrar kontrol edin.' });
    }

    const hostSocket = io.sockets.sockets.get(hostData.socketId);
    if (!hostSocket) {
      hosts.delete(hostData.deviceId);
      return callback({ success: false, message: 'Uzak cihaz çevrimdışı görünüyor.' });
    }

    const sessionId = `session_${socket.id}_${hostData.socketId}`;

    sessions.set(sessionId, {
      sessionId,
      hostDeviceId: hostData.deviceId,
      hostSocketId: hostData.socketId,
      viewerSocketId: socket.id,
      viewerName: viewerName || 'Uzak İstemci',
      startTime: Date.now()
    });

    socket.sessionId = sessionId;
    socket.join(sessionId);
    hostSocket.join(sessionId);

    // Notify Host of connection request (Emits to sessionId room joined by both host and viewer)
    io.to(sessionId).emit('incoming-connection', {
      sessionId,
      viewerSocketId: socket.id,
      viewerName: viewerName || 'Uzak Kullanıcı'
    });

    callback({
      success: true,
      sessionId,
      hostDeviceName: hostData.deviceName
    });

    console.log(`[Connection Initiated] Viewer ${socket.id} -> Host ${hostData.deviceId} (Session: ${sessionId})`);
  });

  // 5. Host Accepts/Rejects Connection
  socket.on('connection-response', ({ sessionId, accepted, reason }) => {
    const session = sessions.get(sessionId);
    if (!session) return;

    if (accepted) {
      const hostData = findHostByNormalizedId(session.hostDeviceId);
      io.to(sessionId).emit('connection-established', {
        sessionId,
        hostDeviceName: hostData ? hostData.deviceName : 'Uzak Masaüstü'
      });
      console.log(`[Session Accepted] ${sessionId}`);
    } else {
      io.to(sessionId).emit('connection-rejected', {
        reason: reason || 'Bağlantı isteği ev sahibi tarafından reddedildi.'
      });
      sessions.delete(sessionId);
      console.log(`[Session Rejected] ${sessionId}`);
    }
  });

  // 6. WebRTC Signaling Relays
  socket.on('webrtc-offer', ({ sessionId, offer }) => {
    socket.to(sessionId).emit('webrtc-offer', { offer, senderId: socket.id });
  });

  socket.on('webrtc-answer', ({ sessionId, answer }) => {
    socket.to(sessionId).emit('webrtc-answer', { answer, senderId: socket.id });
  });

  socket.on('webrtc-candidate', ({ sessionId, candidate }) => {
    socket.to(sessionId).emit('webrtc-candidate', { candidate, senderId: socket.id });
  });

  // 7. Remote Input Control Forwarding & OS Automation
  socket.on('remote-input', ({ sessionId, type, data }) => {
    const session = sessions.get(sessionId);
    if (session && session.hostSocketId) {
      io.to(session.hostSocketId).emit('remote-input', { type, data, senderId: socket.id });
    }
  });

  socket.on('execute-host-os-input', ({ type, data }) => {
    executeWinOSInput(type, data);
  });

  // 8. Remote Command Actions (Lock, Screenshot, Audio toggle, etc.)
  socket.on('remote-command', ({ sessionId, command, payload }) => {
    const session = sessions.get(sessionId);
    if (session) {
      io.to(sessionId).emit('remote-command', { command, payload, senderId: socket.id });
    }
  });

  // 9. Real-time Chat Relay
  socket.on('chat-message', ({ sessionId, message, senderName }) => {
    const session = sessions.get(sessionId);
    if (session) {
      io.to(sessionId).emit('chat-message', {
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        senderId: socket.id,
        senderName: senderName || (socket.isHost ? 'Ev Sahibi (Host)' : 'Uzak Kullanıcı'),
        message,
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      });
    }
  });

  // 10. File Transfer Relay
  socket.on('file-transfer-meta', ({ sessionId, meta }) => {
    socket.to(sessionId).emit('file-transfer-meta', { meta, senderId: socket.id });
  });

  socket.on('file-transfer-chunk', ({ sessionId, chunk, metaId }) => {
    socket.to(sessionId).emit('file-transfer-chunk', { chunk, metaId });
  });

  socket.on('file-transfer-complete', ({ sessionId, metaId }) => {
    socket.to(sessionId).emit('file-transfer-complete', { metaId });
  });

  // 11. Ping / Latency Check
  socket.on('ping-check', (timestamp, callback) => {
    if (typeof callback === 'function') {
      callback(timestamp);
    }
  });

  // 12. End Session
  socket.on('end-session', ({ sessionId }) => {
    const session = sessions.get(sessionId);
    if (session) {
      io.to(sessionId).emit('session-ended', { reason: 'Oturum sonlandırıldı.' });
      sessions.delete(sessionId);
    }
  });

  // 14. Fallback WebSocket Screen Frame Relay
  socket.on('stream-frame', ({ sessionId, frame }) => {
    socket.to(sessionId).emit('stream-frame', { frame });
  });

  // 13. Disconnect Handling
  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);

    if (socket.isHost && socket.deviceId) {
      hosts.delete(socket.deviceId);
      console.log(`[Host Unregistered] Device ID: ${socket.deviceId}`);
    }

    // Clean up any sessions involving this socket
    for (const [sessionId, session] of sessions.entries()) {
      if (session.hostSocketId === socket.id || session.viewerSocketId === socket.id) {
        io.to(sessionId).emit('session-ended', {
          reason: socket.isHost ? 'Uzak bilgisayar bağlantısı koptu.' : 'İstemci bağlantıyı kesti.'
        });
        sessions.delete(sessionId);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  ZerRemote - Uzak Erişim Sunucusu Başlatıldı!`);
  console.log(`  Adres: http://localhost:${PORT}`);
  console.log(`====================================================`);

  // Auto-open browser window on Windows/Mac/Linux
  if (process.env.NO_AUTO_OPEN !== 'true') {
    const url = process.env.PUBLIC_SERVER_URL || 'https://remote.zersoft.net';
    const { exec } = require('child_process');
    const startCmd = process.platform === 'win32' ? `start ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
    exec(startCmd, (err) => {
      if (err) console.log(`[Auto-Open Browser] Manual navigate required: ${url}`);
    });
  }
});

