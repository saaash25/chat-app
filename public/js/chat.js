const socket = io();

// -------------------------------------------------------------
// Custom Toast Notification System
// -------------------------------------------------------------
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type}`;

    let iconSvg = '';
    if (type === 'error') {
        iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else if (type === 'success') {
        iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="9 11 12 14 22 4"></polyline></svg>';
    } else if (type === 'warning') {
        iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
    } else {
        iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = `
        <div class="toast-icon">${iconSvg}</div>
        <div class="toast-body">${message}</div>
        <button type="button" class="toast-close-btn" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-hiding');
        setTimeout(() => toast.remove(), 250);
    }, 3500);
}

// -------------------------------------------------------------
// Current User Authentication & Session
// -------------------------------------------------------------
const urlParams = Qs.parse(location.search, { ignoreQueryPrefix: true });
let storedUser = null;

try {
    storedUser = JSON.parse(localStorage.getItem('chat_user') || 'null');
} catch (e) {
    storedUser = null;
}

const currentUser = {
    id: urlParams.userId || (storedUser ? storedUser.id : ''),
    name: urlParams.username || (storedUser ? storedUser.name : 'Guest User'),
    phoneNumber: urlParams.phone || (storedUser ? storedUser.phoneNumber : '+1000000000')
};

// If no user identity, redirect to join/login page
if (!currentUser.name && !currentUser.phoneNumber) {
    location.href = '/';
}

// -------------------------------------------------------------
// UI State & Elements
// -------------------------------------------------------------
let currentMode = 'direct'; // 'direct' or 'room'
let activeDirectUser = null; // { id, name, phoneNumber, isOnline }
let activeRoomName = null; // string or null
let stagedImageDataUrl = null;
let allUsersList = [];
let searchDebounceTimeout = null;

// DOM Elements
const chatboxHead = document.getElementById('chatboxHead');
const chatTypeBadge = document.getElementById('chatTypeBadge');
const headerMetaText = document.getElementById('headerMetaText');
const recipientHeaderAvatar = document.getElementById('recipientHeaderAvatar');
const recipientHeaderName = document.getElementById('recipientHeaderName');

const directMessagesPanel = document.getElementById('directMessagesPanel');
const chatRoomsPanel = document.getElementById('chatRoomsPanel');
const tabDirectBtn = document.getElementById('tabDirectBtn');
const tabRoomsBtn = document.getElementById('tabRoomsBtn');
const onlineUsersCountBadge = document.getElementById('onlineUsersCountBadge');

const userSearchInput = document.getElementById('userSearchInput');
const activeOnlyToggle = document.getElementById('activeOnlyToggle');
const directUsersList = document.getElementById('directUsersList');
const usersListUl = document.getElementById('usersListUl');

const myProfileAvatar = document.getElementById('myProfileAvatar');
const myProfileName = document.getElementById('myProfileName');
const myProfilePhoneText = document.getElementById('myProfilePhoneText');

const welcomingScreen = document.getElementById('welcomingScreen');
const welcomeUserHeading = document.getElementById('welcomeUserHeading');
const activeChatHeader = document.getElementById('activeChatHeader');
const chatMessageDiv = document.getElementById('chatMessageDiv');
const chatInputBar = document.getElementById('chatInputBar');

const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('message');
const messageSendButton = document.getElementById('sendMessage');
const locationSendButton = document.getElementById('sendLocation');

const btnAttachImage = document.getElementById('btnAttachImage');
const imageInput = document.getElementById('imageInput');
const imageStagingBar = document.getElementById('imageStagingBar');
const imageStagingThumb = document.getElementById('imageStagingThumb');
const imageStagingName = document.getElementById('imageStagingName');

const chatSidebar = document.getElementById('chatSidebar');
const menuToggle = document.getElementById('menuToggle');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const socketStatusIndicator = document.getElementById('socketStatusIndicator');

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

// Set welcome user greeting
if (welcomeUserHeading && currentUser.name) {
    welcomeUserHeading.textContent = `Welcome to PulseChat, ${currentUser.name}! 👋`;
}

// Populate bottom profile bar with user details (Item 11)
if (myProfileName) myProfileName.textContent = currentUser.name;
if (myProfilePhoneText) myProfilePhoneText.textContent = currentUser.phoneNumber;
if (myProfileAvatar) {
    myProfileAvatar.textContent = (currentUser.name || 'U').charAt(0).toUpperCase();
    myProfileAvatar.style.background = getAvatarStyle(currentUser.name);
}

