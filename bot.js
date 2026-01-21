const WebSocket = require('ws');
const http = require('http');

// --- YOUR PERMANENT CONFIG ---
const TOKEN = "MTE1NjMwODgzODExMTI2MDY3Mg.G_Mjjo.c55JfdNhztpzR2Y1LsFH7XtDBcwaDhQUKOM09M";
const STATUS = "online"; // Change to 'idle' or 'dnd' if you want
const GAME_NAME = "Researching Molecular Theory";
// -----------------------------

function connect() {
    // Connect to Discord Gateway
    const ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');

    ws.on('open', () => {
        console.log("SUCCESS: Maverick Engine connected to Discord.");
    });

    ws.on('message', (data) => {
        const payload = JSON.parse(data);
        const { op, d } = payload;

        // OP 10: Hello - Received when first connecting
        if (op === 10) {
            // Start the Heartbeat (The "Ping" that keeps you online)
            setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ op: 1, d: null }));
                }
            }, d.heartbeat_interval);

            // Send Identity (The "Login" signal)
            ws.send(JSON.stringify({
                op: 2,
                d: {
                    token: TOKEN,
                    properties: { 
                        $os: 'linux', 
                        $browser: 'chrome', 
                        $device: 'pc' 
                    },
                    presence: {
                        status: STATUS,
                        activities: [{ 
                            name: GAME_NAME, 
                            type: 0 // 0 = Playing
                        }],
                        afk: false
                    }
                }
            }));
        }
    });

    // If connection drops, reconnect automatically
    ws.on('close', () => {
        console.log("Connection lost. Re-linking in 5 seconds...");
        setTimeout(connect, 5000);
    });

    ws.on('error', (err) => {
        console.error("Socket Error:", err.message);
    });
}

// Start the bot
connect();

// --- RENDER KEEP-ALIVE SERVER ---
// Render requires an active web port or it will shut down the script.
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('MAVERICK PERSISTENCE: ACTIVE');
});

// Use Render's port or default to 8080
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Keep-alive server active on port ${PORT}`);
});
