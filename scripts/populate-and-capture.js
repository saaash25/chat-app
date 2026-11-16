const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ioClient = require('socket.io-client');
const { server, io } = require('../src/index');

const execAsync = promisify(exec);
const PORT = 3889;
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
    console.log(`Server listening on ${PORT}`);

    try {
        // 1. Capture Join Page
        await captureUrl(`${BASE_URL}/`, path.join(SCREENSHOT_DIR, 'join-page.png'), 1200, 800, 1000);

        // 2. Connect mock sockets Sarah and Alex
        const socket1 = ioClient(BASE_URL);
        const socket2 = ioClient(BASE_URL);

        await new Promise((res) => socket1.emit('join', { username: 'Sarah', room: 'General' }, res));
        await new Promise((res) => socket2.emit('join', { username: 'Alex', room: 'General' }, res));

        // When a new user joins, send responsive chat messages
        socket1.on('joinMessage', () => {
            setTimeout(() => {
                socket1.emit('sendMessage', 'Welcome to the team! The new UI looks fantastic 🚀', () => {});
            }, 200);
            setTimeout(() => {
                socket2.emit('sendLocation', 'https://google.com/maps?q=37.7749,-122.4194', () => {});
            }, 500);
            setTimeout(() => {
                socket1.emit('sendMessage', 'Meetup coordinates shared above. Real-time updates work seamlessly!', () => {});
            }, 800);
        });

        // 3. Capture Desktop Chat Room Screenshot with David joining and demo active
        await captureUrl(
            `${BASE_URL}/chat?username=David&room=General&demo=true`,
            path.join(SCREENSHOT_DIR, 'chat-room.png'),
            1280,
            820,
            4000
        );

        // 4. Capture Mobile Chat Room Screenshot
        await captureUrl(
            `${BASE_URL}/chat?username=David&room=General&demo=true`,
            path.join(SCREENSHOT_DIR, 'chat-mobile.png'),
            390,
            844,
            4000
        );

        socket1.disconnect();
        socket2.disconnect();
        console.log('All screenshots captured successfully!');
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
