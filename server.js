const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Public klasörünü dışarıya açıyoruz
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io Canlı Bağlantı Mantığı
io.on('connection', (socket) => {
    console.log('Bir kullanıcı bağlandı:', socket.id);

    // Odaya Katılma
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`${socket.id} kullanıcısı ${roomId} odasına katıldı.`);
    });

    // Video Senkronizasyonu (Oynat / Durdur / Saniye Değiştir)
    socket.on('video-action', (data) => {
        socket.to(data.roomId).emit('video-action', data);
    });

    // Chat Mesajları
    socket.on('send-message', (data) => {
        io.to(data.roomId).emit('receive-message', data);
    });

    // WebRTC Kamera ve Ses Sinyalleri
    socket.on('signal', (data) => {
        socket.to(data.roomId).emit('signal', {
            signal: data.signal,
            from: socket.id
        });
    });

    socket.on('disconnect', () => {
        console.log('Kullanıcı ayrıldı:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu hazır! http://localhost:${PORT}`);
});