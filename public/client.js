const socket = io();
const peer = new Peer();

const authPage = document.getElementById('authPage');
const landingPage = document.getElementById('landingPage');
const roomPage = document.getElementById('roomPage');

const authUsername = document.getElementById('authUsername');
const authFileAvatar = document.getElementById('authFileAvatar');
const selectedAvatarPreview = document.getElementById('selectedAvatarPreview');
const selectedAvatarText = document.getElementById('selectedAvatarText');
const authLoginBtn = document.getElementById('authLoginBtn');
const presetAvatars = document.querySelectorAll('.preset-avatar');

const userAvatarPreview = document.getElementById('userAvatarPreview');
const userNameDisplay = document.getElementById('userNameDisplay');
const editProfileBtn = document.getElementById('editProfileBtn');

const landingRoomInput = document.getElementById('landingRoomInput');
const landingPassword = document.getElementById('landingPassword');
const landingCreateBtn = document.getElementById('landingCreateBtn');
const landingJoinBtn = document.getElementById('landingJoinBtn');
const landingRoomsList = document.getElementById('landingRoomsList');
const roomsList = document.getElementById('roomsList');

const displayUsername = document.getElementById('displayUsername');
const roomUserAvatar = document.getElementById('roomUserAvatar');
const leaveBtn = document.getElementById('leaveBtn');
const roomTitleDisplay = document.getElementById('roomTitleDisplay');

const camerasGrid = document.getElementById('camerasGrid');
const localVideo = document.getElementById('localVideo');
const mainVideo = document.getElementById('mainVideo');
const youtubePlayerContainer = document.getElementById('youtubePlayerContainer');
const iframeWrapper = document.getElementById('iframeWrapper');
const googlePlayer = document.getElementById('googlePlayer');
const iframeBackBtn = document.getElementById('iframeBackBtn');
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
const netflixModalBtn = document.getElementById('netflixModalBtn');

const chatMessages = document.getElementById('chatMessages');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const toggleMicBtn = document.getElementById('toggleMicBtn');
const toggleCamBtn = document.getElementById('toggleCamBtn');
const switchCamBtn = document.getElementById('switchCamBtn');
const messageNotification = document.getElementById('messageNotification');
const notifSender = document.getElementById('notifSender');
const notifText = document.getElementById('notifText');

let currentRoom = '';
let currentUsername = 'Kullanıcı';
let currentAvatar = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150';
let localStream = null;
let screenStream = null;
let useFrontCamera = true;
let myPeerId = '';
const peers = {};

// YouTube Player Değişkenleri
let ytPlayer = null;
let isSyncingFromRemote = false;

peer.on('open', (id) => { myPeerId = id; });

// Avatar Seçimleri
presetAvatars.forEach(img => {
    img.addEventListener('click', () => {
        presetAvatars.forEach(i => i.classList.remove('selected'));
        img.classList.add('selected');
        currentAvatar = img.src;
        selectedAvatarPreview.src = currentAvatar;
        selectedAvatarText.innerText = 'Hazır Avatar Seçildi';
    });
});

authFileAvatar.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(uploadEvent) {
            currentAvatar = uploadEvent.target.result;
            selectedAvatarPreview.src = currentAvatar;
            selectedAvatarText.innerText = 'Cihazdan Fotoğraf Seçildi';
            presetAvatars.forEach(i => i.classList.remove('selected'));
        };
        reader.readAsDataURL(file);
    }
});

window.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('film_username');
    const savedAvatar = localStorage.getItem('film_avatar');
    
    if (savedUser) {
        currentUsername = savedUser;
        currentAvatar = savedAvatar || currentAvatar;
        authPage.style.display = 'none';
        landingPage.style.display = 'flex';
        userNameDisplay.innerText = currentUsername;
        userAvatarPreview.src = currentAvatar;
    }
});

authLoginBtn.addEventListener('click', () => {
    const username = authUsername.value.trim();
    if (!username) return alert('Lütfen bir kullanıcı adı girin!');
    currentUsername = username;
    localStorage.setItem('film_username', currentUsername);
    localStorage.setItem('film_avatar', currentAvatar);
    authPage.style.display = 'none';
    landingPage.style.display = 'flex';
    userNameDisplay.innerText = currentUsername;
    userAvatarPreview.src = currentAvatar;
});

editProfileBtn.addEventListener('click', () => {
    localStorage.removeItem('film_username');
    localStorage.removeItem('film_avatar');
    landingPage.style.display = 'none';
    authPage.style.display = 'flex';
    authUsername.value = currentUsername;
    selectedAvatarPreview.src = currentAvatar;
});

socket.on('room-list', (list) => {
    updateRoomListUI(landingRoomsList, list);
    updateRoomListUI(roomsList, list);
});

