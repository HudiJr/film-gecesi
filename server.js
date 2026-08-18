const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Statik dosyaları 'public' klasöründen servis ediyoruz
app.use(express.static(path.join(__dirname, 'public')));

// Ana sayfa yönlendirmesi
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const rooms = {};

function broadcastRooms() {
    const roomList = Object.keys(rooms).map(id => ({
        id,
        userCount: Object.keys(rooms[id].users).length,
        hasPassword: !!rooms[id].password
    }));
    io.emit('room-list', roomList);
}

io.on('connection', (socket) => {
    // Oda listesini hemen gönder
    socket.emit('room-list', Object.keys(rooms).map(id => ({
        id,
        userCount: Object.keys(rooms[id].users).length,
        hasPassword: !!rooms[id].password
    })));

    socket.on('create-room', ({ roomId, password, peerId, username, avatar }) => {
        if (rooms[roomId]) {
            return socket.emit('error-msg', 'Bu isimde bir oda zaten var!');
        }
        rooms[roomId] = { 
            password: password || null, 
            users: {},
            activeMedia: null // Dinamik arayüz ve medya durumu için eklendi
        };
        socket.join(roomId);
        rooms[roomId].users[socket.id] = { peerId, username, avatar };
        socket.emit('room-joined', { roomId, existingUsers: rooms[roomId].users, isHost: true });
        broadcastRooms();
    });

    socket.on('join-room', ({ roomId, password, peerId, username, avatar }) => {
        const room = rooms[roomId];
        if (!room) return socket.emit('error-msg', 'Böyle bir oda bulunamadı!');
        if (room.password && room.password !== password) return socket.emit('error-msg', 'Hatalı şifre!');
        if (Object.keys(room.users).length >= 6) return socket.emit('error-msg', 'Oda dolu! (Max 6 kişi)');

        socket.join(roomId);
        room.users[socket.id] = { peerId, username, avatar };
        socket.emit('room-joined', { roomId, existingUsers: room.users, isHost: false });
        
        // Eğer odada aktif bir medya/ekran paylaşımı varsa yeni gelene senkronize et
        if (room.activeMedia) {
            socket.emit('sync-media-state', room.activeMedia);
        }

        socket.to(roomId).emit('user-connected', { peerId, username, avatar, socketId: socket.id });
        broadcastRooms();
    });

    socket.on('screen-share-started', ({ roomId, peerId }) => {
        if (rooms[roomId]) {
            rooms[roomId].activeMedia = { type: 'screenshare', peerId };
        }
        socket.to(roomId).emit('screen-share-started', { peerId });
        io.to(roomId).emit('sync-media-state', rooms[roomId]?.activeMedia);
    });

    socket.on('screen-share-stopped', ({ roomId }) => {
        if (rooms[roomId]) {
            rooms[roomId].activeMedia = null;
        }
        socket.to(roomId).emit('screen-share-stopped');
        io.to(roomId).emit('sync-media-state', null);
    });

    socket.on('change-yt-video', ({ roomId, videoId }) => {
        if (rooms[roomId]) {
            rooms[roomId].activeMedia = { type: 'youtube', videoId };
        }
        io.to(roomId).emit('yt-video-changed', { videoId });
        io.to(roomId).emit('sync-media-state', rooms[roomId]?.activeMedia);
    });

    socket.on('change-google-url', ({ roomId, url }) => {
        if (rooms[roomId]) {
            rooms[roomId].activeMedia = { type: 'google', url };
        }
        io.to(roomId).emit('google-url-changed', { url });
        io.to(roomId).emit('sync-media-state', rooms[roomId]?.activeMedia);
    });

    socket.on('leave-room', ({ roomId }) => {
        socket.leave(roomId);
        if (rooms[roomId] && rooms[roomId].users[socket.id]) {
            const peerId = rooms[roomId].users[socket.id].peerId;
            delete rooms[roomId].users[socket.id];
            io.to(roomId).emit('user-disconnected', { peerId, socketId: socket.id });
            if (Object.keys(rooms[roomId].users).length === 0) {
                delete rooms[roomId];
            } else if (!rooms[roomId].activeMedia && rooms[roomId].activeMedia?.peerId === peerId) {
                io.to(roomId).emit('sync-media-state', null);
            }
            broadcastRooms();
        }
    });

    socket.on('disconnecting', () => {
        for (const roomId of socket.rooms) {
            if (rooms[roomId] && rooms[roomId].users[socket.id]) {
                const peerId = rooms[roomId].users[socket.id].peerId;
                delete rooms[roomId].users[socket.id];
                io.to(roomId).emit('user-disconnected', { peerId, socketId: socket.id });
                if (Object.keys(rooms[roomId].users).length === 0) {
                    delete rooms[roomId];
                }
                broadcastRooms();
            }
        }
    });

    socket.on('send-message', (data) => {
        io.to(data.roomId).emit('receive-message', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda aktif.`));