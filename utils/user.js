const users = []; // Room-specific user memberships: { id, username, room, userId }
const activeSockets = new Map(); // socketId -> { socketId, userId, name, phoneNumber }
const userSockets = new Map(); // userId -> Set of socketIds

// Room-specific: addUser
const addUser = ({ id, username, room, userId = '' } = {}) => {
    if (!username || !room || typeof username !== 'string' || typeof room !== 'string') {
        return {
            error: 'username and room required!',
            user: undefined
        };
    }

    username = username.trim().toLowerCase();
    room = room.trim().toLowerCase();

    if (!username || !room) {
        return {
            error: 'username and room required!',
            user: undefined
        };
    }

    const isUserExist = users.find((user) => {
        return user.room === room && user.username === username;
    });

    if (isUserExist) {
        return {
            error: 'user already exist in this room!',
            user: undefined
        };
    }

    const user = { id, username, room };
    if (userId) {
        user.userId = userId;
    }
    users.push(user);
    return { error: undefined, user };
};

// Room-specific: removeUser
const removeUser = (id) => {
    const index = users.findIndex((user) => user.id === id);

    if (index !== -1) {
        const user = users[index];
        users.splice(index, 1);
        return { error: undefined, user: user };
    } else {
        return { error: 'the user not found in this chat room!', user: undefined };
    }
};

// Room-specific: findUser
const findUser = (id) => {
    const user = users.find((user) => user.id === id);
    if (user) {
        return { error: undefined, user };
    } else {
        return { error: 'no such user found!', user: undefined };
    }
};

// Room-specific: findUsersInRoom
const findUsersInRoom = (room) => {
    if (!room || typeof room !== 'string') {
        return [];
    }
    room = room.trim().toLowerCase();
    const usersInRoom = users.filter((user) => user.room === room);
    return usersInRoom;
};

// -------------------------------------------------------------
// Global Active User Presence Tracking (for Direct Messages)
// -------------------------------------------------------------

const registerActiveSocket = (socketId, user) => {
    if (!socketId || !user || !user.id) return;

    activeSockets.set(socketId, {
        socketId,
        userId: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber
    });

    if (!userSockets.has(user.id)) {
        userSockets.set(user.id, new Set());
    }
    userSockets.get(user.id).add(socketId);
};

const unregisterActiveSocket = (socketId) => {
    const active = activeSockets.get(socketId);
    if (active) {
        const { userId } = active;
        activeSockets.delete(socketId);

        if (userSockets.has(userId)) {
            const set = userSockets.get(userId);
            set.delete(socketId);
            if (set.size === 0) {
                userSockets.delete(userId);
            }
        }
        return active;
    }
    return null;
};

const isUserOnline = (userId) => {
    return userSockets.has(userId) && userSockets.get(userId).size > 0;
};

const getSocketsByUserId = (userId) => {
    if (userSockets.has(userId)) {
        return Array.from(userSockets.get(userId));
    }
    return [];
};

const getActiveUserBySocketId = (socketId) => {
    return activeSockets.get(socketId) || null;
};

const getAllOnlineUserIds = () => {
    return Array.from(userSockets.keys());
};

// Reset all memory state (for testing)
const resetUsers = () => {
    users.length = 0;
    activeSockets.clear();
    userSockets.clear();
};

const getUsers = () => users;

module.exports = {
    addUser,
    removeUser,
    findUser,
    findUsersInRoom,
    registerActiveSocket,
    unregisterActiveSocket,
    isUserOnline,
    getSocketsByUserId,
    getActiveUserBySocketId,
    getAllOnlineUserIds,
    resetUsers,
    getUsers
};
