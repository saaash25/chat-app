const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ioClient = require('socket.io-client');
const { server, io } = require('../src/index');
const { resetDB, registerUser } = require('../utils/db');
const { resetUsers } = require('../utils/user');

const execAsync = promisify(exec);
const PORT = 3998;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = path.join(__dirname, '../public/images/screenshots');

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function captureUrl(url, outFile, width = 1200, height = 800, virtualTime = 3000) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-user-'));
    try {
        const cmd = `google-chrome --headless=new --disable-gpu --no-sandbox --hide-scrollbars --user-data-dir="${tmpDir}" --window-size=${width},${height} --virtual-time-budget=${virtualTime} --screenshot="${outFile}" "${url}"`;
        await execAsync(cmd);
        console.log(`Captured: ${path.basename(outFile)}`);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

server.listen(PORT, async () => {
    console.log(`Server listening on ${PORT} for screenshot generation...`);

    try {
        resetDB();
        resetUsers();

        // 1. Capture Sign Up / Login Landing Page
        await captureUrl(`${BASE_URL}/`, path.join(SCREENSHOT_DIR, 'join-page.png'), 1200, 800, 1000);

        // 2. Pre-register mock users
        const { user: userAlice } = registerUser({ name: 'Alice Smith', phoneNumber: '+1 234 567 8901' });
        const { user: userBob } = registerUser({ name: 'Bob Jones', phoneNumber: '+1 234 567 8902' });
        const { user: userCharlie } = registerUser({ name: 'Charlie Brown', phoneNumber: '+1 234 567 8903' });

        // Connect mock socket for Alice and keep her online
        const socketAlice = ioClient(BASE_URL);
        const socketBob = ioClient(BASE_URL);

        await new Promise((res) => socketAlice.emit('auth', { userId: userAlice.id, ...userAlice }, res));
        await new Promise((res) => socketBob.emit('auth', { userId: userBob.id, ...userBob }, res));

        // Create sample photo
        const uploadDir = path.join(__dirname, '../public/uploads');
        fs.mkdirSync(uploadDir, { recursive: true });
        const sampleImageFile = path.join(uploadDir, 'demo-preview.png');

        // Simple valid PNG data
        const pngHex =
            '89504e470d0a1a0a0000000d4948445200000064000000400802000000' +
            '70e01d1c0000004749444154789cedcd310d0020080441d6fd5ff60e0a' +
            'c8aa18485c2d385a4a58402130e463a562ca61937667425b0303030303' +
            '03030303030303030303030303030303030303e301d00c3b3f27fbb12c' +
            '0000000049454e44ae426082';
        fs.writeFileSync(sampleImageFile, Buffer.from(pngHex, 'hex'));

        // Alice sends direct message to Bob with text and an image
        const send1 = await new Promise((res) => {
            socketAlice.emit('sendDirectMessage', {
                toUserId: userBob.id,
                text: 'Hey Bob! Here is the project snapshot 📸',
                imageUrl: '/uploads/demo-preview.png'
            }, res);
        });
        console.log('Alice sent DM:', send1);

        const send2 = await new Promise((res) => {
            socketBob.emit('sendDirectMessage', {
                toUserId: userAlice.id,
                text: 'Received! The direct image transfer and instant messaging are working great.'
            }, res);
        });
        console.log('Bob replied DM:', send2);

        // Disconnect temporary socketBob before opening Bob's browser session
        socketBob.disconnect();

        // 3. Capture Welcoming Screen (when no conversation/room is selected)
        await captureUrl(
            `${BASE_URL}/chat?userId=${userBob.id}&username=${encodeURIComponent(userBob.name)}&phone=${encodeURIComponent(userBob.phoneNumber)}`,
            path.join(SCREENSHOT_DIR, 'welcoming-screen.png'),
            1280,
            820,
            2500
        );

        // 4. Capture Direct Messages View with 1-on-1 chat open
        await captureUrl(
            `${BASE_URL}/chat?userId=${userBob.id}&username=${encodeURIComponent(userBob.name)}&phone=${encodeURIComponent(userBob.phoneNumber)}&directWith=${userAlice.id}`,
            path.join(SCREENSHOT_DIR, 'chat-direct.png'),
            1280,
            820,
            3500
        );

        // 5. Capture Mobile View
        await captureUrl(
            `${BASE_URL}/chat?userId=${userBob.id}&username=${encodeURIComponent(userBob.name)}&phone=${encodeURIComponent(userBob.phoneNumber)}&directWith=${userAlice.id}`,
            path.join(SCREENSHOT_DIR, 'chat-mobile.png'),
            390,
            844,
            3500
        );

        // 6. Capture Chat Rooms View
        await captureUrl(
            `${BASE_URL}/chat?userId=${userBob.id}&username=${encodeURIComponent(userBob.name)}&phone=${encodeURIComponent(userBob.phoneNumber)}&room=General`,
            path.join(SCREENSHOT_DIR, 'chat-room.png'),
            1280,
            820,
            3500
        );

        socketAlice.disconnect();
        console.log('All updated screenshots captured successfully!');
    } catch (err) {
        console.error('Capture error:', err);
    } finally {
        io.close(() => {
            server.close(() => {
                process.exit(0);
            });
        });
    }
});
