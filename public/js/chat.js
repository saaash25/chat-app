const socket = io();
var chatboxHead = document.getElementById('chatboxHead')
var messageSendButton = document.getElementById('sendMessage');
var locationSendButton = document.getElementById('sendLocation');
var messageBox = document.getElementById('chatMessageDiv')
var userListBox = document.getElementById('usersList')


var chatboxHeadTemplate = ' <div style="background: #a0edcd;padding: 18px;color: blueviolet;border-radius: 5px ;"><b>{{chatboxHead}}</b><span style="float:right;color:#f18686"><b> Chat Room: {{room}} </b></span></div>';
var messageTemplateSender = '<div><p style="font-size: xx-small;" class="m-0"><b>{{username}}</b>   {{messageTime}}</p><p class="bg-success p-1 rounded w-auto" style="background-color:#72d97aab !important;text-align:right;padding: 5px 20px !important;">{{message}}</p></div>'
var locationTemplateSender = '<div><p style="font-size: xx-small;" class="m-0"><b>{{username}}</b>  {{messageTime}}</p><p class="bg-success p-1 rounded w-auto" style="background-color:#72d97aab !important;text-align:right;padding: 5px 20px !important;">My Location: <a href="{{message}}" target="_blank">{{message}}</a></p></div>'
var messageTemplateReceiver = '<div><p style="font-size: xx-small;" class="m-0"><b>{{username}}</b>  {{messageTime}}</p><p class="bg-white p-1 rounded w-auto" style="padding: 5px 20px !important;">{{message}}</p></div>'
var locationTemplateReceiver = '<div><p style="font-size: xx-small;" class="m-0"><b>{{username}}</b>  {{messageTime}}</p><p class="bg-white p-1 rounded w-auto" style="padding: 5px 20px !important;">Location: <a href="{{message}}" target="_blank"> {{message}}</a></p></div>'

var usersListTemplate = '<li class="list-group-item list-group-item-success"><a>{{userListName}}</a></li>';

const { username, room } = Qs.parse(location.search, { ignoreQueryPrefix: true });

const getMessageObject = (text) => {
    return {
        text,
        "messageTime": new Date().getTime()
    }
}

const setUsersList = (users) => {
    userListBox.innerHTML = ''
    users.forEach((user) => {
        var compiledChatboxHeadTemplate = Handlebars.compile(usersListTemplate);
        const userValue = { "userListName": user.username }
        var compiledChatboxHeadTemplate = compiledChatboxHeadTemplate(userValue);
        userListBox.insertAdjacentHTML('beforeend', compiledChatboxHeadTemplate)
    })
}
const autoScroll=()=>{
    messageBox.scrollTop = messageBox.scrollHeight;
}
// client-side
// socket.on("connect", () => {
//     // console.log(socket.id); // x8WIv7-mJelg7on_ALbx
// });

// socket.on("disconnect", () => {

// });
socket.on('disconnectMessage', (message) => {

    var compiledMessageTemplate = Handlebars.compile(messageTemplateReceiver);
    const messageValue = { "message": message.text, "messageTime": moment(message.messageTime).format("h:mm a"), "username": message.username }
    var compiledMessageTemplateWithData = compiledMessageTemplate(messageValue);
    messageBox.insertAdjacentHTML('beforeend', compiledMessageTemplateWithData)
    autoScroll();
})
socket.on("welcome", (message) => {
    var compiledChatboxHeadTemplate = Handlebars.compile(chatboxHeadTemplate);
    const headValue = { "chatboxHead": message.chatboxHead,"room":room }
    var compiledChatboxHeadTemplate = compiledChatboxHeadTemplate(headValue);
    chatboxHead.insertAdjacentHTML('beforeend', compiledChatboxHeadTemplate)

    var compiledMessageTemplate = Handlebars.compile(messageTemplateReceiver);
    const messageValue = { "message": message.text, "messageTime": moment(message.messageTime).format("h:mm a"), "username": message.username }
    var compiledMessageTemplateWithData = compiledMessageTemplate(messageValue);
    messageBox.insertAdjacentHTML('beforeend', compiledMessageTemplateWithData)

    autoScroll();
});