// -------------------------------------------------------------
// View State Switcher: Welcoming Screen vs Active Chat Pane
// -------------------------------------------------------------

function showWelcomingScreen() {
    activeDirectUser = null;
    activeRoomName = null;

    if (welcomingScreen) welcomingScreen.classList.remove('d-none');
    if (activeChatHeader) activeChatHeader.classList.add('d-none');
    if (chatMessageDiv) chatMessageDiv.classList.add('d-none');
    if (chatInputBar) chatInputBar.classList.add('d-none');
    if (imageStagingBar) imageStagingBar.classList.remove('active');

    // Deselect any highlighted cards
    document.querySelectorAll('.user-card-item').forEach((el) => el.classList.remove('active'));
    document.querySelectorAll('.room-card-item').forEach((el) => el.classList.remove('active'));
}

function showActiveConversationScreen() {
    if (welcomingScreen) welcomingScreen.classList.add('d-none');
    if (activeChatHeader) activeChatHeader.classList.remove('d-none');
    if (chatMessageDiv) chatMessageDiv.classList.remove('d-none');
    if (chatInputBar) chatInputBar.classList.remove('d-none');
    if (messageInput) messageInput.focus();
}

window.closeActiveConversation = function () {
    showWelcomingScreen();
};

// -------------------------------------------------------------
// Precompiled Handlebars Templates
// -------------------------------------------------------------

const messageTemplateSender = Handlebars.compile(
    '<div class="message-row message-row-self">' +
    '  <div class="message-meta">' +
    '    <span class="author-name">You</span> &bull; <span>{{messageTime}}</span>' +
    '  </div>' +
    '  <div class="bubble bubble-self">' +
    '    {{#if text}}<div>{{text}}</div>{{/if}}' +
    '    {{#if imageUrl}}' +
    '      <div class="message-image-container">' +
    '        <img src="{{imageUrl}}" class="message-image" alt="Attachment" onclick="window.open(this.src, \'_blank\')">' +
    '      </div>' +
    '    {{/if}}' +
    '    {{#if location}}' +
    '      <div class="location-card mt-2">' +
    '        <a href="{{location}}" target="_blank" class="location-btn">' +
    '          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>' +
    '          Google Maps Location' +
    '        </a>' +
    '      </div>' +
    '    {{/if}}' +
    '  </div>' +
    '</div>'
);

const messageTemplateReceiver = Handlebars.compile(
    '<div class="message-row message-row-other">' +
    '  <div class="d-flex align-items-start gap-2">' +
    '    <div class="user-avatar-circle" style="background: {{avatarColor}}; width: 32px; height: 32px; font-size: 0.8rem;">{{initial}}</div>' +
    '    <div>' +
    '      <div class="message-meta">' +
    '        <span class="author-name">{{username}}</span> &bull; <span>{{messageTime}}</span>' +
    '      </div>' +
    '      <div class="bubble bubble-other">' +
    '        {{#if text}}<div>{{text}}</div>{{/if}}' +
    '        {{#if imageUrl}}' +
    '          <div class="message-image-container">' +
    '            <img src="{{imageUrl}}" class="message-image" alt="Attachment" onclick="window.open(this.src, \'_blank\')">' +
    '          </div>' +
    '        {{/if}}' +
    '        {{#if location}}' +
    '          <div class="location-card mt-2">' +
    '            <a href="{{location}}" target="_blank" class="location-btn">' +
    '              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>' +
    '              Google Maps Location' +
    '            </a>' +
    '          </div>' +
    '        {{/if}}' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '</div>'
);

const systemNoticeTemplate = Handlebars.compile(
    '<div class="system-notice-row">' +
    '  <span class="system-notice-pill {{pillClass}}">' +
    '    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>' +
    '    <span>{{text}}</span>' +
    '  </span>' +
    '</div>'
);

const directUserCardTemplate = Handlebars.compile(
    '<div class="user-card-item {{#if isActive}}active{{/if}}" onclick="selectDirectUser(\'{{id}}\')">' +
    '  <div class="avatar-wrapper">' +
    '    <div class="user-avatar-circle" style="background: {{avatarColor}};">{{initial}}</div>' +
    '    <span class="status-dot {{#if isOnline}}online{{else}}offline{{/if}}"></span>' +
    '  </div>' +
    '  <div class="user-info-text">' +
    '    <div class="user-info-name">{{name}}</div>' +
    '    <div class="user-info-phone">{{phoneNumber}}</div>' +
    '  </div>' +
    '  {{#if isOnline}}<span class="badge bg-success-subtle text-success border border-success-subtle" style="font-size:0.68rem;">Online</span>{{/if}}' +
    '</div>'
);

