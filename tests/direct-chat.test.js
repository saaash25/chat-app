const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const ioClient = require('socket.io-client');
const { server, io } = require('../src/index');
const { resetDB } = require('../utils/db');
const { resetUsers } = require('../utils/user');

describe('Direct Chat & User Sign Up API & Socket Tests', () => {
    let port;
    let serverUrl;

    before((_, done) => {
        server.listen(0, () => {
            port = server.address().port;
            serverUrl = `http://localhost:${port}`;
            done();
        });
    });

    after((_, done) => {
        io.close(() => {
            if (server.listening) {
                server.close(done);
            } else {
                done();
            }
        });
    });

    beforeEach(() => {
        resetDB();
        resetUsers();
    });

    describe('REST API Authentication & Search', () => {
        it('POST /api/auth/signup should register a user with valid phone and name', async () => {
            const res = await fetch(`${serverUrl}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Alice Smith', phoneNumber: '+1 234 567 8900' })
            });

            assert.strictEqual(res.status, 201);
            const data = await res.json();
            assert.strictEqual(data.success, true);
            assert.strictEqual(data.user.name, 'Alice Smith');
            assert.strictEqual(data.user.phoneNumber, '+12345678900');
        });

        it('POST /api/auth/signup should reject duplicate phone numbers', async () => {
            await fetch(`${serverUrl}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Alice', phoneNumber: '9876543210' })
            });

            const res2 = await fetch(`${serverUrl}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Bob', phoneNumber: '9876543210' })
            });

            assert.strictEqual(res2.status, 400);
            const data = await res2.json();
            assert.strictEqual(data.success, false);
            assert.ok(data.error.includes('already registered'));
        });

        it('POST /api/auth/login should authenticate existing user or register new user', async () => {
            const res = await fetch(`${serverUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Charlie', phoneNumber: '+44 7911 123456' })
            });

            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.success, true);
            assert.strictEqual(data.user.name, 'Charlie');
        });

        it('POST /api/auth/login should authenticate existing user with mobile number only', async () => {
            // First register user
            await fetch(`${serverUrl}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'MobileOnlyUser', phoneNumber: '9888777666' })
            });

            // Log in with ONLY phone number (no name needed)
            const res = await fetch(`${serverUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: '9888777666' })
            });

            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.success, true);
            assert.strictEqual(data.user.name, 'MobileOnlyUser');
            assert.strictEqual(data.user.phoneNumber, '9888777666');
        });

        it('POST /api/auth/login should return 404 error if mobile number is not registered and no name provided', async () => {
            const res = await fetch(`${serverUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: '9990001112' })
            });

            assert.strictEqual(res.status, 404);
            const data = await res.json();
            assert.strictEqual(data.success, false);
            assert.ok(data.error.includes('not registered'));
        });

        it('POST /api/upload should save base64 image and return imageUrl', async () => {
            const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            const res = await fetch(`${serverUrl}/api/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: sampleBase64 })
            });

            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.success, true);
            assert.ok(data.imageUrl.startsWith('/uploads/'));
        });
    });

    describe('Socket.IO Direct Messaging & Presence', () => {
        it('should authenticate socket, search active users, and exchange direct messages and images', (t, done) => {
            // First create 2 registered users
            fetch(`${serverUrl}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'SenderUser', phoneNumber: '1112223334' })
            })
                .then((r) => r.json())
                .then(({ user: u1 }) => {
                    return fetch(`${serverUrl}/api/auth/signup`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: 'ReceiverUser', phoneNumber: '5556667778' })
                    })
                        .then((r) => r.json())
                        .then(({ user: u2 }) => {
                            const client1 = ioClient(serverUrl);
                            const client2 = ioClient(serverUrl);

                            // Authenticate client 1
                            client1.emit('auth', { userId: u1.id, name: u1.name, phoneNumber: u1.phoneNumber }, (ack1) => {
                                assert.strictEqual(ack1.success, true);

                                // Authenticate client 2
                                client2.emit('auth', { userId: u2.id, name: u2.name, phoneNumber: u2.phoneNumber }, (ack2) => {
                                    assert.strictEqual(ack2.success, true);

                                    // Search active users
                                    client1.emit('searchUsers', { query: '', activeOnly: true }, ({ users }) => {
                                        assert.strictEqual(users.length, 1);
                                        assert.strictEqual(users[0].id, u2.id);
                                        assert.strictEqual(users[0].isOnline, true);

                                        // Set up recipient listener for direct message
                                        client2.on('receiveDirectMessage', (dm) => {
                                            assert.strictEqual(dm.fromUserId, u1.id);
                                            assert.strictEqual(dm.toUserId, u2.id);

                                            if (dm.text === 'Hey, 1-on-1 direct message!') {
                                                // Test image message
                                                client1.emit('sendDirectMessage', {
                                                    toUserId: u2.id,
                                                    imageUrl: '/uploads/photo.png'
                                                }, (imgAck) => {
                                                    assert.strictEqual(imgAck.success, true);
                                                });
                                            } else if (dm.imageUrl === '/uploads/photo.png') {
                                                // Both messages received!
                                                client1.disconnect();
                                                client2.disconnect();
                                                done();
                                            }
                                        });

                                        // Send text direct message
                                        client1.emit('sendDirectMessage', {
                                            toUserId: u2.id,
                                            text: 'Hey, 1-on-1 direct message!'
                                        }, (sendAck) => {
                                            assert.strictEqual(sendAck.success, true);
                                            assert.strictEqual(sendAck.delivered, true);
                                        });
                                    });
                                });
                            });
                        });
                })
                .catch(done);
        });
    });
});
