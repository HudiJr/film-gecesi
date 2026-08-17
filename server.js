const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

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
    socket.emit('room-list', Object.keys(rooms).map(id => ({
        id,
        userCount: Object.keys(rooms[id].users).length,
        hasPassword: !!rooms[id].password
    })));

    // Oda Oluşturma
    socket.on('create-room', ({ roomId, password, peerId, username }) => {
        if (rooms[roomId]) {
            return socket.emit('error-msg', 'Bu isimde bir oda zaten var! Başka bir isim deneyin veya Katıl butonunu kullanın.');
        }
        rooms[roomId] = {
            password: password || null,
            users: {}
        };

        socket.join(roomId);
        rooms[roomId].users[socket.id] = { peerId, username };

        socket.emit('room-joined', { roomId, existingUsers: rooms[roomId].users, isHost: true });
        broadcastRooms();
    });

    // Odaya Katılma
    socket.on('join-room', ({ roomId, password, peerId, username }) => {
        const room = rooms[roomId];
        if (!room) {
            return socket.emit('error-msg', 'Böyle bir oda bulunamadı! Önce Oda Kur butonunu kullanın.');
        }
        if (room.password && room.password !== password) {
            return socket.emit('error-msg', 'Hatalı oda şifresi!');
        }
        if (Object.keys(room.users).length >= 6) {
            return socket.emit('error-msg', 'Oda dolu! (Max 6 kişi)');
        }

        socket.join(roomId);
        room.users[socket.id] = { peerId, username };

        socket.emit('room-joined', { roomId, existingUsers: room.users, isHost: false });
        socket.to(roomId).emit('user-connected', { peerId, username, socketId: socket.id });

        broadcastRooms();
    });

    // Ekran Paylaşımı Başladı / Bitti Duyurusu
    socket.on('screen-share-started', ({ roomId, peerId }) => {
        socket.to(roomId).emit('screen-share-started', { peerId });
    });

    socket.on('screen-share-stopped', ({ roomId }) => {
        socket.to(roomId).emit('screen-share-stopped');
    });

    // YouTube Senkronizasyonu (Arama veya Video)
    socket.on('change-yt-video', ({ roomId, type, value }) => {
        io.to(roomId).emit('yt-video-changed', { type, value });
    });

    // Odadan Ayrılma
    socket.on('leave-room', ({ roomId }) => {
        socket.leave(roomId);
        if (rooms[roomId] && rooms[roomId].users[socket.id]) {
            const peerId = rooms[roomId].users[socket.id].peerId;
            delete rooms[roomId].users[socket.id];
            io.to(roomId).emit('user-disconnected', { peerId, socketId: socket.id });
            if (Object.keys(rooms[roomId].users).length === 0) {
                delete rooms[roomId];
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

    // Chat
    socket.on('send-message', (data) => {
        io.to(data.roomId).emit('receive-message', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda aktif.`));