const roomUserTemplate = Handlebars.compile(
    '<div class="user-item">' +
    '  <div class="user-avatar-circle" style="background: {{avatarColor}}; width: 28px; height: 28px; font-size: 0.75rem;">{{initial}}</div>' +
    '  <span class="user-name-text">{{username}}</span>' +
    '</div>'
);

const autoScroll = () => {
    if (chatMessageDiv) {
        chatMessageDiv.scrollTop = chatMessageDiv.scrollHeight;
    }
};

// -------------------------------------------------------------
// Sidebar Navigation (Direct Messages vs Chat Rooms)
// -------------------------------------------------------------

window.switchSidebarTab = function (tab) {
    if (tab === 'direct') {
        currentMode = 'direct';
        tabDirectBtn.classList.add('active');
        tabRoomsBtn.classList.remove('active');
        directMessagesPanel.classList.remove('d-none');
        chatRoomsPanel.classList.add('d-none');

        if (activeDirectUser) {
            updateHeaderForDirect(activeDirectUser);
            showActiveConversationScreen();
        } else {
            showWelcomingScreen();
        }
        fetchRegisteredUsers();
    } else {
        currentMode = 'room';
        tabRoomsBtn.classList.add('active');
        tabDirectBtn.classList.remove('active');
        chatRoomsPanel.classList.remove('d-none');
        directMessagesPanel.classList.add('d-none');

        if (activeRoomName) {
            updateHeaderForRoom(activeRoomName);
            showActiveConversationScreen();
        } else {
            showWelcomingScreen();
        }
    }
};

// -------------------------------------------------------------
// Direct Messages: User Search & Selection
// -------------------------------------------------------------

const fetchRegisteredUsers = (callback) => {
    const query = userSearchInput ? userSearchInput.value.trim() : '';
    const activeOnly = activeOnlyToggle ? activeOnlyToggle.checked : false;

    socket.emit('searchUsers', { query, activeOnly }, ({ users = [] } = {}) => {
        allUsersList = users;
        renderUsersList(users);

        const onlineCount = users.filter((u) => u.isOnline).length;
        if (onlineUsersCountBadge) {
            onlineUsersCountBadge.textContent = onlineCount;
        }

        if (typeof callback === 'function') {
            callback(users);
        }
    });
};

const renderUsersList = (users) => {
    if (!directUsersList) return;
    directUsersList.innerHTML = '';

    if (users.length === 0) {
        directUsersList.innerHTML = '<div class="text-center text-muted p-4" style="font-size:0.85rem;">No contacts found</div>';
        return;
    }

    users.forEach((u) => {
        const isCurrentActive = activeDirectUser && activeDirectUser.id === u.id;
        const html = directUserCardTemplate({
            id: u.id,
            name: u.name,
            phoneNumber: u.phoneNumber,
            initial: (u.name || 'U').charAt(0).toUpperCase(),
            avatarColor: getAvatarStyle(u.name),
            isOnline: u.isOnline,
            isActive: isCurrentActive
        });
        directUsersList.insertAdjacentHTML('beforeend', html);
    });
};

window.selectDirectUser = function (userId) {
    let user = allUsersList.find((u) => u.id === userId);
    if (!user) {
        fetchRegisteredUsers((users) => {
            const found = users.find((u) => u.id === userId);
            if (found) {
                window.selectDirectUser(userId);
            }
        });
        return;
    }

    activeDirectUser = user;
    currentMode = 'direct';

    updateHeaderForDirect(user);
    showActiveConversationScreen();
    renderUsersList(allUsersList);

    // Clear message feed and fetch 1-on-1 history
    chatMessageDiv.innerHTML = '';

    const welcomeNotice = systemNoticeTemplate({
        text: `Direct conversation with ${user.name} (${user.phoneNumber})`,
        pillClass: 'system-notice-join'
    });
    chatMessageDiv.insertAdjacentHTML('beforeend', welcomeNotice);

    socket.emit('getDirectHistory', { withUserId: user.id }, ({ messages = [] } = {}) => {
        messages.forEach((msg) => {
            const isSelf = msg.fromUserId === currentUser.id;
            if (isSelf) {
                const html = messageTemplateSender({
                    text: msg.text,
                    imageUrl: msg.imageUrl,
                    location: msg.location,
                    messageTime: moment(msg.timestamp || msg.messageTime).format('h:mm a')
                });
                chatMessageDiv.insertAdjacentHTML('beforeend', html);
            } else {
                const html = messageTemplateReceiver({
                    text: msg.text,
                    imageUrl: msg.imageUrl,
                    location: msg.location,
                    username: user.name,
                    initial: (user.name || 'U').charAt(0).toUpperCase(),
                    avatarColor: getAvatarStyle(user.name),
                    messageTime: moment(msg.timestamp || msg.messageTime).format('h:mm a')
                });
                chatMessageDiv.insertAdjacentHTML('beforeend', html);
            }
        });
        autoScroll();
    });

    if (window.innerWidth <= 768 && chatSidebar && sidebarBackdrop) {
        chatSidebar.classList.remove('open');
        sidebarBackdrop.classList.remove('active');
    }
};

