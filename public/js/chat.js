const socket = io();

// Parse query parameters
const { username, room } = Qs.parse(location.search, { ignoreQueryPrefix: true });

if (!username || !room) {
    location.href = '/';
}

// DOM Elements
const chatboxHead = document.getElementById('chatboxHead');
const headerMetaText = document.getElementById('headerMetaText');
const sidebarRoomName = document.getElementById('sidebarRoomName');
const activeUsersCount = document.getElementById('activeUsersCount');
const currentUserAvatar = document.getElementById('currentUserAvatar');
const currentUserName = document.getElementById('currentUserName');

const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('message');
const messageSendButton = document.getElementById('sendMessage');
const locationSendButton = document.getElementById('sendLocation');
const messageBox = document.getElementById('chatMessageDiv');
const userListBox = document.getElementById('usersListUl');

const chatSidebar = document.getElementById('chatSidebar');
const menuToggle = document.getElementById('menuToggle');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');

// Set current user info in header
if (currentUserName) {
    currentUserName.textContent = username;
}
if (currentUserAvatar) {
    currentUserAvatar.textContent = (username || 'U').charAt(0).toUpperCase();
}
if (sidebarRoomName) {
    sidebarRoomName.textContent = room;
}

// Color palette for user avatars
const AVATAR_COLORS = [
    'linear-gradient(135deg, #4f46e5, #6366f1)',
    'linear-gradient(135deg, #0ea5e9, #38bdf8)',
    'linear-gradient(135deg, #10b981, #34d399)',
    'linear-gradient(135deg, #f59e0b, #fbbf24)',
    'linear-gradient(135deg, #ec4899, #f472b6)',
    'linear-gradient(135deg, #8b5cf6, #a78bfa)',
    'linear-gradient(135deg, #14b8a6, #2dd4bf)'
];

const getAvatarStyle = (name = '') => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % AVATAR_COLORS.length;
    return AVATAR_COLORS[index];
};

// Handlebars Templates
const messageTemplateSender = Handlebars.compile(
    '<div class="message-row message-row-self">' +
    '  <div class="message-meta">' +
    '    <span class="author-name">You</span> &bull; <span>{{messageTime}}</span>' +
    '  </div>' +
    '  <div class="bubble bubble-self">{{message}}</div>' +
    '</div>'
);

const locationTemplateSender = Handlebars.compile(
    '<div class="message-row message-row-self">' +
    '  <div class="message-meta">' +
    '    <span class="author-name">You</span> &bull; <span>{{messageTime}}</span>' +
    '  </div>' +
    '  <div class="bubble bubble-self location-card">' +
    '    <div class="d-flex align-items-center gap-1"><span>Shared Geolocation</span></div>' +
    '    <a href="{{message}}" target="_blank" class="location-btn">' +
    '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>' +
    '      View on Google Maps' +
    '    </a>' +
    '  </div>' +
    '</div>'
);

const messageTemplateReceiver = Handlebars.compile(
    '<div class="message-row message-row-other">' +
    '  <div class="d-flex align-items-start gap-2">' +
    '    <div class="user-avatar-circle" style="background: {{avatarColor}}; width: 30px; height: 30px; font-size: 0.75rem;">{{initial}}</div>' +
    '    <div>' +
    '      <div class="message-meta">' +
    '        <span class="author-name">{{username}}</span> &bull; <span>{{messageTime}}</span>' +
    '      </div>' +
    '      <div class="bubble bubble-other">{{message}}</div>' +
    '    </div>' +
    '  </div>' +
    '</div>'
);

const locationTemplateReceiver = Handlebars.compile(
    '<div class="message-row message-row-other">' +
    '  <div class="d-flex align-items-start gap-2">' +
    '    <div class="user-avatar-circle" style="background: {{avatarColor}}; width: 30px; height: 30px; font-size: 0.75rem;">{{initial}}</div>' +
    '    <div>' +
    '      <div class="message-meta">' +
    '        <span class="author-name">{{username}}</span> &bull; <span>{{messageTime}}</span>' +
    '      </div>' +
    '      <div class="bubble bubble-other location-card">' +
    '        <div class="text-secondary small fw-semibold">Shared Geolocation</div>' +
    '        <a href="{{message}}" target="_blank" class="location-btn">' +
    '          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>' +
    '          Open in Google Maps' +
    '        </a>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '</div>'
);

const systemNoticeTemplate = Handlebars.compile(
    '<div class="system-notice-row">' +
    '  <span class="system-notice-pill {{pillClass}}">' +
    '    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>' +
    '    <span>{{text}}</span>' +
    '  </span>' +
    '</div>'
);

const usersListTemplate = Handlebars.compile(
    '<div class="user-item">' +
    '  <div class="user-avatar-circle" style="background: {{avatarColor}};">{{initial}}</div>' +
    '  <div class="d-flex flex-column" style="min-width: 0;">' +
    '    <span class="user-name-text">{{username}} {{#if isSelf}}<span class="text-muted small">(you)</span>{{/if}}</span>' +
    '  </div>' +
    '</div>'
);

