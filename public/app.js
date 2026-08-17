// DOM Elemanları
const shareBtn = document.getElementById('shareBtn');
const stopBtn = document.getElementById('stopBtn');
const statusMsg = document.getElementById('statusMsg');

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// Kontrol Butonları & Rozetler
const localRewindBtn = document.getElementById('localRewindBtn');
const localForwardBtn = document.getElementById('localForwardBtn');
const localGoLiveBtn = document.getElementById('localGoLiveBtn');
const localLiveBadge = document.getElementById('localLiveBadge');

const remoteRewindBtn = document.getElementById('remoteRewindBtn');
const remoteForwardBtn = document.getElementById('remoteForwardBtn');
const remoteGoLiveBtn = document.getElementById('remoteGoLiveBtn');
const remoteLiveBadge = document.getElementById('remoteLiveBadge');

let localStream = null;

// Time-Shift (Arabellek/Kayıt) Yönetimi İçin Nesne Yapısı
function createBufferPlayer(videoElement, liveBadge, goLiveBtn) {
    let mediaRecorder = null;
    let recordedChunks = [];
    let liveStream = null;
    let isLiveMode = true;

    return {
        // Canlı akış başladığında kaydediciyi de başlat
        startBuffering: (stream) => {
            liveStream = stream;
            recordedChunks = [];
            isLiveMode = true;

            // Video kaynağını ilk başta canlı stream olarak ayarla
            videoElement.srcObject = stream;
            videoElement.play();

            try {
                // Her 1 saniyede bir veriyi kaydet (Timeslice = 1000ms)
                mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
            } catch (e) {
                // WebM Desteklenmiyorsa varsayılan formatı kullan
                mediaRecorder = new MediaRecorder(stream);
            }

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.start(1000); // 1 saniyelik parçalar halinde kaydet
        },

        // Geri veya İleri Sarma İşlemi
        seek: (seconds) => {
            if (recordedChunks.length === 0) return;

            // Eğer şu an canlı moddaysak, kaydı Blob video kaynağına dönüştür
            if (isLiveMode) {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const videoURL = URL.createObjectURL(blob);
                
                // Anlık izleme süresini sakla
                const duration = recordedChunks.length; 
                
                videoElement.srcObject = null; // Canlı akıştan çık
                videoElement.src = videoURL;
                videoElement.currentTime = Math.max(0, duration + seconds);
                videoElement.play();

                isLiveMode = false;
                liveBadge.innerText = "GEÇMİŞ (Sarılan)";
                liveBadge.classList.add('delayed');
                goLiveBtn.style.display = 'inline-block';
            } else {
                // Zaten kayıtlı tampon üzerinde geziniliyorsa
                const newTime = videoElement.currentTime + seconds;
                
                // İleri sararken video sonuna gelindiyse canlıya dön
                if (newTime >= videoElement.duration) {
                    player.goLive();
                } else {
                    videoElement.currentTime = Math.max(0, newTime);
                }
            }
        },

        // Tekrar Canlı Yayına Dönüş
        goLive: () => {
            if (!liveStream) return;
            
            videoElement.src = '';
            videoElement.srcObject = liveStream;
            videoElement.play();

            isLiveMode = true;
            liveBadge.innerText = "CANLI";
            liveBadge.classList.remove('delayed');
            goLiveBtn.style.display = 'none';
        },

        // Temizlik
        stop: () => {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            recordedChunks = [];
            videoElement.srcObject = null;
            videoElement.src = '';
            isLiveMode = true;
            liveBadge.innerText = "CANLI";
            liveBadge.classList.remove('delayed');
            goLiveBtn.style.display = 'none';
        }
    };
}

// Oyuncuları Tanımla
const localPlayer = createBufferPlayer(localVideo, localLiveBadge, localGoLiveBtn);
const remotePlayer = createBufferPlayer(remoteVideo, remoteLiveBadge, remoteGoLiveBtn);

// ----------------------------------------------------
// 1. Cihaz & Tarayıcı Kontrolü
// ----------------------------------------------------
function checkScreenShareSupport() {
    const isSecureContext = window.isSecureContext;
    const hasDisplayMedia = navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices;

    if (!isSecureContext) {
        statusMsg.innerText = "Uyarı: Ekran paylaşımı sadece HTTPS bağlantılarda çalışır.";
        shareBtn.disabled = true;
        return false;
    }

    if (!hasDisplayMedia) {
        statusMsg.innerText = "Mobil tarayıcınız veya mevcut uygulama içi tarayıcı ekran paylaşımını desteklemiyor. Lütfen masaüstü tarayıcı kullanın.";
        shareBtn.disabled = true;
        return false;
    }

    return true;
}

document.addEventListener('DOMContentLoaded', checkScreenShareSupport);

// ----------------------------------------------------
// 2. Ekran Paylaşımı Başlatma (User Gesture)
// ----------------------------------------------------
shareBtn.addEventListener('click', async () => {
    statusMsg.innerText = "";

    try {
        const displayMediaOptions = {
            video: { cursor: "always", frameRate: { max: 30 } },
            audio: false
        };

        localStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

        // Kendi ekranımız için arabellek ve canlı oynatıcıyı başlat
        localPlayer.startBuffering(localStream);

        shareBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';

        // Yayın tarayıcı üzerinden durdurulursa
        localStream.getVideoTracks()[0].addEventListener('ended', stopScreenShare);

    } catch (err) {
        console.error("Ekran paylaşımı başlatılamadı:", err);
        statusMsg.innerText = err.name === 'NotAllowedError' 
            ? "Ekran paylaşımı izni reddedildi." 
            : "Ekran paylaşımı hatası: " + err.message;
    }
});

// ----------------------------------------------------
// 3. Paylaşımı Durdurma
// ----------------------------------------------------
function stopScreenShare() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    localPlayer.stop();

    shareBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    statusMsg.innerText = "";
}

stopBtn.addEventListener('click', stopScreenShare);

// ----------------------------------------------------
// 4. Partner Yayını Geldiğinde (WebRTC Bağlantısında)
// ----------------------------------------------------
function handleRemoteStream(remoteStream) {
    // Partner yayını geldiğinde partner oyuncusunu başlat
    remotePlayer.startBuffering(remoteStream);
}

// ----------------------------------------------------
// 5. İleri / Geri Sarma Buton Event Listener'ları
// ----------------------------------------------------

// Kendi Ekranınız İçin
localRewindBtn.addEventListener('click', () => localPlayer.seek(-10));
localForwardBtn.addEventListener('click', () => localPlayer.seek(10));
localGoLiveBtn.addEventListener('click', () => localPlayer.goLive());

// Partner Ekranı İçin
remoteRewindBtn.addEventListener('click', () => remotePlayer.seek(-10));
remoteForwardBtn.addEventListener('click', () => remotePlayer.seek(10));
remoteGoLiveBtn.addEventListener('click', () => remotePlayer.goLive());