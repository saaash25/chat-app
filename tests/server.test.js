const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const ioClient = require('socket.io-client');
const { server, io } = require('../src/index');
const { resetUsers } = require('../utils/user');

describe('Server & Socket.IO Integration Tests', () => {
    let port;
    let serverUrl;

    before((_, done) => {
        // Start server on an ephemeral port
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
        resetUsers();
    });

    describe('HTTP Endpoints', () => {
        it('GET / should return 200 OK with join page HTML', async () => {
            const res = await fetch(`${serverUrl}/`);
            assert.strictEqual(res.status, 200);
            const html = await res.text();
            assert.ok(html.includes('Join Chat'));
            assert.ok(html.includes('room-options'));
        });

        it('GET /chat should return 200 OK with chat room HTML', async () => {
            const res = await fetch(`${serverUrl}/chat`);
            assert.strictEqual(res.status, 200);
            const html = await res.text();
            assert.ok(html.includes('Active Users'));
            assert.ok(html.includes('id="messageForm"'));
        });

        it('GET /assets/bootstrap/bootstrap.min.css should return 200 OK', async () => {
            const res = await fetch(`${serverUrl}/assets/bootstrap/bootstrap.min.css`);
            assert.strictEqual(res.status, 200);
        });
    });

    describe('Socket.IO Events', () => {
        it('should allow user to join a room and receive welcome and roomData', (t, done) => {
            const client = ioClient(serverUrl);
            let welcomed = false;

            client.on('welcome', (data) => {
                assert.strictEqual(data.text, 'Welcome!');
                assert.strictEqual(data.username, 'Admin');
                assert.strictEqual(data.chatboxHead, 'alice');
                assert.strictEqual(data.room, 'cricket');
                welcomed = true;
            });

            client.on('roomData', ({ usersList }) => {
                assert.strictEqual(usersList.length, 1);
                assert.strictEqual(usersList[0].username, 'alice');
                assert.strictEqual(welcomed, true);
                client.disconnect();
                done();
            });

            client.emit('join', { username: 'Alice', room: 'Cricket' }, (error) => {
                assert.strictEqual(error, undefined);
            });
        });

        it('should return error when joining without username or room', (t, done) => {
            const client = ioClient(serverUrl);

            client.emit('join', {}, (error) => {
                assert.strictEqual(error, 'username and room required!');
                client.disconnect();
                done();
            });
        });

        it('should reject duplicate username in the same room', (t, done) => {
            const client1 = ioClient(serverUrl);
            const client2 = ioClient(serverUrl);

            client1.emit('join', { username: 'Bob', room: 'Football' }, (err1) => {
                assert.strictEqual(err1, undefined);

                client2.emit('join', { username: 'bob', room: 'football' }, (err2) => {
                    assert.strictEqual(err2, 'user already exist in this room!');
                    client1.disconnect();
                    client2.disconnect();
                    done();
                });
            });
        });

        it('should broadcast message to other users in room', (t, done) => {
            const client1 = ioClient(serverUrl);
            const client2 = ioClient(serverUrl);

            client1.emit('join', { username: 'User1', room: 'General' }, () => {
                client2.emit('join', { username: 'User2', room: 'General' }, () => {
                    client2.on('receiveMessage', (msg) => {
                        assert.strictEqual(msg.text, 'Hello everyone!');
                        assert.strictEqual(msg.username, 'user1');
                        client1.disconnect();
                        client2.disconnect();
                        done();
                    });

                    client1.emit('sendMessage', 'Hello everyone!', (ack) => {
                        assert.strictEqual(ack.message, 'message delivered!!');
                    });
                });
            });
        });

        it('should return error when sending empty message', (t, done) => {
            const client = ioClient(serverUrl);

            client.emit('join', { username: 'Tester', room: 'General' }, () => {
                client.emit('sendMessage', '   ', (res) => {
                    assert.strictEqual(res.error, 'Message cannot be empty!');
                    client.disconnect();
                    done();
                });
            });
        });

        it('should broadcast location to other users in room', (t, done) => {
            const client1 = ioClient(serverUrl);
            const client2 = ioClient(serverUrl);
            const testLocation = 'https://google.com/maps?q=12.9716,77.5946';

            client1.emit('join', { username: 'LocUser1', room: 'Travel' }, () => {
                client2.emit('join', { username: 'LocUser2', room: 'Travel' }, () => {
                    client2.on('receiveLocation', (loc) => {
                        assert.strictEqual(loc.text, testLocation);
                        assert.strictEqual(loc.username, 'locuser1');
                        client1.disconnect();
                        client2.disconnect();
                        done();
                    });

                    client1.emit('sendLocation', testLocation, (ack) => {
                        assert.strictEqual(ack.message, 'location shared!!');
                    });
                });
            });
        });

        it('should notify remaining users when a user disconnects', (t, done) => {
            const client1 = ioClient(serverUrl);
            const client2 = ioClient(serverUrl);

            client1.emit('join', { username: 'Stayer', room: 'RoomX' }, () => {
                client2.emit('join', { username: 'Leaver', room: 'RoomX' }, () => {
                    client1.on('disconnectMessage', (msg) => {
                        assert.strictEqual(msg.text, 'leaver has left!');
                        assert.strictEqual(msg.username, 'Admin');
                        client1.disconnect();
                        done();
                    });

                    // Leaver disconnects
                    client2.disconnect();
                });
            });
        });
    });
});
