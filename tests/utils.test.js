const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { addUser, removeUser, findUser, findUsersInRoom, resetUsers, getUsers } = require('../utils/user');
const getMessageObject = require('../utils/message');

describe('utils/user', () => {
    beforeEach(() => {
        resetUsers();
    });

    describe('addUser', () => {
        it('should add a user with valid username and room', () => {
            const { error, user } = addUser({ id: 'socket1', username: 'Alice', room: 'Cricket' });
            assert.strictEqual(error, undefined);
            assert.deepStrictEqual(user, { id: 'socket1', username: 'alice', room: 'cricket' });
            assert.strictEqual(getUsers().length, 1);
        });

        it('should trim and lowercase username and room', () => {
            const { error, user } = addUser({ id: 'socket2', username: '  Bob  ', room: '  Football  ' });
            assert.strictEqual(error, undefined);
            assert.strictEqual(user.username, 'bob');
            assert.strictEqual(user.room, 'football');
        });

        it('should return error when username or room is missing or not a string', () => {
            const res1 = addUser({ id: 'socket3', username: '', room: 'Cricket' });
            assert.strictEqual(res1.error, 'username and room required!');

            const res2 = addUser({ id: 'socket4', username: 'Alice', room: '' });
            assert.strictEqual(res2.error, 'username and room required!');

            const res3 = addUser({ id: 'socket5' });
            assert.strictEqual(res3.error, 'username and room required!');

            const res4 = addUser();
            assert.strictEqual(res4.error, 'username and room required!');

            const res5 = addUser({ id: 'socket6', username: 123, room: 'Cricket' });
            assert.strictEqual(res5.error, 'username and room required!');
        });

        it('should return error if user already exists in the same room', () => {
            addUser({ id: 'socket1', username: 'Alice', room: 'Cricket' });
            const { error, user } = addUser({ id: 'socket2', username: 'alice', room: 'cricket' });
            assert.strictEqual(error, 'user already exist in this room!');
            assert.strictEqual(user, undefined);
        });

        it('should allow same username in different rooms', () => {
            const res1 = addUser({ id: 'socket1', username: 'Alice', room: 'Cricket' });
            const res2 = addUser({ id: 'socket2', username: 'Alice', room: 'Football' });
            assert.strictEqual(res1.error, undefined);
            assert.strictEqual(res2.error, undefined);
            assert.strictEqual(getUsers().length, 2);
        });
    });

    describe('removeUser', () => {
        it('should remove existing user by id', () => {
            addUser({ id: 'socket1', username: 'Alice', room: 'Cricket' });
            const { error, user } = removeUser('socket1');
            assert.strictEqual(error, undefined);
            assert.strictEqual(user.username, 'alice');
            assert.strictEqual(getUsers().length, 0);
        });

        it('should return error when user id does not exist', () => {
            const { error, user } = removeUser('non-existent');
            assert.strictEqual(error, 'the user not found in this chat room!');
            assert.strictEqual(user, undefined);
        });
    });

    describe('findUser', () => {
        it('should find existing user by id', () => {
            addUser({ id: 'socket1', username: 'Alice', room: 'Cricket' });
            const { error, user } = findUser('socket1');
            assert.strictEqual(error, undefined);
            assert.strictEqual(user.id, 'socket1');
            assert.strictEqual(user.username, 'alice');
        });

        it('should return error if user not found', () => {
            const { error, user } = findUser('socket99');
            assert.strictEqual(error, 'no such user found!');
            assert.strictEqual(user, undefined);
        });
    });

    describe('findUsersInRoom', () => {
        it('should return all users in a specific room', () => {
            addUser({ id: 's1', username: 'Alice', room: 'Cricket' });
            addUser({ id: 's2', username: 'Bob', room: 'Cricket' });
            addUser({ id: 's3', username: 'Charlie', room: 'Football' });

            const cricketUsers = findUsersInRoom('Cricket');
            assert.strictEqual(cricketUsers.length, 2);
            assert.strictEqual(cricketUsers[0].username, 'alice');
            assert.strictEqual(cricketUsers[1].username, 'bob');
        });

        it('should return empty array if room has no users', () => {
            const users = findUsersInRoom('Unknown');
            assert.deepStrictEqual(users, []);
        });

        it('should safely return empty array for invalid room argument', () => {
            assert.deepStrictEqual(findUsersInRoom(), []);
            assert.deepStrictEqual(findUsersInRoom(null), []);
            assert.deepStrictEqual(findUsersInRoom(123), []);
        });
    });
});

describe('utils/message', () => {
    it('should generate a message object with timestamps and properties', () => {
        const before = Date.now();
        const msg = getMessageObject('Hello World', 'Alice', 'Header Title', 'Cricket');
        const after = Date.now();

        assert.strictEqual(msg.text, 'Hello World');
        assert.strictEqual(msg.username, 'Alice');
        assert.strictEqual(msg.chatboxHead, 'Header Title');
        assert.strictEqual(msg.room, 'Cricket');
        assert.ok(msg.messageTime >= before && msg.messageTime <= after);
    });

    it('should use default empty strings for optional parameters', () => {
        const msg = getMessageObject('Test message');
        assert.strictEqual(msg.text, 'Test message');
        assert.strictEqual(msg.username, '');
        assert.strictEqual(msg.chatboxHead, '');
        assert.strictEqual(msg.room, '');
        assert.ok(typeof msg.messageTime === 'number');
    });
});