const updateHeaderForDirect = (user) => {
    chatboxHead.textContent = user.name;
    chatTypeBadge.textContent = 'Direct Message';
    chatTypeBadge.className = 'header-type-pill pill-direct';
    headerMetaText.innerHTML = `Phone: <b>${user.phoneNumber}</b> &bull; ${
        user.isOnline ? '<span class="text-success fw-bold">🟢 Active Now</span>' : '<span class="text-muted">⚪ Offline</span>'
    }`;

    if (recipientHeaderName) recipientHeaderName.textContent = user.name;
    if (recipientHeaderAvatar) {
        recipientHeaderAvatar.textContent = (user.name || 'U').charAt(0).toUpperCase();
        recipientHeaderAvatar.style.background = getAvatarStyle(user.name);
    }
};

const updateHeaderForRoom = (roomName) => {
    chatboxHead.textContent = `#${roomName}`;
    chatTypeBadge.textContent = 'Chat Room';
    chatTypeBadge.className = 'header-type-pill pill-room';
    headerMetaText.textContent = 'Group conversation room';

    if (recipientHeaderName) recipientHeaderName.textContent = roomName;
    if (recipientHeaderAvatar) {
        recipientHeaderAvatar.textContent = '#';
        recipientHeaderAvatar.style.background = 'var(--primary-gradient)';
    }
};

// -------------------------------------------------------------
// Chat Rooms Logic
// -------------------------------------------------------------

window.joinRoomByName = function (roomName) {
    if (!roomName) return;
    activeRoomName = roomName;
    currentMode = 'room';

    updateHeaderForRoom(roomName);
    showActiveConversationScreen();

    // Update active highlight in room list
    document.querySelectorAll('.room-card-item').forEach((el) => {
        const text = el.innerText || '';
        if (text.includes(roomName)) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });

    chatMessageDiv.innerHTML = '';

    socket.emit('join', {
        username: currentUser.name,
        room: roomName,
        userId: currentUser.id
    }, (error) => {
        if (error) {
            showToast(error, 'error');
        }
    });

    if (window.innerWidth <= 768 && chatSidebar && sidebarBackdrop) {
        chatSidebar.classList.remove('open');
        sidebarBackdrop.classList.remove('active');
    }
};

window.joinCustomRoom = function () {
    const input = document.getElementById('customRoomInput');
    const val = input ? input.value.trim() : '';
    if (val) {
        joinRoomByName(val);
        input.value = '';
    } else {
        showToast('Please enter a room name.', 'warning');
    }
};

// -------------------------------------------------------------
// Image Attachment Staging
// -------------------------------------------------------------

if (btnAttachImage && imageInput) {
    btnAttachImage.addEventListener('click', () => {
        imageInput.click();
    });

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('Please select a valid image file (PNG, JPG, GIF, WebP).', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            stagedImageDataUrl = event.target.result;
            imageStagingThumb.src = stagedImageDataUrl;
            imageStagingName.textContent = file.name;
            imageStagingBar.classList.add('active');
            if (messageInput) messageInput.focus();
        };
        reader.readAsDataURL(file);
    });
}

window.clearStagedImage = function () {
    stagedImageDataUrl = null;
    if (imageInput) imageInput.value = '';
    if (imageStagingBar) imageStagingBar.classList.remove('active');
};

// -------------------------------------------------------------
// Message Sending (Direct Message or Room Message)
// -------------------------------------------------------------