socket.on("joinMessage", (message) => {

    var compiledMessageTemplate = Handlebars.compile(messageTemplateReceiver);
    const messageValue = { "message": message.text, "messageTime": moment(message.messageTime).format("h:mm a"), "username": message.username }
    var compiledMessageTemplateWithData = compiledMessageTemplate(messageValue);
    messageBox.insertAdjacentHTML('beforeend', compiledMessageTemplateWithData)
    autoScroll();
});

socket.on('roomData',(message) => {
    const users = message.usersList;
    setUsersList(users)
});

// Counter--------------------
// socket.on('countUpdate', (count) => {
//     document.getElementById('count').innerHTML = count
//     console.log('Count Updated ' + count)
// })

// document.querySelector('#increment').addEventListener('click', () => {
//     socket.emit('increment');
// })
// document.querySelector('#decrement').addEventListener('click', () => {
//     socket.emit('decrement');
// })

// Message send recieve------------------------



//send text message
messageSendButton.addEventListener('click', () => {
    var inputMessage = document.getElementById('message').value;
    if (inputMessage) {
        const messageObject = getMessageObject(inputMessage)
        var compiledMessageTemplate = Handlebars.compile(messageTemplateSender);
        const messageValue = { "message": messageObject.text, "messageTime": moment(message.messageTime).format("h:mm a"), "username": "" }
        var compiledMessageTemplateWithData = compiledMessageTemplate(messageValue);
        messageSendButton.setAttribute('disabled', 'disabled');
        document.getElementById('message').value = '';
        messageBox.insertAdjacentHTML('beforeend', compiledMessageTemplateWithData)
        socket.emit('sendMessage', inputMessage, ({ error, message }) => {
            if (message) {
                messageSendButton.removeAttribute('disabled');
            } else {
                alert(error)
            }
        });
        autoScroll();
    } else {
        alert('please enter message!')
    }
})
//receive text message
socket.on('receiveMessage', (message) => {
    var compiledMessageTemplate = Handlebars.compile(messageTemplateReceiver);
    const messageValue = { "message": message.text, "messageTime": moment(message.messageTime).format("h:mm a"), "username": message.username }
    var compiledMessageTemplateWithData = compiledMessageTemplate(messageValue);
    messageBox.insertAdjacentHTML('beforeend', compiledMessageTemplateWithData)
    autoScroll();
})
//receive location
socket.on('receiveLocation', (message) => {
    var compiledMessageTemplate = Handlebars.compile(locationTemplateReceiver);
    const messageValue = { "message": message.text, "messageTime": moment(message.messageTime).format("h:mm a"), "username": message.username }
    var compiledMessageTemplateWithData = compiledMessageTemplate(messageValue);
    messageBox.insertAdjacentHTML('beforeend', compiledMessageTemplateWithData)
    autoScroll();
})
//send location
locationSendButton.addEventListener('click', () => {
    if (navigator.geolocation) {
        locationSendButton.setAttribute('disabled', 'disabled');
        navigator.geolocation.getCurrentPosition((success) => {
            var message = getMessageObject('https://google.com/maps?q=' + success.coords.latitude + ',' + success.coords.longitude);
            var compiledMessageTemplate = Handlebars.compile(locationTemplateSender);
            const messageValue = { "message": message.text, "messageTime": moment(message.messageTime).format("h:mm a"), "username": "" }
            var compiledMessageTemplateWithData = compiledMessageTemplate(messageValue);
            messageBox.insertAdjacentHTML('beforeend', compiledMessageTemplateWithData);
            socket.emit('sendLocation',`https://google.com/maps?q=${success.coords.latitude},${success.coords.longitude}`, ({error, message}) => {
            if (message) {
                    locationSendButton.removeAttribute('disabled');
                } else {
                    alert(error)
                }

            })
            autoScroll();

        });
    } else {
        alert('location is not supported in this browser!')
    }
});
socket.emit('join', { username, room }, (error) => {
    if (error) {
        alert(error)
        location.href = '/'
    }
})