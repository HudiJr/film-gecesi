const socket = io();
const peer = new Peer();

const usernameInput = document.getElementById('usernameInput');
const roomInput = document.getElementById('roomInput');
const passwordInput = document.getElementById('passwordInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const leaveBtn = document.getElementById('leaveBtn');
const roomsList = document.getElementById('roomsList');

const camerasGrid = document.getElementById('camerasGrid');
const localVideo = document.getElementById('localVideo');
const mainVideo = document.getElementById('mainVideo');
const ytPlayer = document.getElementById('ytPlayer');
const noStreamPlaceholder = document.getElementById('noStreamPlaceholder');
const shareScreenBtn = document.getElementById('shareScreenBtn');

// YouTube Kontrolleri
const ytModalBtn = document.getElementById('ytModalBtn');
const ytInputBar = document.getElementById('ytInputBar');
const ytUrlInput = document.getElementById('ytUrlInput');
const ytLoadBtn = document.getElementById('ytLoadBtn');

const chatMessages = document.getElementById('chatMessages');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const toggleMicBtn = document.getElementById('toggleMicBtn');
const toggleCamBtn = document.getElementById('toggleCamBtn');

let currentRoom = '';
let localStream = null;
let screenStream = null;
let myPeerId = '';
const peers = {};

peer.on('open', (id) => { myPeerId = id; });

// Odaları Listele
socket.on('room-list', (list) => {
    if (!list || list.length === 0) {
        roomsList.innerHTML = '<span>Henüz aktif oda yok</span>';
        return;
    }
    roomsList.innerHTML = '';
    list.forEach(r => {
        const badge = document.createElement('div');
        badge.className = 'room-badge';
        badge.innerHTML = `🏠 ${r.id} (${r.userCount}/6) ${r.hasPassword ? '🔒' : ''}`;
        badge.onclick = () => {
            roomInput.value = r.id;
        };
        roomsList.appendChild(badge);
    });
});

// Oda Kur
createRoomBtn.addEventListener('click', async () => {
    currentRoom = roomInput.value.trim();
    const password = passwordInput.value.trim();
    const username = usernameInput.value.trim() || 'Kullanıcı';

    if (!currentRoom) return alert('Lütfen oda adı girin!');

    await startCamera();
    socket.emit('create-room', { roomId: currentRoom, password, peerId: myPeerId, username });
});

// Odaya Katıl
joinRoomBtn.addEventListener('click', async () => {
    currentRoom = roomInput.value.trim();
    const password = passwordInput.value.trim();
    const username = usernameInput.value.trim() || 'Kullanıcı';

    if (!currentRoom) return alert('Lütfen katılmak istediğiniz oda adını girin!');

    await startCamera();
    socket.emit('join-room', { roomId: currentRoom, password, peerId: myPeerId, username });
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
            console.error('Kamera başlatılamadı:', err);
        }
    }
}

socket.on('error-msg', (msg) => alert(msg));

socket.on('room-joined', ({ roomId, existingUsers }) => {
    createRoomBtn.style.display = 'none';
    joinRoomBtn.style.display = 'none';
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

// Gelen Aramalar
peer.on('call', (call) => {
    call.answer(localStream);
    call.on('stream', (remoteStream) => {
        if (call.metadata && call.metadata.type === 'screen') {
            setMainVideoStream(remoteStream);
        } else {
            addRemoteVideoStream(`card-${call.peer}`, 'Katılımcı', remoteStream);
        }
    });
});

function connectToNewUser(peerId, username, stream) {
    const call = peer.call(peerId, stream);
    call.on('stream', (userVideoStream) => {
        addRemoteVideoStream(`card-${peerId}`, username, userVideoStream);
    });
    peers[peerId] = call;

    if (screenStream) {
        peer.call(peerId, screenStream, { metadata: { type: 'screen' } });
    }
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

function setMainVideoStream(stream) {
    noStreamPlaceholder.style.display = 'none';
    ytPlayer.style.display = 'none';
    mainVideo.style.display = 'block';
    mainVideo.srcObject = stream;
    mainVideo.play().catch(e => console.log('Autoplay engeli:', e));
}

socket.on('user-disconnected', ({ peerId }) => {
    if (peers[peerId]) peers[peerId].close();
    const card = document.getElementById(`card-${peerId}`);
    if (card) card.remove();
});

// Ekran Paylaşımı
shareScreenBtn.addEventListener('click', async () => {
    if (!currentRoom) return alert('Önce bir odaya katılın veya oda kurun!');
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });

        setMainVideoStream(screenStream);

        Object.keys(peers).forEach(peerId => {
            peer.call(peerId, screenStream, { metadata: { type: 'screen' } });
        });

        socket.emit('screen-share-started', { roomId: currentRoom, peerId: myPeerId });

        screenStream.getVideoTracks()[0].onended = () => {
            stopScreenShare();
        };

    } catch (err) {
        console.error("Ekran paylaşımı başlatılamadı:", err);
    }
});

function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }
    mainVideo.srcObject = null;
    mainVideo.style.display = 'none';
    noStreamPlaceholder.style.display = 'block';
    socket.emit('screen-share-stopped', { roomId: currentRoom });
}

socket.on('screen-share-stopped', () => {
    mainVideo.srcObject = null;
    mainVideo.style.display = 'none';
    noStreamPlaceholder.style.display = 'block';
});

// YouTube Entegrasyonu (Link veya Arama)
if (ytModalBtn) {
    ytModalBtn.addEventListener('click', () => {
        ytInputBar.style.display = ytInputBar.style.display === 'none' ? 'flex' : 'none';
    });
}

if (ytLoadBtn) {
    ytLoadBtn.addEventListener('click', () => {
        const inputVal = ytUrlInput.value.trim();
        if (!inputVal || !currentRoom) return alert('Lütfen bir link veya arama terimi girin!');

        const videoId = extractYouTubeId(inputVal);

        if (videoId) {
            socket.emit('change-yt-video', { roomId: currentRoom, type: 'video', value: videoId });
            ytInputBar.style.display = 'none';
            ytUrlInput.value = '';
        } else {
            socket.emit('change-yt-video', { roomId: currentRoom, type: 'search', value: inputVal });
            ytInputBar.style.display = 'none';
            ytUrlInput.value = '';
        }
    });
}

function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?\s]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

socket.on('yt-video-changed', ({ type, value }) => {
    mainVideo.style.display = 'none';
    noStreamPlaceholder.style.display = 'none';
    ytPlayer.style.display = 'block';

    if (type === 'video') {
        ytPlayer.src = `https://www.youtube.com/embed/${value}?autoplay=1`;
    } else if (type === 'search') {
        ytPlayer.src = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(value)}&autoplay=1`;
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