const handleSendMessage = async () => {
    const text = messageInput ? messageInput.value.trim() : '';
    const hasImage = !!stagedImageDataUrl;

    if (!text && !hasImage) {
        return;
    }

    if (messageSendButton) messageSendButton.disabled = true;

    if (currentMode === 'direct') {
        if (!activeDirectUser) {
            showToast('Please select a contact from the sidebar to send a direct message.', 'warning');
            if (messageSendButton) messageSendButton.disabled = false;
            return;
        }

        let uploadedImageUrl = '';

        if (hasImage) {
            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageBase64: stagedImageDataUrl })
                });
                const data = await res.json();
                if (data.success) {
                    uploadedImageUrl = data.imageUrl;
                }
            } catch (err) {
                console.error('Image upload failed:', err);
                showToast('Failed to upload image.', 'error');
            }
        }

        const payload = {
            toUserId: activeDirectUser.id,
            text: text,
            imageUrl: uploadedImageUrl
        };

        const html = messageTemplateSender({
            text: text,
            imageUrl: uploadedImageUrl,
            messageTime: moment().format('h:mm a')
        });
        chatMessageDiv.insertAdjacentHTML('beforeend', html);
        autoScroll();

        if (messageInput) {
            messageInput.value = '';
            messageInput.focus();
        }
        clearStagedImage();

        socket.emit('sendDirectMessage', payload, (response = {}) => {
            if (messageSendButton) messageSendButton.disabled = false;
            if (response.error) {
                showToast(response.error, 'error');
            }
        });
    } else {
        // Room mode
        socket.emit('sendMessage', text, (response = {}) => {
            if (messageSendButton) messageSendButton.disabled = false;
            if (response.error) {
                showToast(response.error, 'error');
            }
        });

        const html = messageTemplateSender({
            text: text,
            messageTime: moment().format('h:mm a')
        });
        chatMessageDiv.insertAdjacentHTML('beforeend', html);
        autoScroll();

        if (messageInput) {
            messageInput.value = '';
            messageInput.focus();
        }
    }
};

if (messageForm) {
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSendMessage();
    });
}

// Location Sharing
if (locationSendButton) {
    locationSendButton.addEventListener('click', () => {
        if (!navigator.geolocation) {
            return showToast('Geolocation is not supported by your browser.', 'warning');
        }

        locationSendButton.disabled = true;

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const locUrl = `https://google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;

                if (currentMode === 'direct') {
                    if (!activeDirectUser) {
                        locationSendButton.disabled = false;
                        return showToast('Please select a contact from the sidebar to share location.', 'warning');
                    }

                    const html = messageTemplateSender({
                        location: locUrl,
                        messageTime: moment().format('h:mm a')
                    });
                    chatMessageDiv.insertAdjacentHTML('beforeend', html);
                    autoScroll();

                    socket.emit('sendDirectMessage', {
                        toUserId: activeDirectUser.id,
                        location: locUrl
                    }, () => {
                        locationSendButton.disabled = false;
                        showToast('Location shared successfully!', 'success');
                    });
                } else {
                    const html = messageTemplateSender({
                        location: locUrl,
                        messageTime: moment().format('h:mm a')
                    });
                    chatMessageDiv.insertAdjacentHTML('beforeend', html);
                    autoScroll();

                    socket.emit('sendLocation', locUrl, () => {
                        locationSendButton.disabled = false;
                        showToast('Location shared to room!', 'success');
                    });
                }
            },
            (err) => {
                locationSendButton.disabled = false;
                showToast('Unable to fetch your location: ' + err.message, 'error');
            }
        );
    });
}

// -------------------------------------------------------------
// Real-Time Socket Event Listeners
// -------------------------------------------------------------

socket.on('connect', () => {
    if (socketStatusIndicator) {
        socketStatusIndicator.classList.remove('offline');
        socketStatusIndicator.title = 'Connected';
    }
    // Re-authenticate on reconnect
    socket.emit('auth', currentUser, (ack) => {
        fetchRegisteredUsers();
    });
});

socket.on('disconnect', () => {
    if (socketStatusIndicator) {
        socketStatusIndicator.classList.add('offline');
        socketStatusIndicator.title = 'Disconnected (Reconnecting...)';
    }
});

// Direct Message received in real-time
socket.on('receiveDirectMessage', (message) => {
    if (currentMode === 'direct' && activeDirectUser && message.fromUserId === activeDirectUser.id) {
        const html = messageTemplateReceiver({
            text: message.text,
            imageUrl: message.imageUrl,
            location: message.location,
            username: message.fromUserName || activeDirectUser.name,
            initial: (message.fromUserName || activeDirectUser.name || 'U').charAt(0).toUpperCase(),
            avatarColor: getAvatarStyle(message.fromUserName || activeDirectUser.name),
            messageTime: moment(message.timestamp || message.messageTime).format('h:mm a')
        });
        chatMessageDiv.insertAdjacentHTML('beforeend', html);
        autoScroll();
    } else {
        // Notify user about incoming message from someone else
        showToast(`New message from ${message.fromUserName || 'a contact'}!`, 'info');
        fetchRegisteredUsers();
    }
});

// Presence changed (user went online/offline)
socket.on('userPresenceChanged', ({ userId, isOnline }) => {
    const user = allUsersList.find((u) => u.id === userId);
    if (user) {
        user.isOnline = isOnline;
        renderUsersList(allUsersList);
    }
    if (activeDirectUser && activeDirectUser.id === userId) {
        activeDirectUser.isOnline = isOnline;
        updateHeaderForDirect(activeDirectUser);
    }
});

// Room Events
socket.on('welcome', (message) => {
    if (currentMode === 'room') {
        const html = systemNoticeTemplate({
            text: `Welcome to #${message.room || activeRoomName}!`,
            pillClass: 'system-notice-join'
        });
        chatMessageDiv.insertAdjacentHTML('beforeend', html);
        autoScroll();
    }
});

