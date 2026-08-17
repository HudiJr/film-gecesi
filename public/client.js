// ==========================================
// Film Gecesi - Client Side Logic (client.js)
// ==========================================

const socket = io();

// DOM Elemanları
const roomInput = document.getElementById('roomInput') || document.querySelector('input[placeholder*="film"]');
const usernameInput = document.getElementById('usernameInput') || document.querySelector('input[placeholder*="Kullanıcı"]');
const createRoomBtn = document.getElementById('createRoomBtn') || document.querySelectorAll('button')[0];
const joinRoomBtn = document.getElementById('joinRoomBtn') || document.querySelectorAll('button')[1];

const shareScreenBtn = document.getElementById('shareScreenBtn') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Ekranımı Paylaş'));
const micBtn = document.getElementById('micBtn') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Mikrofon'));
const cameraBtn = document.getElementById('cameraBtn') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Kamera'));

const mainVideo = document.querySelector('video');

// Akış (Stream) Değişkenleri
let screenStream = null;
let userMediaStream = null;
let isMicOpen = true;
let isCamOpen = true;

// 1. Mobil Uyum & Video Başlangıç Ayarları
if (mainVideo) {
    mainVideo.setAttribute('playsinline', '');
    mainVideo.setAttribute('webkit-playsinline', '');
}

// 2. Ekran Paylaşımı Fonksiyonu (Mobil ve PC Uyumlu)
if (shareScreenBtn) {
    shareScreenBtn.addEventListener('click', async () => {
        try {
            if (!screenStream) {
                // Ekran paylaşımını başlat
                screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { cursor: "always", frameRate: { max: 30 } },
                    audio: true
                });

                if (mainVideo) {
                    mainVideo.srcObject = screenStream;
                    mainVideo.play().catch(e => console.log("Oynatma hatası:", e));
                }

                shareScreenBtn.innerText = "🛑 Paylaşımı Durdur";

                // Tarayıcı üzerinden paylaşım durdurulduğunda
                screenStream.getVideoTracks()[0].onended = () => {
                    stopScreenSharing();
                };
            } else {
                stopScreenSharing();
            }
        } catch (err) {
            console.error("Ekran paylaşımı başlatılamadı:", err);
        }
    });
}

function stopScreenSharing() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }
    if (mainVideo) {
        mainVideo.srcObject = null;
    }
    if (shareScreenBtn) {
        shareScreenBtn.innerText = "🖥️ Ekranımı Paylaş";
    }
}

// 3. Mikrofon / Kamera Kontrolleri
if (micBtn) {
    micBtn.addEventListener('click', () => {
        if (userMediaStream) {
            const audioTrack = userMediaStream.getAudioTracks()[0];
            if (audioTrack) {
                isMicOpen = !isMicOpen;
                audioTrack.enabled = isMicOpen;
                micBtn.innerText = isMicOpen ? "🎤 Mikrofon: Açık" : "🎙️ Mikrofon: Kapalı";
            }
        }
    });
}

if (cameraBtn) {
    cameraBtn.addEventListener('click', async () => {
        if (!userMediaStream) {
            try {
                userMediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                isCamOpen = true;
                cameraBtn.innerText = "📷 Kamera: Açık";
            } catch (err) {
                console.error("Kamera açılamadı:", err);
            }
        } else {
            const videoTrack = userMediaStream.getVideoTracks()[0];
            if (videoTrack) {
                isCamOpen = !isCamOpen;
                videoTrack.enabled = isCamOpen;
                cameraBtn.innerText = isCamOpen ? "📷 Kamera: Açık" : "📷 Kamera: Kapalı";
            }
        }
    });
}

// 4. Oda Yönetimi (Socket.io)
if (createRoomBtn) {
    createRoomBtn.addEventListener('click', () => {
        const roomName = roomInput ? roomInput.value.trim() : '';
        const username = usernameInput ? usernameInput.value.trim() : 'Kullanıcı';
        if (roomName) {
            socket.emit('create-room', { roomName, username });
        }
    });
}

if (joinRoomBtn) {
    joinRoomBtn.addEventListener('click', () => {
        const roomName = roomInput ? roomInput.value.trim() : '';
        const username = usernameInput ? usernameInput.value.trim() : 'Kullanıcı';
        if (roomName) {
            socket.emit('join-room', { roomName, username });
        }
    });
}