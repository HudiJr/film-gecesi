const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Dosyaların public klasöründe olduğunu unutmuyoruz
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const rooms = {};
// Kullanıcıların online durumlarını ve arkadaş listelerini tutmak için hafıza tabanı
const usersDB = {}; // socket.id veya username tabanlı

io.on('connection', (socket) => {
    sendRoomList();

    // Kullanıcı sisteme kaydolduğunda / giriş yaptığında
    socket.on('register-user', ({ username }) => {
        socket.username = username;
        usersDB[username] = { socketId: socket.id, friends: [], requests: [] };
        socket.emit('friend-data-updated', usersDB[username]);
    });

    // Arkadaş Ekleme İsteği
    socket.on('send-friend-request', ({ targetUsername }) => {
        const targetUser = usersDB[targetUsername];
        if (targetUser && targetUsername !== socket.username) {
            if (!targetUser.requests.includes(socket.username)) {
                targetUser.requests.push(socket.username);
                io.to(targetUser.socketId).emit('friend-request-received', { from: socket.username });
                socket.emit('error-msg', `${targetUsername} adlı kullanıcıya arkadaşlık isteği gönderildi!`);
            } else {
                socket.emit('error-msg', 'Bu kullanıcıya zaten istek göndermişsin!');
            }
        } else {
            socket.emit('error-msg', 'Kullanıcı bulunamadı veya kendinizi ekleyemezsiniz!');
        }
    });

    // Arkadaşlık İsteğini Kabul Etme
    socket.on('accept-friend-request', ({ requesterUsername }) => {
        const myUsername = socket.username;
        if (usersDB[myUsername] && usersDB[requesterUsername]) {
            if (!usersDB[myUsername].friends.includes(requesterUsername)) {
                usersDB[myUsername].friends.push(requesterUsername);
            }
            if (!usersDB[requesterUsername].friends.includes(myUsername)) {
                usersDB[requesterUsername].friends.push(myUsername);
            }
            // İsteği kaldır
            usersDB[myUsername].requests = usersDB[myUsername].requests.filter(u => u !== requesterUsername);

            socket.emit('friend-data-updated', usersDB[myUsername]);
            if (usersDB[requesterUsername].socketId) {
                io.to(usersDB[requesterUsername].socketId).emit('friend-data-updated', usersDB[requesterUsername]);
            }
        }
    });

    // Odaya Arkadaş Davet Etme
    socket.on('invite-friend', ({ friendUsername, roomId }) => {
        const friend = usersDB[friendUsername];
        if (friend && friend.socketId) {
            io.to(friend.socketId).emit('room-invitation', { 
                from: socket.username, 
                roomId: roomId 
            });
            socket.emit('error-msg', `${friendUsername} adlı arkadaşına davetiye gönderildi!`);
        } else {
            socket.emit('error-msg', 'Arkadaşınız şu an çevrimdışı!');
        }
    });

    // Oda İşlemleri
    socket.on('create-room', ({ roomId, password, peerId, username, avatar }) => {
        if (rooms[roomId]) {
            socket.emit('error-msg', 'Bu oda zaten mevcut! Başka bir isim deneyin.');
            return;
        }

        rooms[roomId] = {
            password: password || '',
            users: {}
        };

        joinRoomLogic(socket, roomId, password, peerId, username, avatar);
    });

    socket.on('join-room', ({ roomId, password, peerId, username, avatar }) => {
        if (!rooms[roomId]) {
            socket.emit('error-msg', 'Böyle bir oda bulunamadı!');
            return;
        }

        if (rooms[roomId].password && rooms[roomId].password !== password) {
            socket.emit('error-msg', 'Hatalı oda şifresi!');
            return;
        }

        if (Object.keys(rooms[roomId].users).length >= 6) {
            socket.emit('error-msg', 'Oda dolu (Maksimum 6 kişi)!');
            return;
        }

        joinRoomLogic(socket, roomId, password, peerId, username, avatar);
    });

    function joinRoomLogic(socket, roomId, password, peerId, username, avatar) {
        socket.join(roomId);
        socket.currentRoom = roomId;

        rooms[roomId].users[socket.id] = {
            peerId,
            username,
            avatar
        };

        socket.emit('room-joined', {
            roomId,
            existingUsers: rooms[roomId].users
        });

        socket.to(roomId).emit('user-connected', { peerId, username, avatar });
        sendRoomList();
    }

    // YouTube Watch2Gether Entegrasyon Olayları
    socket.on('change-yt-video', ({ roomId, videoId }) => {
        io.to(roomId).emit('yt-video-changed', { videoId });
    });

    socket.on('yt-sync-action', ({ roomId, action, time }) => {
        socket.to(roomId).emit('yt-sync-action', { action, time });
    });

    socket.on('change-google-url', ({ roomId, url }) => {
        io.to(roomId).emit('google-url-changed', { url });
    });

    socket.on('screen-share-started', ({ roomId, peerId }) => {
        socket.to(roomId).emit('screen-share-started', { peerId });
    });

    socket.on('screen-share-stopped', ({ roomId }) => {
        socket.to(roomId).emit('screen-share-stopped');
    });

    socket.on('send-message', (data) => {
        io.to(data.roomId).emit('receive-message', data);
    });

    socket.on('leave-room', ({ roomId }) => {
        handleUserLeave(socket, roomId);
    });

    socket.on('disconnect', () => {
        if (socket.username && usersDB[socket.username]) {
            usersDB[socket.username].socketId = null;
        }
        if (socket.currentRoom) {
            handleUserLeave(socket, socket.currentRoom);
        }
    });

    function handleUserLeave(socket, roomId) {
        if (rooms[roomId] && rooms[roomId].users[socket.id]) {
            const peerId = rooms[roomId].users[socket.id].peerId;
            delete rooms[roomId].users[socket.id];
            
            socket.to(roomId).emit('user-disconnected', { peerId });
            socket.leave(roomId);

            if (Object.keys(rooms[roomId].users).length === 0) {
                delete rooms[roomId];
            }
            sendRoomList();
        }
    }
});

function sendRoomList() {
    const list = Object.keys(rooms).map(id => ({
        id,
        userCount: Object.keys(rooms[id].users).length,
        hasPassword: !!rooms[id].password
    }));
    io.emit('room-list', list);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor...`);
});