socket.on('joinMessage', (message) => {
    if (currentMode === 'room') {
        const html = systemNoticeTemplate({
            text: message.text,
            pillClass: 'system-notice-join'
        });
        chatMessageDiv.insertAdjacentHTML('beforeend', html);
        autoScroll();
    }
});

socket.on('disconnectMessage', (message) => {
    if (currentMode === 'room') {
        const html = systemNoticeTemplate({
            text: message.text,
            pillClass: 'system-notice-leave'
        });
        chatMessageDiv.insertAdjacentHTML('beforeend', html);
        autoScroll();
    }
});

socket.on('roomData', ({ usersList = [] } = {}) => {
    if (usersListUl) {
        usersListUl.innerHTML = '';
        usersList.forEach((u) => {
            const html = roomUserTemplate({
                username: u.username,
                initial: (u.username || 'U').charAt(0).toUpperCase(),
                avatarColor: getAvatarStyle(u.username)
            });
            usersListUl.insertAdjacentHTML('beforeend', html);
        });
    }
});

socket.on('receiveMessage', (message) => {
    if (currentMode === 'room') {
        const sender = message.username || 'User';
        const html = messageTemplateReceiver({
            text: message.text,
            username: sender,
            initial: sender.charAt(0).toUpperCase(),
            avatarColor: getAvatarStyle(sender),
            messageTime: moment(message.messageTime).format('h:mm a')
        });
        chatMessageDiv.insertAdjacentHTML('beforeend', html);
        autoScroll();
    }
});

socket.on('receiveLocation', (message) => {
    if (currentMode === 'room') {
        const sender = message.username || 'User';
        const html = messageTemplateReceiver({
            location: message.text,
            username: sender,
            initial: sender.charAt(0).toUpperCase(),
            avatarColor: getAvatarStyle(sender),
            messageTime: moment(message.messageTime).format('h:mm a')
        });
        chatMessageDiv.insertAdjacentHTML('beforeend', html);
        autoScroll();
    }
});

// Sign Out Handler
window.handleSignOut = function () {
    localStorage.removeItem('chat_user');
    window.location.href = '/';
};

// Search filtering with debounce
if (userSearchInput) {
    userSearchInput.addEventListener('input', () => {
        clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(() => {
            fetchRegisteredUsers();
        }, 200);
    });
}
if (activeOnlyToggle) {
    activeOnlyToggle.addEventListener('change', () => {
        fetchRegisteredUsers();
    });
}

// Mobile sidebar toggle
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

// -------------------------------------------------------------
// Initialize Connection & Authentication
// -------------------------------------------------------------

socket.emit('auth', currentUser, (ack) => {
    fetchRegisteredUsers((users) => {
        if (urlParams.directWith) {
            switchSidebarTab('direct');
            window.selectDirectUser(urlParams.directWith);
        } else if (urlParams.room) {
            switchSidebarTab('rooms');
            joinRoomByName(urlParams.room);
        } else {
            showWelcomingScreen();
        }
    });
});
