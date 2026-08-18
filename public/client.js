const socket = io();
const peer = new Peer();

// Sayfa Elementleri
const landingPage = document.getElementById('landingPage');
const roomPage = document.getElementById('roomPage');
const landingUsername = document.getElementById('landingUsername');
const landingRoomInput = document.getElementById('landingRoomInput');
const landingPassword = document.getElementById('landingPassword');
const landingCreateBtn = document.getElementById('landingCreateBtn');
const landingJoinBtn = document.getElementById('landingJoinBtn');
const landingRoomsList = document.getElementById('landingRoomsList');
const roomsList = document.getElementById('roomsList');

const displayUsername = document.getElementById('displayUsername');
const leaveBtn = document.getElementById('leaveBtn');
const roomTitleDisplay = document.getElementById('roomTitleDisplay');

const camerasGrid = document.getElementById('camerasGrid');
const localVideo = document.getElementById('localVideo');
const mainVideo = document.getElementById('mainVideo');
const ytPlayer = document.getElementById('ytPlayer');
const googlePlayer = document.getElementById('googlePlayer');
const noStreamPlaceholder = document.getElementById('noStreamPlaceholder');
const shareScreenBtn = document.getElementById('shareScreenBtn');

const ytModalBtn = document.getElementById('ytModalBtn');
const ytInputBar = document.getElementById('ytInputBar');
const ytUrlInput = document.getElementById('ytUrlInput');
const ytLoadBtn = document.getElementById('ytLoadBtn');

const googleModalBtn = document.getElementById('googleModalBtn');
const googleInputBar = document.getElementById('googleInputBar');
const googleUrlInput = document.getElementById('googleUrlInput');
const googleLoadBtn = document.getElementById('googleLoadBtn');

const chatMessages = document.getElementById('chatMessages');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const toggleMicBtn = document.getElementById('toggleMicBtn');
const toggleCamBtn = document.getElementById('toggleCamBtn');
const messageNotification = document.getElementById('messageNotification');
const notifSender = document.getElementById('notifSender');
const notifText = document.getElementById('notifText');

let currentRoom = '';
let currentUsername = 'Kullanıcı';
let localStream = null;
let screenStream = null;
let myPeerId = '';
const peers = {};

peer.on('open', (id) => { myPeerId = id; });

// Odaları Listeleme (Hem Ana Ekran hem Oda İçi)
socket.on('room-list', (list) => {
    updateRoomListUI(landingRoomsList, list);
    updateRoomListUI(roomsList, list);
});

function updateRoomListUI(container, list) {
    if (!list || list.length === 0) {
        container.innerHTML = '<span>Henüz aktif oda yok</span>';
        return;
    }
    container.innerHTML = '';
    list.forEach(r => {
        const badge = document.createElement('div');
        badge.className = 'room-badge';
        badge.innerHTML = `🏠 ${r.id} (${r.userCount}/6) ${r.hasPassword ? '🔒' : ''}`;
        badge.onclick = () => { landingRoomInput.value = r.id; };
        container.appendChild(badge);
    });
}

// Oda Kurma ve Katılma İşlemleri
landingCreateBtn.addEventListener('click', async () => {
    currentRoom = landingRoomInput.value.trim();
    currentUsername = landingUsername.value.trim() || 'Kullanıcı';
    const password = landingPassword.value.trim();
    if (!currentRoom) return alert('Lütfen oda adı girin!');
    
    await startCamera();
    socket.emit('create-room', { roomId: currentRoom, password, peerId: myPeerId, username: currentUsername });
});

landingJoinBtn.addEventListener('click', async () => {
    currentRoom = landingRoomInput.value.trim();
    currentUsername = landingUsername.value.trim() || 'Kullanıcı';
    const password = landingPassword.value.trim();
    if (!currentRoom) return alert('Lütfen oda adı girin!');
    
    await startCamera();
    socket.emit('join-room', { roomId: currentRoom, password, peerId: myPeerId, username: currentUsername });
});

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
        } catch (err) { console.error(err); }
    }
}

socket.on('error-msg', (msg) => alert(msg));

socket.on('room-joined', ({ roomId, existingUsers }) => {
    // Arayüz Değişimi: Giriş ekranını gizle, oda ekranını aç
    landingPage.style.display = 'none';
    roomPage.style.display = 'flex';
    displayUsername.innerText = `👤 ${currentUsername}`;
    roomTitleDisplay.innerText = `Film Gecesi 🍿 - Oda: ${roomId}`;

    Object.values(existingUsers).forEach(user => {
        if (user.peerId && user.peerId !== myPeerId) connectToNewUser(user.peerId, user.username, localStream);
    });
});

socket.on('user-connected', ({ peerId, username }) => {
    if (peerId && localStream) setTimeout(() => connectToNewUser(peerId, username, localStream), 1000);
});

peer.on('call', (call) => {
    call.answer(localStream);
    call.on('stream', (remoteStream) => {
        if (call.metadata && call.metadata.type === 'screen') setMainVideoStream(remoteStream);
        else addRemoteVideoStream(`card-${call.peer}`, 'Katılımcı', remoteStream);
    });
});

function connectToNewUser(peerId, username, stream) {
    const call = peer.call(peerId, stream);
    call.on('stream', (userVideoStream) => addRemoteVideoStream(`card-${peerId}`, username, userVideoStream));
    peers[peerId] = call;
    if (screenStream) peer.call(peerId, screenStream, { metadata: { type: 'screen' } });
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
    googlePlayer.style.display = 'none';
    mainVideo.style.display = 'block';
    mainVideo.srcObject = stream;
    mainVideo.play().catch(e => console.log(e));
}

