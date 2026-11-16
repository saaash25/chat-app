const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DIRECT_MESSAGES_FILE = path.join(DATA_DIR, 'direct_messages.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to safely read JSON
function readJSON(filePath, defaultData = []) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
            return defaultData;
        }
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content || '[]');
    } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
        return defaultData;
    }
}

// Helper to safely write JSON atomically
function writeJSON(filePath, data) {
    try {
        const tmpFile = `${filePath}.${Date.now()}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tmpFile, filePath);
    } catch (err) {
        console.error(`Error writing to ${filePath}:`, err);
    }
}

/**
 * Validates and normalizes phone numbers (E.164 compatible: 7-15 digits, optional leading +)
 */
function validatePhoneNumber(rawPhone) {
    if (!rawPhone || typeof rawPhone !== 'string') {
        return { valid: false, error: 'Phone number is required!' };
    }

    const trimmed = rawPhone.trim();
    // Remove formatting characters: spaces, hyphens, parentheses, dots
    const normalized = trimmed.replace(/[\s\-\(\)\.]/g, '');

    // Check E.164 format: optional '+', first non-zero digit, 6 to 14 more digits
    const phoneRegex = /^\+?[1-9]\d{6,14}$/;
    if (!phoneRegex.test(normalized)) {
        return {
            valid: false,
            error: 'Invalid phone number format. Must contain 7 to 15 digits (e.g. +1234567890 or 9876543210).'
        };
    }

    return { valid: true, normalized };
}

/**
 * Validates display name
 */
function validateName(name) {
    if (!name || typeof name !== 'string' || !name.trim()) {
        return { valid: false, error: 'Name is required!' };
    }
    const trimmed = name.trim();
    if (trimmed.length < 2) {
        return { valid: false, error: 'Name must be at least 2 characters long!' };
    }
    return { valid: true, name: trimmed };
}

/**
 * Retrieves all registered users
 */
function getAllUsers() {
    return readJSON(USERS_FILE, []);
}

/**
 * Finds user by phone number
 */
function getUserByPhone(rawPhone) {
    const { valid, normalized } = validatePhoneNumber(rawPhone);
    if (!valid) return null;

    const users = getAllUsers();
    return users.find((u) => u.phoneNumber === normalized) || null;
}

/**
 * Log in an existing user with phone number only
 */
function loginUserByPhone(phoneNumber) {
    const phoneCheck = validatePhoneNumber(phoneNumber);
    if (!phoneCheck.valid) {
        return { error: phoneCheck.error, user: undefined };
    }

    const user = getUserByPhone(phoneCheck.normalized);
    if (!user) {
        return {
            error: 'Mobile number not registered. Please sign up first.',
            user: undefined
        };
    }

    return { error: undefined, user };
}

/**
 * Finds user by ID
 */
function getUserById(id) {
    if (!id) return null;
    const users = getAllUsers();
    return users.find((u) => u.id === id) || null;
}

/**
 * Registers a new user with phone number uniqueness check
 */
function registerUser({ name, phoneNumber }) {
    const nameCheck = validateName(name);
    if (!nameCheck.valid) {
        return { error: nameCheck.error, user: undefined };
    }

    const phoneCheck = validatePhoneNumber(phoneNumber);
    if (!phoneCheck.valid) {
        return { error: phoneCheck.error, user: undefined };
    }

    const users = getAllUsers();
    const existing = users.find((u) => u.phoneNumber === phoneCheck.normalized);
    if (existing) {
        return {
            error: 'Phone number is already registered! Please sign in.',
            user: undefined
        };
    }

    const newUser = {
        id: crypto.randomUUID ? crypto.randomUUID() : `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        name: nameCheck.name,
        phoneNumber: phoneCheck.normalized,
        createdAt: Date.now()
    };

    users.push(newUser);
    writeJSON(USERS_FILE, users);

    return { error: undefined, user: newUser };
}

/**
 * Authenticates an existing user or registers a new one
 */
function loginOrRegister({ name, phoneNumber }) {
    const phoneCheck = validatePhoneNumber(phoneNumber);
    if (!phoneCheck.valid) {
        return { error: phoneCheck.error, user: undefined };
    }

    const users = getAllUsers();
    const existing = users.find((u) => u.phoneNumber === phoneCheck.normalized);

    if (existing) {
        // If name provided and differs, optionally update or keep existing
        if (name && typeof name === 'string' && name.trim().length >= 2 && existing.name !== name.trim()) {
            existing.name = name.trim();
            writeJSON(USERS_FILE, users);
        }
        return { error: undefined, user: existing, isNew: false };
    }

    // Register new user
    return registerUser({ name, phoneNumber });
}

/**
 * Search registered users by query (name or phone) excluding current user
 */
function searchUsers(query = '', excludeUserId = '') {
    const users = getAllUsers();
    const q = (query || '').toLowerCase().trim();

    return users.filter((u) => {
        if (excludeUserId && u.id === excludeUserId) {
            return false;
        }
        if (!q) {
            return true;
        }
        return u.name.toLowerCase().includes(q) || u.phoneNumber.includes(q);
    });
}

/**
 * Saves a direct message to local DB
 */
function saveDirectMessage({ fromUserId, toUserId, text = '', imageUrl = '', location = '' }) {
    if (!fromUserId || !toUserId) {
        return { error: 'fromUserId and toUserId are required!' };
    }

    if (!text && !imageUrl && !location) {
        return { error: 'Message must contain text, an image, or a location!' };
    }

    const messages = readJSON(DIRECT_MESSAGES_FILE, []);
    const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        fromUserId,
        toUserId,
        text: text ? text.trim() : '',
        imageUrl: imageUrl ? imageUrl.trim() : '',
        location: location ? location.trim() : '',
        timestamp: Date.now(),
        messageTime: Date.now()
    };

    messages.push(message);
    writeJSON(DIRECT_MESSAGES_FILE, messages);

    return { error: undefined, message };
}

/**
 * Gets conversation history between two users
 */
function getDirectConversation(userId1, userId2, limit = 100) {
    if (!userId1 || !userId2) {
        return [];
    }
    const messages = readJSON(DIRECT_MESSAGES_FILE, []);
    const conversation = messages.filter(
        (m) =>
            (m.fromUserId === userId1 && m.toUserId === userId2) ||
            (m.fromUserId === userId2 && m.toUserId === userId1)
    );

    return conversation.slice(-limit);
}

/**
 * Clears data for testing
 */
function resetDB() {
    writeJSON(USERS_FILE, []);
    writeJSON(DIRECT_MESSAGES_FILE, []);
}

module.exports = {
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
    getDirectConversation,
    resetDB
};
