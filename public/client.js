const socket = io();

const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');
const videoUrlInput = document.getElementById('videoUrlInput');
const loadVideoBtn = document.getElementById('loadVideoBtn');
const mainVideo = document.getElementById('mainVideo');
const chatMessages = document.getElementById('chatMessages');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const localVideo = document.getElementById('localVideo');

let currentRoom = '';
let isRemoteAction = false;

// Odaya Katıl
joinBtn.addEventListener('click', () => {
    currentRoom = roomInput.value.trim();
    if (currentRoom) {
        socket.emit('join-room', currentRoom);
        joinBtn.innerText = 'Katılındı ✓';
        joinBtn.style.backgroundColor = '#28a745';
        startCamera();
    }
});

// Kamera
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = stream;
    } catch (err) {
        console.error('Kamera izni alınamadı:', err);
    }
}

// Video Yükleme
loadVideoBtn.addEventListener('click', () => {
    const url = videoUrlInput.value.trim();
    if (url) {
        mainVideo.src = url;
        mainVideo.play().catch(e => console.log("Oynatma hatası:", e));
        if (currentRoom) {
            socket.emit('video-action', { roomId: currentRoom, type: 'change-src', url: url });
        }
    }
});

// Senkronizasyon
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
        mainVideo.play().catch(e => console.log("Oynatma hatası:", e));
    } else if (data.type === 'play') {
        mainVideo.currentTime = data.time;
        mainVideo.play().catch(e => console.log("Oynatma hatası:", e));
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
    if (text && currentRoom) {
        socket.emit('send-message', { roomId: currentRoom, text: text, id: socket.id });
        msgInput.value = '';
    }
}

socket.on('receive-message', (data) => {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message');
    if (data.id === socket.id) msgDiv.classList.add('self');
    msgDiv.innerText = data.text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});