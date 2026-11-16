require('dotenv').config();

const path = require('path');
const http = require('http');
const fs = require('fs');
const express = require('express');
const socketio = require('socket.io');
const hbs = require('hbs');

const getMessageObject = require('../utils/message');
const {
    addUser,
    removeUser,
    findUser,
    findUsersInRoom,
    registerActiveSocket,
    unregisterActiveSocket,
    isUserOnline,
    getSocketsByUserId,
    getActiveUserBySocketId,
    getAllOnlineUserIds
} = require('../utils/user');

const {
    validatePhoneNumber,
    validateName,
    getAllUsers,
    getUserByPhone,
    getUserById,
    registerUser,
    loginOrRegister,
    loginUserByPhone,
    searchUsers,
    saveDirectMessage,
    getDirectConversation
} = require('../utils/db');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
    maxHttpBufferSize: 1e7 // 10MB payload limit for direct image transfers
});

const port = process.env.PORT || 3000;
const publicPath = path.join(__dirname, '../public');
const uploadDir = path.join(publicPath, 'uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, '../public/views'));
hbs.registerPartials(path.join(__dirname, '../public/views'));

app.use(express.static(publicPath));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// -------------------------------------------------------------
// HTTP REST APIs
// -------------------------------------------------------------

// Page Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/chat', (req, res) => {
    res.render('chat');
});

// Authentication / Sign-up with Phone Number & Name
app.post('/api/auth/signup', (req, res) => {
    const { name, phoneNumber } = req.body || {};
    const result = registerUser({ name, phoneNumber });
    if (result.error) {
        return res.status(400).json({ success: false, error: result.error });
    }
    return res.status(201).json({ success: true, user: result.user });
});

// Authentication / Sign-in with Mobile Number only
app.post('/api/auth/login', (req, res) => {
    const { phoneNumber, name } = req.body || {};

    // First attempt login by mobile number
    const result = loginUserByPhone(phoneNumber);
    if (!result.error && result.user) {
        return res.json({ success: true, user: result.user });
    }

    // If mobile number not found, but a valid name was passed (e.g. from automated tests/registration fallback)
    if (name && typeof name === 'string' && name.trim().length >= 2) {
        const reg = registerUser({ name, phoneNumber });
        if (reg.error) {
            return res.status(400).json({ success: false, error: reg.error });
        }
        return res.json({ success: true, user: reg.user, isNew: true });
    }

    // Otherwise return error
    return res.status(404).json({
        success: false,
        error: result.error || 'Mobile number not registered. Please sign up first.'
    });
});

// Search active/registered users
app.get('/api/users/search', (req, res) => {
    const { q, currentUserId, activeOnly } = req.query;
    const users = searchUsers(q, currentUserId);

    const enriched = users.map((u) => ({
        id: u.id,
        name: u.name,
        phoneNumber: u.phoneNumber,
        isOnline: isUserOnline(u.id)
    }));

    const filtered = activeOnly === 'true' ? enriched.filter((u) => u.isOnline) : enriched;
    res.json({ success: true, users: filtered });
});

// Fetch Direct Messages conversation history between 2 users
app.get('/api/direct-messages', (req, res) => {
    const { userId1, userId2 } = req.query;
    if (!userId1 || !userId2) {
        return res.status(400).json({ success: false, error: 'userId1 and userId2 required!' });
    }
    const messages = getDirectConversation(userId1, userId2);
    res.json({ success: true, messages });
});

