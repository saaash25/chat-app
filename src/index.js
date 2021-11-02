if (process.env.NODE_ENV === 'production') {
    require('dotenv').config()
}
const express = require('express')
const app = express()
const http = require('http');
const server = http.createServer(app);
const socketio = require('socket.io')
const io = socketio(server);

const getMessageObject=require('../utils/message')
const {addUser,removeUser, findUser,findUsersInRoom}=require('../utils/user')

const port = process.env.PORT || 3001;
const path = require('path')
const hbs=require('hbs');

const publicPath = path.join(__dirname, '../public')
app.set('view engine','hbs');
app.set('views',path.join(__dirname,'../public/views'))
hbs.registerPartials(path.join(__dirname,'../public/views'))
app.use(express.static(publicPath));

app.use(express.json())
app.use(express.urlencoded({extended:true}))

app.get('/chat',(req,res)=>{
    res.render('chat')
})



var count = 0;
// server-side
io.on("connection", (socket) => {
    //socket.emit('countUpdate', count)
    socket.on('join',async({username,room},callback)=>{ 
        const {error,user}=await addUser({id:socket.id,username,room});
        if(error){
            return callback(error)
        }
        socket.join(user.room)
        

        var welcomeObject=getMessageObject("Welcome!",'Admin',user.username,user.room);
        socket.emit("welcome",welcomeObject);

        var welcomeObject=getMessageObject(`${user.username} has joined the chat!`,'Admin',user.username);
        socket.broadcast.to(user.room).emit("joinMessage",welcomeObject);

        const usersList=await findUsersInRoom(user.room);
        io.to(user.room).emit('roomData',{usersList})
       
    })

    // socket.on('increment', () => {
    //     count++
    //     //socket.emit('countUpdate', count)
    //     io.emit('countUpdate', count)
    // })
    // socket.on('decrement', () => {
    //     count--
    //     //socket.emit('countUpdate', count)
    //     io.emit('countUpdate', count)
    // })
    socket.on('sendMessage',(message,callback)=>{
        const {error,user}=findUser(socket.id);
        if(error){
            return callback({error:'message not delivered to room!',message:undefined})
        }
        socket.broadcast.to(user.room).emit('receiveMessage',getMessageObject(message,user.username))
        callback({error:undefined,message:'message delivered!!'})
    })
    socket.on('sendLocation',(location,callback)=>{
        const {error,user}=findUser(socket.id);
        console.log('location resceived in server!')
        if(error){
            return callback({error:'location not shared to room!',message:undefined})
        }
        socket.broadcast.to(user.room).emit('receiveLocation',getMessageObject(location,user.username))
        callback({error:undefined,message:'location shared!!'})
    })
    socket.on("disconnect", () => {
        const {error,user}=removeUser(socket.id);
        if(user){
            io.to(user.room).emit('disconnectMessage',getMessageObject(`${user.username} has left!`,'Admin'))
        }
    });
});
app.get('/',(req,res)=>{
    res.render('index')
})
server.listen(port, () => {
    console.log(`server is running in port ${port}`)
})