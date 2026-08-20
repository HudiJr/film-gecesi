const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    const publicPath = path.join(__dirname, 'public', 'index.html');
    const rootPath = path.join(__dirname, 'index.html');
    
    res.sendFile(publicPath, (err) => {
        if (err) {
            res.sendFile(rootPath, (err2) => {
                if (err2) {
                    res.status(404).send("index.html dosyası bulunamadı!");
                }
            });
        }
    });
});

// Proxy Rotası
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('URL parametresi gereklidir.');

    try {
        const response = await axios.get(targetUrl, {
            responseType: 'text',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        let html = response.data;
        const injectionScript = `
            <script>
                window.addEventListener('scroll', () => {
                    window.parent.postMessage({
                        type: 'proxy-scroll',
                        scrollTop: window.pageYOffset || document.documentElement.scrollTop,
                        scrollLeft: window.pageXOffset || document.documentElement.scrollLeft
                    }, '*');
                });

                window.addEventListener('message', (event) => {
                    if (event.data && event.data.type === 'scroll-to') {
                        window.scrollTo(event.data.scrollLeft, event.data.scrollTop);
                    }
                });
            </script>
        `;

        if (html.includes('</body>')) {
            html = html.replace('</body>', injectionScript + '</body>');
        } else {
            html += injectionScript;
        }

        res.send(html);
    } catch (err) {
        res.status(500).send('Proxy hatası: ' + err.message);
    }
});

const rooms = {};
const usersDB = {}; 

// Büyük/küçük harf duyarsız kullanıcı bulma fonksiyonu
function findUserKey(username) {
    if (!username) return null;
    const clean = username.trim().toLowerCase();
    for (const key of Object.keys(usersDB)) {
        if (key.toLowerCase() === clean) return key;
    }
    return null;
}

