const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

const rooms = {};

// Aktif odaları istemcilere gönder
function broadcastRooms() {
    const roomList = Object.keys(rooms).map(id => ({
        id,
        userCount: Object.keys(rooms[id].users).length,
        hasPassword: !!rooms[id].password
    }));
    io.emit('room-list', roomList);
}

io.on('connection', (socket) => {
    // Bağlanan kullanıcıya mevcut odaları gönder
    socket.emit('room-list', Object.keys(rooms).map(id => ({
        id,
        userCount: Object.keys(rooms[id].users).length,
        hasPassword: !!rooms[id].password
    })));

    socket.on('join-room', ({ roomId, password, peerId, username }) => {
        // Oda yoksa oluştur
        if (!rooms[roomId]) {
            rooms[roomId] = {
                password: password || null,
                users: {}
            };
        }

        const room = rooms[roomId];

        if (room.password && room.password !== password) {
            return socket.emit('error-msg', 'Hatalı oda şifresi!');
        }

        if (Object.keys(room.users).length >= 6) {
            return socket.emit('error-msg', 'Oda dolu! (Max 6 kişi)');
        }

        socket.join(roomId);
        room.users[socket.id] = { peerId, username };

        // Kullanıcıya başarılı giriş bilgisini ve odadakileri gönder
        socket.emit('room-joined', { roomId, existingUsers: room.users });

        // Odadaki diğerlerine haber ver
        socket.to(roomId).emit('user-connected', { peerId, username, socketId: socket.id });

        broadcastRooms();

        socket.on('disconnect', () => {
            if (rooms[roomId]) {
                delete rooms[roomId].users[socket.id];
                io.to(roomId).emit('user-disconnected', { peerId, socketId: socket.id });
                if (Object.keys(rooms[roomId].users).length === 0) {
                    delete rooms[roomId];
                }
                broadcastRooms();
            }
        });
    });

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

    socket.on('video-action', (data) => {
        socket.to(data.roomId).emit('video-action', data);
    });

    socket.on('send-message', (data) => {
        io.to(data.roomId).emit('receive-message', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda aktif.`));