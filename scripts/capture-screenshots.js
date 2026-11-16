const { execSync } = require('child_process');
const { server, io } = require('../src/index');
const ioClient = require('socket.io-client');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = 3555;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = path.join(__dirname, '../public/images/screenshots');

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const capture = (url, outFile, width = 1200, height = 800) => {
    const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-ss-'));
    try {
        execSync(
            `google-chrome --headless=new --disable-gpu --no-sandbox --hide-scrollbars --user-data-dir="${tmpProfile}" --window-size=${width},${height} --screenshot="${outFile}" "${url}"`,
            { timeout: 15000, stdio: 'inherit' }
        );
    } finally {
        fs.rmSync(tmpProfile, { recursive: true, force: true });
    }
};

server.listen(PORT, async () => {
    console.log(`Server started on ${BASE_URL} for screenshot capture...`);

    try {
        // 1. Capture Join Page Screenshot
        const joinImg = path.join(SCREENSHOT_DIR, 'join-page.png');
        console.log('Capturing join-page.png...');
        capture(`${BASE_URL}/`, joinImg, 1200, 800);
        console.log(`Saved: ${joinImg}`);

        // 2. Setup mock users and messages in #General room
        const client1 = ioClient(BASE_URL);
        const client2 = ioClient(BASE_URL);

        await new Promise((resolve) => client1.emit('join', { username: 'Alice', room: 'General' }, resolve));
        await new Promise((resolve) => client2.emit('join', { username: 'Bob', room: 'General' }, resolve));

        await new Promise((resolve) => client1.emit('sendMessage', 'Hey team! Welcome to the new PulseChat room 👋', resolve));
        await new Promise((resolve) => client2.emit('sendMessage', 'The new UI looks so clean and modern! Love the design standards.', resolve));
        await new Promise((resolve) => client1.emit('sendLocation', 'https://google.com/maps?q=37.7749,-122.4194', resolve));
        await new Promise((resolve) => client2.emit('sendMessage', 'Awesome, maps integration works smoothly!', resolve));

        // Allow DOM/Socket events to settle
        await new Promise((r) => setTimeout(r, 1000));

        // 3. Capture Desktop Chat Room Screenshot
        const chatImg = path.join(SCREENSHOT_DIR, 'chat-room.png');
        console.log('Capturing chat-room.png...');
        capture(`${BASE_URL}/chat?username=Charlie&room=General`, chatImg, 1280, 820);
        console.log(`Saved: ${chatImg}`);

        // 4. Capture Mobile Chat Room Screenshot
        const mobileImg = path.join(SCREENSHOT_DIR, 'chat-mobile.png');
        console.log('Capturing chat-mobile.png...');
        capture(`${BASE_URL}/chat?username=Charlie&room=General`, mobileImg, 390, 844);
        console.log(`Saved: ${mobileImg}`);

        client1.disconnect();
        client2.disconnect();
    } catch (err) {
        console.error('Error during capture:', err);
    } finally {
        io.close(() => {
            server.close(() => {
                console.log('Server closed. All screenshots captured successfully.');
                process.exit(0);
            });
        });
    }
});