io.on('connection', (socket) => {
    sendRoomList();

    // Kullanıcı Giriş / Kayıt İşlemi
    socket.on('register-user', ({ username, password }) => {
        if (!username || !password) {
            socket.emit('error-msg', 'Kullanıcı adı ve şifre boş olamaz!');
            return;
        }

        const cleanUsername = username.trim();
        const cleanPassword = password.trim();
        const existingKey = findUserKey(cleanUsername);

        if (existingKey) {
            if (usersDB[existingKey].password !== cleanPassword) {
                socket.emit('error-msg', 'Hatalı şifre!');
                return;
            }
            usersDB[existingKey].socketId = socket.id;
            socket.username = existingKey;
            socket.emit('login-success', { username: existingKey });
            socket.emit('friend-data-updated', usersDB[existingKey]);
            socket.emit('update-friends-list', usersDB[existingKey].friends);
        } else {
            usersDB[cleanUsername] = {
                password: cleanPassword,
                socketId: socket.id,
                friends: [],
                requests: [],
                messages: {}
            };
            socket.username = cleanUsername;
            socket.emit('login-success', { username: cleanUsername });
            socket.emit('friend-data-updated', usersDB[cleanUsername]);
            socket.emit('update-friends-list', usersDB[cleanUsername].friends);
        }
    });

    // Arkadaş Ekleme İsteği (Case-Insensitive Düzeltildi)
    socket.on('send-friend-request', (data) => {
        const targetUsername = data.targetUsername || data.to;
        const myName = socket.username;
        if (!myName) return;
        
        const targetClean = targetUsername ? targetUsername.trim() : '';
        const targetKey = findUserKey(targetClean);
        const targetUser = targetKey ? usersDB[targetKey] : null;

        if (targetUser && targetKey !== myName) {
            if (!targetUser.requests.includes(myName) && !usersDB[myName].friends.includes(targetKey)) {
                if (!targetUser.requests.includes(myName)) {
                    targetUser.requests.push(myName);
                }
                if (targetUser.socketId) {
                    io.to(targetUser.socketId).emit('friend-request-received', { from: myName });
                    io.to(targetUser.socketId).emit('friend-data-updated', targetUser);
                }
                socket.emit('error-msg', `${targetKey} adlı kullanıcıya arkadaşlık isteği gönderildi!`);
            } else {
                socket.emit('error-msg', 'Bu kullanıcıya zaten istek göndermişsin veya zaten arkadaşsınız!');
            }
        } else {
            socket.emit('error-msg', 'Kullanıcı bulunamadı veya kendinizi ekleyemezsiniz!');
        }
    });

    // Arkadaşlık İsteğini Kabul Etme
    socket.on('accept-friend-request', (data) => {
        const requesterUsername = data.requesterUsername || data.from;
        const myUsername = socket.username;
        if (!myUsername) return;

        const reqKey = findUserKey(requesterUsername);
        if (usersDB[myUsername] && reqKey && usersDB[reqKey]) {
            if (!usersDB[myUsername].friends.includes(reqKey)) {
                usersDB[myUsername].friends.push(reqKey);
            }
            if (!usersDB[reqKey].friends.includes(myUsername)) {
                usersDB[reqKey].friends.push(myUsername);
            }
            usersDB[myUsername].requests = usersDB[myUsername].requests.filter(u => u.toLowerCase() !== reqKey.toLowerCase());

            socket.emit('friend-data-updated', usersDB[myUsername]);
            socket.emit('update-friends-list', usersDB[myUsername].friends);
            
            if (usersDB[reqKey].socketId) {
                io.to(usersDB[reqKey].socketId).emit('friend-data-updated', usersDB[reqKey]);
                io.to(usersDB[reqKey].socketId).emit('update-friends-list', usersDB[reqKey].friends);
            }
        }
    });

    // Özel Mesaj (DM) Gönderme
    socket.on('send-private-message', (data) => {
        const targetUsername = data.targetUsername || data.to;
        const message = data.message || data.text;
        const myName = socket.username;
        if (!myName) return;
        
        const targetKey = findUserKey(targetUsername);
        const target = targetKey ? usersDB[targetKey] : null;
        
        const msgData = { 
            from: myName, 
            to: targetKey || targetUsername, 
            message, 
            text: message,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        };

        if (!usersDB[myName].messages) usersDB[myName].messages = {};
        if (!usersDB[myName].messages[targetKey]) usersDB[myName].messages[targetKey] = [];
        usersDB[myName].messages[targetKey].push(msgData);
        socket.emit('private-message-received', msgData);

        if (target) {
            if (!target.messages) target.messages = {};
            if (!target.messages[myName]) target.messages[myName] = [];
            target.messages[myName].push(msgData);
            
            if (target.socketId) {
                io.to(target.socketId).emit('private-message-received', msgData);
            }
        }
    });

    // Oda İşlemleri
    socket.on('create-room', ({ roomId, password, peerId, username, avatar }) => {
        if (!roomId) return;
        if (rooms[roomId]) {
            socket.emit('error-msg', 'Bu oda zaten mevcut!');
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
            socket.emit('error-msg', 'Oda bulunamadı!');
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

    socket.on('change-yt-video', ({ roomId, videoId }) => {
        if (roomId && rooms[roomId]) {
            io.to(roomId).emit('yt-video-changed', { videoId });
        }
    });

    socket.on('yt-sync-action', ({ roomId, action, time }) => {
        if (roomId && rooms[roomId]) {
            socket.to(roomId).emit('yt-sync-action', { action, time });
        }
    });

    socket.on('change-google-url', ({ roomId, url }) => {
        if (roomId && rooms[roomId]) {
            io.to(roomId).emit('google-url-changed', { url });
        }
    });

    socket.on('sync-iframe-scroll', ({ roomId, scrollTop, scrollLeft }) => {
        if (roomId && rooms[roomId]) {
            socket.to(roomId).emit('iframe-scroll-action', { scrollTop, scrollLeft });
        }
    });

    socket.on('screen-share-started', ({ roomId, peerId }) => {
        if (roomId && rooms[roomId]) {
            socket.to(roomId).emit('screen-share-started', { peerId });
        }
    });

    socket.on('screen-share-stopped', ({ roomId }) => {
        if (roomId && rooms[roomId]) {
            socket.to(roomId).emit('screen-share-stopped');
        }
    });

    socket.on('send-message', (data) => {
        if (data.roomId && rooms[data.roomId]) {
            io.to(data.roomId).emit('receive-message', data);
        }
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
            socket.currentRoom = null;

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