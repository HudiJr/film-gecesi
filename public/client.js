const socket = io();

// DOM Elementleri
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

// Odaya Katılma
joinBtn.addEventListener('click', () => {
    currentRoom = roomInput.value.trim();
    if (currentRoom) {
        socket.emit('join-room', currentRoom);
        alert(`${currentRoom} odasına katıldınız!`);
        startCamera();
    }
});

// Kamera Başlatma
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = stream;
    } catch (err) {
        console.error('Kamera/Mikrofon izni alınamadı:', err);
    }
}

// Video Hareketlerini Dinleme (Oynat / Durdur / Saniye Değiştir)
mainVideo.addEventListener('play', () => {
    if (isRemoteAction) return;
    socket.emit('video-action', { roomId: currentRoom, type: 'play', time: mainVideo.currentTime });
});

mainVideo.addEventListener('pause', () => {
    if (isRemoteAction) return;
    socket.emit('video-action', { roomId: currentRoom, type: 'pause', time: mainVideo.currentTime });
});

mainVideo.addEventListener('seeked', () => {
    if (isRemoteAction) return;
    socket.emit('video-action', { roomId: currentRoom, type: 'seek', time: mainVideo.currentTime });
});

// Karşı Taraftan Gelen Video Sinyali
socket.on('video-action', (data) => {
    isRemoteAction = true;
    if (data.type === 'play') {
        mainVideo.currentTime = data.time;
        mainVideo.play();
    } else if (data.type === 'pause') {
        mainVideo.currentTime = data.time;
        mainVideo.pause();
    } else if (data.type === 'seek') {
        mainVideo.currentTime = data.time;
    }
    setTimeout(() => { isRemoteAction = false; }, 500);
});

// Video Linki Değiştirme
loadVideoBtn.addEventListener('click', () => {
    const url = videoUrlInput.value.trim();
    if (url) {
        mainVideo.src = url;
        mainVideo.play();
        socket.emit('video-action', { roomId: currentRoom, type: 'change-src', url: url });
    }
});

socket.on('video-action', (data) => {
    if (data.type === 'change-src') {
        mainVideo.src = data.url;
        mainVideo.play();
    }
});

// Chat Mesajlaşması
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