function updateRoomListUI(container, list) {
    if (!container) return;
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

landingCreateBtn.addEventListener('click', async () => {
    currentRoom = landingRoomInput.value.trim();
    const password = landingPassword.value.trim();
    if (!currentRoom) return alert('Lütfen oda adı girin!');
    await startCamera();
    socket.emit('create-room', { roomId: currentRoom, password, peerId: myPeerId, username: currentUsername, avatar: currentAvatar });
});

landingJoinBtn.addEventListener('click', async () => {
    currentRoom = landingRoomInput.value.trim();
    const password = landingPassword.value.trim();
    if (!currentRoom) return alert('Lütfen oda adı girin!');
    await startCamera();
    socket.emit('join-room', { roomId: currentRoom, password, peerId: myPeerId, username: currentUsername, avatar: currentAvatar });
});

leaveBtn.addEventListener('click', () => {
    if (currentRoom) {
        socket.emit('leave-room', { roomId: currentRoom });
        location.reload();
    }
});

async function startCamera(isSwitch = false) {
    try {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        const constraints = {
            video: { facingMode: useFrontCamera ? 'user' : 'environment' },
            audio: true
        };

        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        localVideo.srcObject = localStream;

        if (isSwitch && currentRoom) {
            Object.values(peers).forEach(call => {
                const sender = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) sender.replaceTrack(localStream.getVideoTracks()[0]);
            });
        }
    } catch (err) { console.error('Kamera hatası:', err); }
}

switchCamBtn.addEventListener('click', () => {
    useFrontCamera = !useFrontCamera;
    startCamera(true);
});

socket.on('error-msg', (msg) => alert(msg));

socket.on('room-joined', ({ roomId, existingUsers }) => {
    landingPage.style.display = 'none';
    roomPage.style.display = 'flex';
    displayUsername.innerText = currentUsername;
    roomUserAvatar.src = currentAvatar;
    roomTitleDisplay.innerText = `Film Gecesi 🍿 - Oda: ${roomId}`;

    Object.values(existingUsers).forEach(user => {
        if (user.peerId && user.peerId !== myPeerId) connectToNewUser(user.peerId, user.username, user.avatar, localStream);
    });
});

socket.on('user-connected', ({ peerId, username, avatar }) => {
    if (peerId && localStream) setTimeout(() => connectToNewUser(peerId, username, avatar, localStream), 1000);
});

peer.on('call', (call) => {
    call.answer(localStream);
    call.on('stream', (remoteStream) => {
        if (call.metadata && call.metadata.type === 'screen') setMainScreenShareStream(remoteStream);
        else addRemoteVideoStream(`card-${call.peer}`, 'Katılımcı', '', remoteStream);
    });
});

function connectToNewUser(peerId, username, avatar, stream) {
    const call = peer.call(peerId, stream, { metadata: { type: 'camera' } });
    call.on('stream', (userVideoStream) => addRemoteVideoStream(`card-${peerId}`, username, avatar, userVideoStream));
    peers[peerId] = call;
    if (screenStream) peer.call(peerId, screenStream, { metadata: { type: 'screen' } });
}

function addRemoteVideoStream(cardId, username, avatar, stream) {
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

function setMainScreenShareStream(stream) {
    hideAllPlayers();
    mainVideo.style.display = 'block';
    mainVideo.srcObject = stream;
    mainVideo.play().catch(e => console.log(e));
}

function hideAllPlayers() {
    noStreamPlaceholder.style.display = 'none';
    mainVideo.style.display = 'none';
    youtubePlayerContainer.style.display = 'none';
    iframeWrapper.style.display = 'none';
}

socket.on('user-disconnected', ({ peerId }) => {
    if (peers[peerId]) peers[peerId].close();
    const card = document.getElementById(`card-${peerId}`);
    if (card) card.remove();
});

// Ekran Paylaşımı
shareScreenBtn.addEventListener('click', async () => {
    if (!currentRoom) return alert('Önce bir odaya katılın!');
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        setMainScreenShareStream(screenStream);
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
    hideAllPlayers();
    noStreamPlaceholder.style.display = 'block';
    socket.emit('screen-share-stopped', { roomId: currentRoom });
}

socket.on('screen-share-stopped', () => {
    hideAllPlayers();
    noStreamPlaceholder.style.display = 'block';
});

// ================= YOUTUBE API ENTEGRASYONU =================
ytModalBtn.addEventListener('click', () => {
    ytInputBar.style.display = ytInputBar.style.display === 'none' ? 'flex' : 'none';
    googleInputBar.style.display = 'none';
});

ytLoadBtn.addEventListener('click', () => {
    const inputVal = ytUrlInput.value.trim();
    if (!inputVal || !currentRoom) return alert('Lütfen bir video linki veya arama terimi girin!');
    
    const videoId = extractYouTubeId(inputVal);
    if (videoId) {
        // Direkt Video ID bulunduysa yükle ve diğerlerine bildir
        socket.emit('change-yt-video', { roomId: currentRoom, videoId: videoId });
        ytInputBar.style.display = 'none';
        ytUrlInput.value = '';
    } else {
        // Arama terimiyse basitçe ilk çıkan popüler video ID'sini bulmak yerine örnek bir arama veya doğrudan video yönlendirmesi yapabiliriz
        // Watch2Gether mantığında doğrudan video ID girilmesi en sağlıklısıdır. Kullanıcıya bilgi verelim:
        alert('Lütfen geçerli bir YouTube video linki girin (Örn: https://www.youtube.com/watch?v=...)');
    }
});

function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?\s]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Socket'ten YouTube video değişimi geldiğinde
socket.on('yt-video-changed', ({ videoId }) => {
    hideAllPlayers();
    youtubePlayerContainer.style.display = 'block';
    
    if (!ytPlayer) {
        ytPlayer = new YT.Player('youtubePlayerContainer', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: { 'autoplay': 1, 'controls': 1 },
            events: {
                'onStateChange': onPlayerStateChange
            }
        });
    } else {
        isSyncingFromRemote = true;
        ytPlayer.loadVideoById(videoId);
        setTimeout(() => { isSyncingFromRemote = false; }, 1000);
    }
});