const autoScroll = () => {
    if (messageBox) {
        messageBox.scrollTop = messageBox.scrollHeight;
    }
};

const setUsersList = (users = []) => {
    if (!userListBox) return;
    userListBox.innerHTML = '';

    if (activeUsersCount) {
        activeUsersCount.textContent = users.length;
    }
    if (headerMetaText) {
        headerMetaText.textContent = `${users.length} active member${users.length === 1 ? '' : 's'}`;
    }

    users.forEach((u) => {
        const uName = u.username || 'User';
        const html = usersListTemplate({
            username: uName,
            initial: uName.charAt(0).toUpperCase(),
            avatarColor: getAvatarStyle(uName),
            isSelf: uName.toLowerCase() === username.toLowerCase()
        });
        userListBox.insertAdjacentHTML('beforeend', html);
    });
};

// Mobile sidebar toggle interactions
if (menuToggle && chatSidebar && sidebarBackdrop) {
    menuToggle.addEventListener('click', () => {
        chatSidebar.classList.toggle('open');
        sidebarBackdrop.classList.toggle('active');
    });

    sidebarBackdrop.addEventListener('click', () => {
        chatSidebar.classList.remove('open');
        sidebarBackdrop.classList.remove('active');
    });
}

// Socket Events
socket.on('welcome', (message) => {
    if (chatboxHead) {
        chatboxHead.textContent = `#${message.room || room}`;
    }

    const html = systemNoticeTemplate({
        text: `Welcome to #${message.room || room}, ${username}!`,
        pillClass: 'system-notice-join'
    });
    messageBox.insertAdjacentHTML('beforeend', html);
    autoScroll();
});

socket.on('joinMessage', (message) => {
    const html = systemNoticeTemplate({
        text: message.text,
        pillClass: 'system-notice-join'
    });
    messageBox.insertAdjacentHTML('beforeend', html);
    autoScroll();
});

socket.on('disconnectMessage', (message) => {
    const html = systemNoticeTemplate({
        text: message.text,
        pillClass: 'system-notice-leave'
    });
    messageBox.insertAdjacentHTML('beforeend', html);
    autoScroll();
});

socket.on('roomData', ({ usersList }) => {
    setUsersList(usersList);
});

socket.on('receiveMessage', (message) => {
    const sender = message.username || 'User';
    const html = messageTemplateReceiver({
        message: message.text,
        messageTime: moment(message.messageTime).format('h:mm a'),
        username: sender,
        initial: sender.charAt(0).toUpperCase(),
        avatarColor: getAvatarStyle(sender)
    });
    messageBox.insertAdjacentHTML('beforeend', html);
    autoScroll();
});

socket.on('receiveLocation', (message) => {
    const sender = message.username || 'User';
    const html = locationTemplateReceiver({
        message: message.text,
        messageTime: moment(message.messageTime).format('h:mm a'),
        username: sender,
        initial: sender.charAt(0).toUpperCase(),
        avatarColor: getAvatarStyle(sender)
    });
    messageBox.insertAdjacentHTML('beforeend', html);
    autoScroll();
});

// Send text message handler
const handleSendMessage = () => {
    const inputMessage = messageInput ? messageInput.value : '';
    if (!inputMessage || !inputMessage.trim()) {
        return;
    }

    const trimmed = inputMessage.trim();
    const html = messageTemplateSender({
        message: trimmed,
        messageTime: moment().format('h:mm a'),
        username: username
    });

    if (messageSendButton) messageSendButton.disabled = true;
    if (messageInput) {
        messageInput.value = '';
        messageInput.focus();
    }

    messageBox.insertAdjacentHTML('beforeend', html);
    autoScroll();

    socket.emit('sendMessage', trimmed, (response = {}) => {
        if (messageSendButton) messageSendButton.disabled = false;
        if (response.error) {
            alert(response.error);
        }
    });
};

if (messageForm) {
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSendMessage();
    });
}

// Send location handler
if (locationSendButton) {
    locationSendButton.addEventListener('click', () => {
        if (!navigator.geolocation) {
            return alert('Geolocation is not supported by your browser.');
        }

        locationSendButton.disabled = true;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const locUrl = `https://google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`;
                const html = locationTemplateSender({
                    message: locUrl,
                    messageTime: moment().format('h:mm a'),
                    username: username
                });

                messageBox.insertAdjacentHTML('beforeend', html);
                autoScroll();

                socket.emit('sendLocation', locUrl, (response = {}) => {
                    locationSendButton.disabled = false;
                    if (response.error) {
                        alert(response.error);
                    }
                });
            },
            (error) => {
                locationSendButton.disabled = false;
                alert('Unable to fetch your location: ' + error.message);
            }
        );
    });
}

// Join the room
socket.emit('join', { username, room }, (error) => {
    if (error) {
        alert(error);
        location.href = '/';
    }
});

// Demo mode simulation for screenshots and UI preview
if (new URLSearchParams(window.location.search).get('demo') === 'true') {
    setTimeout(() => {
        const input = document.getElementById('message');
        if (input) {
            input.value = 'Hey everyone! Happy to join the room 👋';
            handleSendMessage();
        }
    }, 400);
}
