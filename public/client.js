const socket = io();
const peer = new Peer();

const usernameInput = document.getElementById('usernameInput');
const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');
const videoUrlInput = document.getElementById('videoUrlInput');
const loadVideoBtn = document.getElementById('loadVideoBtn');
const mainVideo = document.getElementById('mainVideo');
const chatMessages = document.getElementById('chatMessages');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const toggleMicBtn = document.getElementById('toggleMicBtn');
const toggleCamBtn = document.getElementById('toggleCamBtn');

let currentRoom = '';
let isRemoteAction = false;
let localStream = null;
let myPeerId = '';

peer.on('open', (id) => {
    myPeerId = id;
});

// Odaya Katıl
joinBtn.addEventListener('click', async () => {
    currentRoom = roomInput.value.trim();
    if (currentRoom) {
        await startCamera();
        socket.emit('join-room', currentRoom, myPeerId);
        joinBtn.innerText = 'Katılındı ✓';
        joinBtn.style.backgroundColor = '#28a745';
    }
});

// Kamera Başlatma
async function startCamera() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
    } catch (err) {
        console.error('Kamera izni alınamadı:', err);
    }
}

// Gelen Aramayı Cevapla (Partner bağlandığında)
peer.on('call', (call) => {
    call.answer(localStream);
    call.on('stream', (userVideoStream) => {
        remoteVideo.srcObject = userVideoStream;
    });
});

// Yeni Kullanıcı Katıldığında Onu Ara
socket.on('user-connected', (userId) => {
    if (userId && localStream) {
        const call = peer.call(userId, localStream);
        call.on('stream', (userVideoStream) => {
            remoteVideo.srcObject = userVideoStream;
        });
    }
});

// Mikrofon ve Kamera Aç/Kapat
toggleMicBtn.addEventListener('click', () => {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            toggleMicBtn.innerText = audioTrack.enabled ? '🎤 Mikrofon: Açık' : '🎙️ Mikrofon: Kapalı';
        }
    }
});

toggleCamBtn.addEventListener('click', () => {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            toggleCamBtn.innerText = videoTrack.enabled ? '📷 Kamera: Açık' : '🚫 Kamera: Kapalı';
        }
    }
});

// Video Yükleme ve Senkronizasyon
loadVideoBtn.addEventListener('click', () => {
    const url = videoUrlInput.value.trim();
    if (url) {
        mainVideo.src = url;
        mainVideo.play().catch(e => console.log(e));
        if (currentRoom) {
            socket.emit('video-action', { roomId: currentRoom, type: 'change-src', url: url });
        }
    }
});

mainVideo.addEventListener('play', () => {
    if (isRemoteAction || !currentRoom) return;
    socket.emit('video-action', { roomId: currentRoom, type: 'play', time: mainVideo.currentTime });
});

mainVideo.addEventListener('pause', () => {
    if (isRemoteAction || !currentRoom) return;
    socket.emit('video-action', { roomId: currentRoom, type: 'pause', time: mainVideo.currentTime });
});

mainVideo.addEventListener('seeked', () => {
    if (isRemoteAction || !currentRoom) return;
    socket.emit('video-action', { roomId: currentRoom, type: 'seek', time: mainVideo.currentTime });
});

socket.on('video-action', (data) => {
    isRemoteAction = true;
    if (data.type === 'change-src') {
        mainVideo.src = data.url;
        mainVideo.play().catch(e => console.log(e));
    } else if (data.type === 'play') {
        mainVideo.currentTime = data.time;
        mainVideo.play().catch(e => console.log(e));
    } else if (data.type === 'pause') {
        mainVideo.currentTime = data.time;
        mainVideo.pause();
    } else if (data.type === 'seek') {
        mainVideo.currentTime = data.time;
    }
    setTimeout(() => { isRemoteAction = false; }, 500);
});

// Chat
sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
    const text = msgInput.value.trim();
    const username = usernameInput.value.trim() || 'Kullanıcı';
    if (text && currentRoom) {
        socket.emit('send-message', { roomId: currentRoom, text: text, user: username, id: socket.id });
        msgInput.value = '';
    }
}

socket.on('receive-message', (data) => {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-row');
    if (data.id === socket.id) msgDiv.classList.add('self');

    const initial = data.user.charAt(0).toUpperCase();
    msgDiv.innerHTML = `
        <div class="avatar">${initial}</div>
        <div class="msg-content">
            <span class="user-name">${data.user}</span>
            <p class="msg-text">${data.text}</p>
        </div>
    `;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});