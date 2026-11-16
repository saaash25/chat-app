const users = [];

// addUser
const addUser = ({ id, username, room } = {}) => {
    if (!username || !room || typeof username !== 'string' || typeof room !== 'string') {
        return {
            error: 'username and room required!',
            user: undefined
        }
    }

    username = username.trim().toLowerCase();
    room = room.trim().toLowerCase();

    if (!username || !room) {
        return {
            error: 'username and room required!',
            user: undefined
        }
    }

    const isUserExist = users.find((user) => {
        return user.room === room && user.username === username
    })

    if (isUserExist) {
        return {
            error: 'user already exist in this room!',
            user: undefined
        }
    }

    const user = { id, username, room }
    users.push(user)
    return { error: undefined, user }
}

// removeUser
const removeUser = (id) => {
    const index = users.findIndex((user) => user.id === id)

    if (index !== -1) {
        const user = users[index];
        users.splice(index, 1);
        return { error: undefined, user: user }
    } else {
        return { error: 'the user not found in this chat room!', user: undefined }
    }
}

// findUser
const findUser = (id) => {
    const user = users.find((user) => user.id === id)
    if (user) {
        return { error: undefined, user }
    } else {
        return { error: 'no such user found!', user: undefined }
    }
}

// findUsersInRoom
const findUsersInRoom = (room) => {
    if (!room || typeof room !== 'string') {
        return []
    }
    room = room.trim().toLowerCase();
    const usersInRoom = users.filter((user) => user.room === room)
    return usersInRoom
}

// resetUsers (useful for testing and room cleanup)
const resetUsers = () => {
    users.length = 0;
}

// getUsers
const getUsers = () => users;

module.exports = {
    addUser,
    removeUser,
    findUser,
    findUsersInRoom,
    resetUsers,
    getUsers
}