const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const {
    validatePhoneNumber,
    validateName,
    registerUser,
    loginOrRegister,
    getUserById,
    getUserByPhone,
    searchUsers,
    saveDirectMessage,
    getDirectConversation,
    resetDB
} = require('../utils/db');

describe('utils/db', () => {
    beforeEach(() => {
        resetDB();
    });

    describe('validatePhoneNumber', () => {
        it('should accept valid international and standard phone numbers', () => {
            const res1 = validatePhoneNumber('+1 234 567 8900');
            assert.strictEqual(res1.valid, true);
            assert.strictEqual(res1.normalized, '+12345678900');

            const res2 = validatePhoneNumber('9876543210');
            assert.strictEqual(res2.valid, true);
            assert.strictEqual(res2.normalized, '9876543210');

            const res3 = validatePhoneNumber('+91-98765-43210');
            assert.strictEqual(res3.valid, true);
            assert.strictEqual(res3.normalized, '+919876543210');
        });

        it('should reject invalid, too short, or non-numeric phone numbers', () => {
            assert.strictEqual(validatePhoneNumber('').valid, false);
            assert.strictEqual(validatePhoneNumber('123').valid, false);
            assert.strictEqual(validatePhoneNumber('abcdefgh').valid, false);
            assert.strictEqual(validatePhoneNumber(null).valid, false);
            assert.strictEqual(validatePhoneNumber(1234567).valid, false);
        });
    });

    describe('validateName', () => {
        it('should accept valid display names', () => {
            const res = validateName('  Alice Smith  ');
            assert.strictEqual(res.valid, true);
            assert.strictEqual(res.name, 'Alice Smith');
        });

        it('should reject empty or 1-character names', () => {
            assert.strictEqual(validateName('').valid, false);
            assert.strictEqual(validateName('A').valid, false);
            assert.strictEqual(validateName(null).valid, false);
        });
    });

    describe('User Registration & Phone Uniqueness', () => {
        it('should register a new user successfully', () => {
            const { error, user } = registerUser({ name: 'Alice', phoneNumber: '+1234567890' });
            assert.strictEqual(error, undefined);
            assert.ok(user.id);
            assert.strictEqual(user.name, 'Alice');
            assert.strictEqual(user.phoneNumber, '+1234567890');
        });

        it('should reject duplicate phone numbers on registration', () => {
            registerUser({ name: 'Alice', phoneNumber: '9876543210' });
            const { error, user } = registerUser({ name: 'Bob', phoneNumber: '9876543210' });
            assert.ok(error.includes('already registered'));
            assert.strictEqual(user, undefined);
        });

        it('should find user by phone or ID', () => {
            const { user: created } = registerUser({ name: 'Charlie', phoneNumber: '+447911123456' });
            const byId = getUserById(created.id);
            assert.strictEqual(byId.name, 'Charlie');

            const byPhone = getUserByPhone('+44 7911 123456');
            assert.strictEqual(byPhone.id, created.id);
        });

        it('loginOrRegister should log in existing user or register new user', () => {
            const res1 = loginOrRegister({ name: 'David', phoneNumber: '9123456780' });
            assert.strictEqual(res1.error, undefined);
            const user1 = res1.user;

            const res2 = loginOrRegister({ name: 'David', phoneNumber: '9123456780' });
            assert.strictEqual(res2.error, undefined);
            assert.strictEqual(res2.user.id, user1.id);
            assert.strictEqual(res2.isNew, false);
        });
    });

    describe('searchUsers', () => {
        it('should search users by name or phone excluding requester', () => {
            const { user: u1 } = registerUser({ name: 'Alice Walker', phoneNumber: '1111222233' });
            const { user: u2 } = registerUser({ name: 'Bob Marley', phoneNumber: '4444555566' });
            const { user: u3 } = registerUser({ name: 'Alice Cooper', phoneNumber: '7777888899' });

            const searchAlice = searchUsers('alice', u1.id);
            assert.strictEqual(searchAlice.length, 1);
            assert.strictEqual(searchAlice[0].name, 'Alice Cooper');

            const searchPhone = searchUsers('4444', u1.id);
            assert.strictEqual(searchPhone.length, 1);
            assert.strictEqual(searchPhone[0].name, 'Bob Marley');
        });
    });

    describe('Direct Messages & Images Persistence', () => {
        it('should save and retrieve direct text and image messages', () => {
            const { user: u1 } = registerUser({ name: 'UserA', phoneNumber: '1111111111' });
            const { user: u2 } = registerUser({ name: 'UserB', phoneNumber: '2222222222' });

            const msg1 = saveDirectMessage({
                fromUserId: u1.id,
                toUserId: u2.id,
                text: 'Hello UserB!'
            });
            assert.strictEqual(msg1.error, undefined);
            assert.strictEqual(msg1.message.text, 'Hello UserB!');

            const msg2 = saveDirectMessage({
                fromUserId: u2.id,
                toUserId: u1.id,
                imageUrl: '/uploads/sample.png'
            });
            assert.strictEqual(msg2.error, undefined);
            assert.strictEqual(msg2.message.imageUrl, '/uploads/sample.png');

            const history = getDirectConversation(u1.id, u2.id);
            assert.strictEqual(history.length, 2);
            assert.strictEqual(history[0].text, 'Hello UserB!');
            assert.strictEqual(history[1].imageUrl, '/uploads/sample.png');
        });
    });
});
