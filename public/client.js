const socket = io();
const peer = new Peer();

const usernameInput = document.getElementById('usernameInput');
const roomInput = document.getElementById('roomInput');
const passwordInput = document.getElementById('passwordInput');
const joinBtn = document.getElementById('joinBtn');
const leaveBtn = document.getElementById('leaveBtn');
const roomsList = document.getElementById('roomsList');
const camerasGrid = document.getElementById('camerasGrid');
const localVideo = document.getElementById('localVideo');
const mainVideo = document.getElementById('mainVideo');
const videoUrlInput = document.getElementById('videoUrlInput');
const loadVideoBtn = document.getElementById('loadVideoBtn');
const shareScreenBtn = document.getElementById('shareScreenBtn');
const chatMessages = document.getElementById('chatMessages');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const toggleMicBtn = document.getElementById('toggleMicBtn');
const toggleCamBtn = document.getElementById('toggleCamBtn');

let currentRoom = '';
let localStream = null;
let myPeerId = '';
let ytPlayer = null;
const peers = {};

peer.on('open', (id) => { myPeerId = id; });

// Odaları Listele
socket.on('room-list', (list) => {
    if (list.length === 0) {
        roomsList.innerHTML = '<span>Henüz aktif oda yok.</span>';
        return;
    }
    roomsList.innerHTML = '';
    list.forEach(r => {
        const badge = document.createElement('div');
        badge.className = 'room-badge';
        badge.innerHTML = `🏠 ${r.id} (${r.userCount}/6) ${r.hasPassword ? '🔒' : ''}`;
        badge.onclick = () => {
            roomInput.value = r.id;
            if (r.hasPassword) {
                const pass = prompt('Oda Şifresini Girin:');
                passwordInput.value = pass || '';
            }
        };
        roomsList.appendChild(badge);
    });
});

// Odaya Katıl
joinBtn.addEventListener('click', async () => {
    currentRoom = roomInput.value.trim();
    const password = passwordInput.value.trim();
    const username = usernameInput.value.trim() || 'Kullanıcı';

    if (currentRoom) {
        await startCamera();
        socket.emit('join-room', { roomId: currentRoom, password, peerId: myPeerId, username });
    }
});

// Odadan Ayrıl
leaveBtn.addEventListener('click', () => {
    if (currentRoom) {
        socket.emit('leave-room', { roomId: currentRoom });
        location.reload();
    }
});

async function startCamera() {
    if (!localStream) {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localVideo.srcObject = localStream;
        } catch (err) {
            console.error('Kamera hatası:', err);
        }
    }
}

socket.on('error-msg', (msg) => alert(msg));

socket.on('room-joined', ({ roomId, existingUsers }) => {
    joinBtn.style.display = 'none';
    leaveBtn.style.display = 'inline-block';

    Object.values(existingUsers).forEach(user => {
        if (user.peerId && user.peerId !== myPeerId) {
            connectToNewUser(user.peerId, user.username, localStream);
        }
    });
});

socket.on('user-connected', ({ peerId, username }) => {
    if (peerId && localStream) {
        setTimeout(() => connectToNewUser(peerId, username, localStream), 1000);
    }
});

peer.on('call', (call) => {
    call.answer(localStream);
    call.on('stream', (userVideoStream) => {
        addRemoteVideoStream(`card-${call.peer}`, 'Katılımcı', userVideoStream);
    });
});

function connectToNewUser(peerId, username, stream) {
    const call = peer.call(peerId, stream);
    call.on('stream', (userVideoStream) => {
        addRemoteVideoStream(`card-${peerId}`, username, userVideoStream);
    });
    peers[peerId] = call;
}

function addRemoteVideoStream(cardId, username, stream) {
    if (document.getElementById(cardId)) return;
    const card = document.createElement('div');
    card.className = 'camera-card';
    card.id = cardId;

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;

    const label = document.createElement('span');
    label.className = 'cam-label';
    label.innerText = username;

    card.appendChild(video);
    card.appendChild(label);
    camerasGrid.appendChild(card);
}

socket.on('user-disconnected', ({ peerId }) => {
    if (peers[peerId]) peers[peerId].close();
    const card = document.getElementById(`card-${peerId}`);
    if (card) card.remove();
});

// Ekran Paylaşımı
shareScreenBtn.addEventListener('click', async () => {
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        mainVideo.style.display = 'block';
        document.getElementById('ytPlayer').style.display = 'none';
        mainVideo.srcObject = screenStream;
        mainVideo.play();
    } catch (err) {
        console.error("Ekran paylaşımı başlatılamadı:", err);
    }
});

// Chat
sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
    const text = msgInput.value.trim();
    const username = usernameInput.value.trim() || 'Kullanıcı';
    if (text && currentRoom) {
        socket.emit('send-message', { roomId: currentRoom, text, user: username, id: socket.id });
        msgInput.value = '';
    }
}

socket.on('receive-message', (data) => {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-row ${data.id === socket.id ? 'self' : ''}`;
    msgDiv.innerHTML = `
        <div class="avatar">${data.user.charAt(0).toUpperCase()}</div>
        <div class="msg-content">
            <span class="user-name">${data.user}</span>
            <p class="msg-text">${data.text}</p>
        </div>
    `;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Mikrofon / Kamera Kontrolleri
toggleMicBtn.addEventListener('click', () => {
    if (localStream) {
        const track = localStream.getAudioTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            toggleMicBtn.innerText = track.enabled ? '🎤 Mikrofon: Açık' : '🎙️ Mikrofon: Kapalı';
        }
    }
});

toggleCamBtn.addEventListener('click', () => {
    if (localStream) {
        const track = localStream.getVideoTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            toggleCamBtn.innerText = track.enabled ? '📷 Kamera: Açık' : '🚫 Kamera: Kapalı';
        }
    }
});