socket.on('user-disconnected', ({ peerId }) => {
    if (peers[peerId]) peers[peerId].close();
    const card = document.getElementById(`card-${peerId}`);
    if (card) card.remove();
});

shareScreenBtn.addEventListener('click', async () => {
    if (!currentRoom) return alert('Önce bir odaya katılın!');
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        setMainVideoStream(screenStream);
        Object.keys(peers).forEach(peerId => peer.call(peerId, screenStream, { metadata: { type: 'screen' } }));
        socket.emit('screen-share-started', { roomId: currentRoom, peerId: myPeerId });
        screenStream.getVideoTracks()[0].onended = () => stopScreenShare();
    } catch (err) { console.error(err); }
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

// YouTube Entegrasyonu
ytModalBtn.addEventListener('click', () => {
    ytInputBar.style.display = ytInputBar.style.display === 'none' ? 'flex' : 'none';
    googleInputBar.style.display = 'none';
});

ytLoadBtn.addEventListener('click', async () => {
    const inputVal = ytUrlInput.value.trim();
    if (!inputVal || !currentRoom) return alert('Lütfen bir değer girin!');
    const videoId = extractYouTubeId(inputVal);

    if (videoId) {
        socket.emit('change-yt-video', { roomId: currentRoom, videoId });
    } else {
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(inputVal)}`, '_blank');
        alert("YouTube arama sonuçları yeni sekmede açıldı. İzlemek istediğiniz videonun linkini kopyalayıp buraya yapıştırabilirsiniz!");
    }
    ytInputBar.style.display = 'none';
    ytUrlInput.value = '';
});

function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?\s]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

socket.on('yt-video-changed', ({ videoId }) => {
    mainVideo.style.display = 'none';
    googlePlayer.style.display = 'none';
    noStreamPlaceholder.style.display = 'none';
    ytPlayer.style.display = 'block';
    ytPlayer.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
});

// Google Modalı
googleModalBtn.addEventListener('click', () => {
    googleInputBar.style.display = googleInputBar.style.display === 'none' ? 'flex' : 'none';
    ytInputBar.style.display = 'none';
});

googleLoadBtn.addEventListener('click', () => {
    const query = googleUrlInput.value.trim();
    if (!query || !currentRoom) return alert('Lütfen arama terimi girin!');
    const targetUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&igu=1`;
    socket.emit('change-google-url', { roomId: currentRoom, url: targetUrl });
    googleInputBar.style.display = 'none';
    googleUrlInput.value = '';
});

socket.on('google-url-changed', ({ url }) => {
    mainVideo.style.display = 'none';
    ytPlayer.style.display = 'none';
    noStreamPlaceholder.style.display = 'none';
    googlePlayer.style.display = 'block';
    googlePlayer.src = url;
});

// Chat & Mesaj Bildirimi & Düzenleme Mantığı
sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
    const text = msgInput.value.trim();
    if (text && currentRoom) {
        const msgId = 'msg_' + Date.now() + Math.random().toString(36).substr(2, 5);
        socket.emit('send-message', { roomId: currentRoom, text, user: currentUsername, id: socket.id, msgId });
        msgInput.value = '';
    }
}

socket.on('receive-message', (data) => {
    const existingMsg = document.getElementById(data.msgId);
    if (existingMsg) {
        // Eğer mesaj daha önce gönderilmişse ve güncellendiyse metni değiştir
        existingMsg.querySelector('.msg-text').innerText = data.text + ' (düzenlendi)';
        return;
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-row ${data.id === socket.id ? 'self' : ''}`;
    msgDiv.id = data.msgId;
    msgDiv.innerHTML = `
        <div class="avatar">${data.user.charAt(0).toUpperCase()}</div>
        <div class="msg-content">
            <span class="user-name">${data.user}</span>
            <p class="msg-text">${data.text}</p>
            ${data.id === socket.id ? '<span class="msg-actions" onclick="editMessage(\'' + data.msgId + '\')">✏️ Düzenle</span>' : ''}
        </div>
    `;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Eğer mesajı başkası attıysa bildirim göster (Film izlerken / ekran büyükken üstten bildirim)
    if (data.id !== socket.id) {
        showNotification(data.user, data.text);
    }
});

function editMessage(msgId) {
    const msgDiv = document.getElementById(msgId);
    if (!msgDiv) return;
    const textP = msgDiv.querySelector('.msg-text');
    const newText = prompt("Mesajınızı düzenleyin:", textP.innerText.replace(' (düzenlendi)', ''));
    if (newText !== null && newText.trim() !== '') {
        socket.emit('send-message', { roomId: currentRoom, text: newText.trim(), user: currentUsername, id: socket.id, msgId });
    }
}

function showNotification(sender, text) {
    notifSender.innerText = sender;
    notifText.innerText = text;
    messageNotification.style.display = 'block';
    // Animasyonu yeniden tetiklemek için class toggle
    messageNotification.style.animation = 'none';
    messageNotification.offsetHeight; /* trigger reflow */
    messageNotification.style.animation = 'fadeInOut 3s ease forwards';
    
    setTimeout(() => {
        messageNotification.style.display = 'none';
    }, 3000);
}

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