// Direct Image Upload Endpoint (Base64 data or multipart)
app.post('/api/upload', (req, res) => {
    const { imageBase64, filename = 'image.png' } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ success: false, error: 'No image data provided!' });
    }

    try {
        const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(imageBase64, 'base64');

        const cleanName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`;
        const filePath = path.join(uploadDir, cleanName);

        fs.writeFileSync(filePath, buffer);
        const imageUrl = `/uploads/${cleanName}`;
        res.json({ success: true, imageUrl });
    } catch (err) {
        console.error('Image upload error:', err);
        res.status(500).json({ success: false, error: 'Failed to save image!' });
    }
});

// -------------------------------------------------------------
// Socket.IO Event Handlers
// -------------------------------------------------------------

io.on('connection', (socket) => {
    // Register active user socket for direct messaging & presence
    socket.on('auth', (payload = {}, callback) => {
        const userId = payload.userId || payload.id;
        const name = payload.name;
        const phoneNumber = payload.phoneNumber;

        if (!userId) {
            if (typeof callback === 'function') {
                return callback({ error: 'User ID required for auth!' });
            }
            return;
        }

        const user = getUserById(userId) || { id: userId, name: name || 'User', phoneNumber: phoneNumber || '' };
        registerActiveSocket(socket.id, user);

        // Notify all clients about user's online status
        io.emit('userPresenceChanged', { userId: user.id, isOnline: true });

        if (typeof callback === 'function') {
            callback({ success: true, user });
        }
    });

    // Search active/registered users via socket
    socket.on('searchUsers', ({ query = '', activeOnly = false } = {}, callback) => {
        const active = getActiveUserBySocketId(socket.id);
        const currentId = active ? active.userId : '';

        const users = searchUsers(query, currentId).map((u) => ({
            id: u.id,
            name: u.name,
            phoneNumber: u.phoneNumber,
            isOnline: isUserOnline(u.id)
        }));

        const result = activeOnly ? users.filter((u) => u.isOnline) : users;

        if (typeof callback === 'function') {
            callback({ users: result });
        }
    });

    // ---------------------------------------------------------
    // Direct Messaging (1-on-1 Chat)
    // ---------------------------------------------------------

    socket.on('sendDirectMessage', ({ toUserId, text = '', imageUrl = '', location = '' } = {}, callback) => {
        const sender = getActiveUserBySocketId(socket.id);
        if (!sender) {
            if (typeof callback === 'function') {
                return callback({ error: 'You must authenticate before sending direct messages!' });
            }
            return;
        }

        if (!toUserId) {
            if (typeof callback === 'function') {
                return callback({ error: 'Recipient toUserId is required!' });
            }
            return;
        }

        const recipient = getUserById(toUserId);
        if (!recipient) {
            if (typeof callback === 'function') {
                return callback({ error: 'Recipient user not found in database!' });
            }
            return;
        }

        if (!text && !imageUrl && !location) {
            if (typeof callback === 'function') {
                return callback({ error: 'Message cannot be empty!' });
            }
            return;
        }

        // Save to DB
        const { error, message } = saveDirectMessage({
            fromUserId: sender.userId,
            toUserId,
            text,
            imageUrl,
            location
        });

        if (error) {
            if (typeof callback === 'function') {
                return callback({ error });
            }
            return;
        }

        const enrichedMessage = {
            ...message,
            fromUserName: sender.name,
            fromUserPhone: sender.phoneNumber,
            toUserName: recipient.name
        };

        // Deliver to all recipient open sockets (if online)
        const recipientSocketIds = getSocketsByUserId(toUserId);
        recipientSocketIds.forEach((sockId) => {
            io.to(sockId).emit('receiveDirectMessage', enrichedMessage);
        });

        // Also broadcast to any other sockets of the sender (e.g. multi-tab sync)
        const senderSocketIds = getSocketsByUserId(sender.userId);
        senderSocketIds.forEach((sockId) => {
            if (sockId !== socket.id) {
                io.to(sockId).emit('receiveDirectMessage', enrichedMessage);
            }
        });

        if (typeof callback === 'function') {
            callback({
                success: true,
                message: enrichedMessage,
                delivered: recipientSocketIds.length > 0
            });
        }
    });

    // Fetch Direct Message conversation history
    socket.on('getDirectHistory', ({ withUserId } = {}, callback) => {
        const sender = getActiveUserBySocketId(socket.id);
        if (!sender || !withUserId) {
            if (typeof callback === 'function') {
                return callback({ error: 'Authentication and withUserId required!' });
            }
            return;
        }

        const messages = getDirectConversation(sender.userId, withUserId);
        if (typeof callback === 'function') {
            callback({ messages });
        }
    });

    // ---------------------------------------------------------
    // Chat Rooms
    // ---------------------------------------------------------

    socket.on('join', ({ username, room, userId = '' } = {}, callback) => {
        const { error, user } = addUser({ id: socket.id, username, room, userId });

        if (error) {
            if (typeof callback === 'function') {
                return callback(error);
            }
            return;
        }

        socket.join(user.room);

        // Welcome current user
        const welcomeObject = getMessageObject('Welcome!', 'Admin', user.username, user.room);
        socket.emit('welcome', welcomeObject);

        // Notify room members
        const joinBroadcast = getMessageObject(`${user.username} has joined the chat!`, 'Admin', '', user.room);
        socket.broadcast.to(user.room).emit('joinMessage', joinBroadcast);

        // Update active users list in room
        const usersList = findUsersInRoom(user.room);
        io.to(user.room).emit('roomData', { usersList, room: user.room });

        if (typeof callback === 'function') {
            callback();
        }
    });

    socket.on('sendMessage', (message, callback) => {
        const { error, user } = findUser(socket.id);

        if (error || !user) {
            if (typeof callback === 'function') {
                return callback({ error: 'message not delivered to room!', message: undefined });
            }
            return;
        }

        if (!message || typeof message !== 'string' || !message.trim()) {
            if (typeof callback === 'function') {
                return callback({ error: 'Message cannot be empty!', message: undefined });
            }
            return;
        }

        const trimmedMessage = message.trim();
        socket.broadcast.to(user.room).emit('receiveMessage', getMessageObject(trimmedMessage, user.username, '', user.room));

        if (typeof callback === 'function') {
            callback({ error: undefined, message: 'message delivered!!' });
        }
    });

    socket.on('sendLocation', (location, callback) => {
        const { error, user } = findUser(socket.id);

        if (error || !user) {
            if (typeof callback === 'function') {
                return callback({ error: 'location not shared to room!', message: undefined });
            }
            return;
        }

        if (!location || typeof location !== 'string' || !location.trim()) {
            if (typeof callback === 'function') {
                return callback({ error: 'Invalid location!', message: undefined });
            }
            return;
        }

        socket.broadcast.to(user.room).emit('receiveLocation', getMessageObject(location.trim(), user.username, '', user.room));

        if (typeof callback === 'function') {
            callback({ error: undefined, message: 'location shared!!' });
        }
    });

    // ---------------------------------------------------------
    // Disconnection Handling
    // ---------------------------------------------------------

    socket.on('disconnect', () => {
        // Room cleanup
        const { user } = removeUser(socket.id);
        if (user) {
            const usersList = findUsersInRoom(user.room);
            io.to(user.room).emit('disconnectMessage', getMessageObject(`${user.username} has left!`, 'Admin', '', user.room));
            io.to(user.room).emit('roomData', { usersList, room: user.room });
        }

        // Direct message active presence cleanup
        const active = unregisterActiveSocket(socket.id);
        if (active) {
            const stillOnline = isUserOnline(active.userId);
            if (!stillOnline) {
                io.emit('userPresenceChanged', { userId: active.userId, isOnline: false });
            }
        }
    });
});

if (require.main === module) {
    server.listen(port, () => {
        console.log(`server is running in port ${port}`);
    });
}

module.exports = { app, server, io };
