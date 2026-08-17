// DOM Elemanları
const screenShareBtn = document.getElementById('screenShareBtn');
const cameraBtn = document.getElementById('cameraBtn');
const usernameInput = document.getElementById('usernameInput');
const mainScreenVideo = document.getElementById('mainScreenVideo');
const screenPlaceholder = document.getElementById('screenSharePlaceholder');
const cameraGrid = document.getElementById('cameraGrid');

let currentScreenStream = null;
let currentCamStream = null;
let isSharingScreen = false;
let isCamOpen = false;

const MAX_CAMERAS = 6;

// ----------------------------------------------------
// 1. Ekran Paylaşımı Fonksiyonu (Tıklanmama Sorununu Çözen Kısım)
// ----------------------------------------------------
screenShareBtn.addEventListener('click', async () => {
    if (!isSharingScreen) {
        try {
            // Ekran paylaşımı isteği doğrudan tıklama içerisinde tetiklenir
            currentScreenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always", frameRate: { max: 30 } },
                audio: true
            });

            mainScreenVideo.srcObject = currentScreenStream;
            mainScreenVideo.style.display = 'block';
            screenPlaceholder.style.display = 'none';

            screenShareBtn.innerText = "Paylaşımı Durdur";
            screenShareBtn.classList.add('active');
            isSharingScreen = true;

            // Kullanıcı Chrome/Sistem üzerinden paylaşımı durdurursa
            currentScreenStream.getVideoTracks()[0].addEventListener('ended', () => {
                stopScreenShare();
            });

        } catch (err) {
            console.error("Ekran paylaşımı başlatılamadı:", err);
            alert("Ekran paylaşımı başlatılamadı veya izin verilmedi.");
        }
    } else {
        stopScreenShare();
    }
});

function stopScreenShare() {
    if (currentScreenStream) {
        currentScreenStream.getTracks().forEach(track => track.stop());
        currentScreenStream = null;
    }
    mainScreenVideo.srcObject = null;
    mainScreenVideo.style.display = 'none';
    screenPlaceholder.style.display = 'flex';

    screenShareBtn.innerText = "Ekranı Paylaş";
    screenShareBtn.classList.remove('active');
    isSharingScreen = false;
}

// ----------------------------------------------------
// 2. Kamera Açma / Kapama (Kendi Kameranız)
// ----------------------------------------------------
cameraBtn.addEventListener('click', async () => {
    const currentCamCount = cameraGrid.children.length;

    if (!isCamOpen) {
        if (currentCamCount >= MAX_CAMERAS) {
            alert(`Oda dolu! Maksimum ${MAX_CAMERAS} kişi kamera açabilir.`);
            return;
        }

        try {
            currentCamStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            const myUsername = usernameInput.value.trim() || "Kullanıcı";
            addCameraBox('my-cam', myUsername, currentCamStream, true);

            cameraBtn.innerText = "Kamerayı Kapat";
            isCamOpen = true;

        } catch (err) {
            console.error("Kamera açılamadı:", err);
            alert("Kameranıza erişilemedi.");
        }
    } else {
        if (currentCamStream) {
            currentCamStream.getTracks().forEach(track => track.stop());
            currentCamStream = null;
        }
        removeCameraBox('my-cam');
        cameraBtn.innerText = "Kamerayı Aç";
        isCamOpen = false;
    }
});

// ----------------------------------------------------
// 3. Kamera Kutusu Ekleme (6 Kişilik Limit ve Kullanıcı Adı)
// ----------------------------------------------------
function addCameraBox(id, username, stream, isMuted = false) {
    // Eğer kilitli sayıya ulaşıldıysa yeni kamera ekleme
    if (cameraGrid.children.length >= MAX_CAMERAS && !document.getElementById(id)) {
        console.warn("Maksimum kamera limitine ulaşıldı.");
        return;
    }

    // Var olan bir kutu varsa güncelle
    let camCard = document.getElementById(id);
    if (!camCard) {
        camCard = document.createElement('div');
        camCard.id = id;
        camCard.className = 'camera-card';

        const videoEl = document.createElement('video');
        videoEl.autoplay = true;
        videoEl.playsInline = true;
        videoEl.muted = isMuted; // Kendi sesimizin geri yankılanmaması için
        videoEl.srcObject = stream;

        const nameLabel = document.createElement('span');
        nameLabel.className = 'user-badge';
        nameLabel.innerText = username;

        camCard.appendChild(videoEl);
        camCard.appendChild(nameLabel);
        cameraGrid.appendChild(camCard);
    }
}

function removeCameraBox(id) {
    const camCard = document.getElementById(id);
    if (camCard) {
        camCard.remove();
    }
}