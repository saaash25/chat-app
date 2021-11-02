const users = [];

//addUser
const addUser = ({ id, username, room }) => {

    username = username.trim().toLowerCase();
    room = room.trim().toLowerCase();

    if (!username || !room) {
        return {
            error: "username and room required!",user:undefined
        }
    }
    isUserExist = users.find((user) => {
        return user.room === room && user.username === username
    })
    if (isUserExist) {
        return {
            error: 'user already exist in this room!',user:undefined
        }
    }
    const user = { id, username, room }
    users.push(user)
    return {error:undefined,user}
}
//remove User
const removeUser = (id) => {
    const index = users.findIndex((user) => user.id === id)
    
    if (index !== -1) {
        const user=users[index];
        users.splice(index, 1)[0]
        return {error:undefined,user:user}
    } else {
        return { error: "the user not found in this chat room!",user:undefined }
    }
}
//find User

const findUser=(id)=>{
    const user = users.find((user) => user.id === id)
    if (user) {
        return {error:undefined,user}
    } else {
        return { error: "no such user found!",user:undefined }
    }
}
//find users in room
const findUsersInRoom=(room)=>{
    room=room.trim().toLowerCase();
    const usersInRoom = users.filter((user) => user.room===room  )
    if (usersInRoom.length) {
        return usersInRoom
    } else {
        return []
    }
}

module.exports={
    addUser,
    removeUser,
    findUser,
    findUsersInRoom
}