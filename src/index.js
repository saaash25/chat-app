require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const hbs = require('hbs');

const getMessageObject = require('../utils/message');
const { addUser, removeUser, findUser, findUsersInRoom } = require('../utils/user');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3000;
const publicPath = path.join(__dirname, '../public');

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, '../public/views'));
hbs.registerPartials(path.join(__dirname, '../public/views'));

app.use(express.static(publicPath));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/chat', (req, res) => {
    res.render('chat');
});

// Socket.IO event handling
io.on('connection', (socket) => {
    socket.on('join', ({ username, room } = {}, callback) => {
        const { error, user } = addUser({ id: socket.id, username, room });

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
        const joinBroadcast = getMessageObject(`${user.username} has joined the chat!`, 'Admin');
        socket.broadcast.to(user.room).emit('joinMessage', joinBroadcast);

        // Update active users list in room
        const usersList = findUsersInRoom(user.room);
        io.to(user.room).emit('roomData', { usersList });

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
        socket.broadcast.to(user.room).emit('receiveMessage', getMessageObject(trimmedMessage, user.username));

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

        socket.broadcast.to(user.room).emit('receiveLocation', getMessageObject(location.trim(), user.username));

        if (typeof callback === 'function') {
            callback({ error: undefined, message: 'location shared!!' });
        }
    });

    socket.on('disconnect', () => {
        const { user } = removeUser(socket.id);

        if (user) {
            const usersList = findUsersInRoom(user.room);
            io.to(user.room).emit('disconnectMessage', getMessageObject(`${user.username} has left!`, 'Admin'));
            io.to(user.room).emit('roomData', { usersList });
        }
    });
});

if (require.main === module) {
    server.listen(port, () => {
        console.log(`server is running in port ${port}`);
    });
}

module.exports = { app, server, io };