function onPlayerStateChange(event) {
    if (isSyncingFromRemote) return;
    
    // Oynatma (Play)
    if (event.data === YT.PlayerState.PLAYING) {
        const currentTime = ytPlayer.getCurrentTime();
        socket.emit('yt-sync-action', { roomId: currentRoom, action: 'play', time: currentTime });
    }
    // Durdurma (Pause)
    else if (event.data === YT.PlayerState.PAUSED) {
        const currentTime = ytPlayer.getCurrentTime();
        socket.emit('yt-sync-action', { roomId: currentRoom, action: 'pause', time: currentTime });
    }
}

// Senkronizasyon Komutları Dinleme
socket.on('yt-sync-action', ({ action, time }) => {
    if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
    isSyncingFromRemote = true;
    
    if (Math.abs(ytPlayer.getCurrentTime() - time) > 1.5) {
        ytPlayer.seekTo(time, true);
    }
    
    if (action === 'play') {
        ytPlayer.playVideo();
    } else if (action === 'pause') {
        ytPlayer.pauseVideo();
    }
    
    setTimeout(() => { isSyncingFromRemote = false; }, 1000);
});

// ================= GOOGLE VE HARİCİ SİTELER (İFRAME) =================
googleModalBtn.addEventListener('click', () => {
    googleInputBar.style.display = googleInputBar.style.display === 'none' ? 'flex' : 'none';
    ytInputBar.style.display = 'none';
});

googleLoadBtn.addEventListener('click', () => {
    const query = googleUrlInput.value.trim();
    if (!query || !currentRoom) return alert('Lütfen arama terimi veya adres girin!');
    
    let targetUrl = query;
    if (!query.startsWith('http://') && !query.startsWith('https://')) {
        targetUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&igu=1`;
    }
    
    socket.emit('change-google-url', { roomId: currentRoom, url: targetUrl });
    googleInputBar.style.display = 'none';
    googleUrlInput.value = '';
});

socket.on('google-url-changed', ({ url }) => {
    hideAllPlayers();
    iframeWrapper.style.display = 'block';
    googlePlayer.src = url;
});

// Geri Çıkma Butonu (İframe içindeyken ana ekrana/aramaya dönmek için)
iframeBackBtn.addEventListener('click', () => {
    googlePlayer.src = '';
    hideAllPlayers();
    noStreamPlaceholder.style.display = 'block';
});

netflixModalBtn.addEventListener('click', () => {
    alert('Netflix korumaları nedeniyle doğrudan site içine gösterilememektedir. Ortak film izlemek için "Ekranımı Paylaş" özelliğini kullanabilirsiniz!');
});

// ================= SOHBET VE KAMERA KONTROLLERİ =================
sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
    const text = msgInput.value.trim();
    if (text && currentRoom) {
        const msgId = 'msg_' + Date.now() + Math.random().toString(36).substr(2, 5);
        socket.emit('send-message', { roomId: currentRoom, text, user: currentUsername, avatar: currentAvatar, id: socket.id, msgId });
        msgInput.value = '';
    }
}

socket.on('receive-message', (data) => {
    const existingMsg = document.getElementById(data.msgId);
    if (existingMsg) {
        existingMsg.querySelector('.msg-text').innerText = data.text + ' (düzenlendi)';
        return;
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-row ${data.id === socket.id ? 'self' : ''}`;
    msgDiv.id = data.msgId;
    msgDiv.innerHTML = `
        <div class="avatar"><img src="${data.avatar || 'https://via.placeholder.com/150'}"></div>
        <div class="msg-content">
            <span class="user-name">${data.user}</span>
            <p class="msg-text">${data.text}</p>
            ${data.id === socket.id ? '<span class="msg-actions" onclick="editMessage(\'' + data.msgId + '\')">✏️ Düzenle</span>' : ''}
        </div>
    `;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

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
        socket.emit('send-message', { roomId: currentRoom, text: newText.trim(), user: currentUsername, avatar: currentAvatar, id: socket.id, msgId });
    }
}

function showNotification(sender, text) {
    notifSender.innerText = sender;
    notifText.innerText = text;
    messageNotification.style.display = 'block';
    messageNotification.style.animation = 'none';
    messageNotification.offsetHeight;
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