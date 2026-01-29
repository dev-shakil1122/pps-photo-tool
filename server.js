const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const config = require('./config');

const PORT = 3000;

// --- MIMETYPES for Static Files ---
const MIMETYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// --- SESSION STORAGE ---
const activeSessions = {};
const generateToken = () => Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

// --- HELPER: Read Body JSON ---
const readBody = (req) => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                resolve({});
            }
        });
        req.on('error', reject);
    });
};

// --- HELPER: Fetch CSV (Follows Redirects) ---
const fetchCSV = (url) => {
    return new Promise((resolve, reject) => {
        const get = (link) => {
            if (!link || !link.startsWith('http')) return reject('Invalid URL');
            https.get(link, (resp) => {
                if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
                    return get(resp.headers.location);
                }
                let data = '';
                resp.on('data', c => data += c);
                resp.on('end', () => resolve(data));
            }).on('error', reject);
        };
        get(url);
    });
};

// --- HELPER: Parse CSV ---
const parseUsers = (csvText) => {
    const users = [];
    const lines = csvText.split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length >= 2) {
            users.push({ username: parts[0].trim(), password: parts[1].trim() });
        }
    }
    return users;
};

// --- SERVER ---
const server = http.createServer(async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = req.url.split('?')[0];

    // --- API: LOGIN ---
    if (url === '/api/login' && req.method === 'POST') {
        try {
            const body = await readBody(req);
            const { userId, password } = body;

            if (!userId || !password) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Missing Credentials' }));
            }

            const csvData = await fetchCSV(config.GOOGLE_SHEET_CSV_URL);
            const users = parseUsers(csvData);
            const user = users.find(u => u.username === userId && u.password === password);

            if (user) {
                const token = generateToken();
                activeSessions[userId] = token;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, token, userId }));
            } else {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid Credentials' }));
            }
        } catch (e) {
            console.error(e);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Server Error' }));
        }
        return;
    }

    // --- API: VERIFY ---
    if (url === '/api/verify-session' && req.method === 'POST') {
        const body = await readBody(req);
        const { userId, token } = body;
        const isValid = activeSessions[userId] === token;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: isValid }));
        return;
    }

    // --- API: GENERATE ---
    if (url === '/api/generate-image' && req.method === 'POST') {
        try {
            const body = await readBody(req);
            const { prompt, image_url } = body;

            const falReq = https.request('https://fal.run/fal-ai/nano-banana/edit', {
                method: 'POST',
                headers: {
                    'Authorization': `Key ${config.FAL_KEY}`,
                    'Content-Type': 'application/json'
                }
            }, (falRes) => {
                let data = '';
                falRes.on('data', c => data += c);
                falRes.on('end', () => {
                    res.writeHead(falRes.statusCode, { 'Content-Type': 'application/json' });
                    res.end(data);
                });
            });
            falReq.write(JSON.stringify({
                prompt, image_urls: [image_url], num_images: 1, output_format: 'png'
            }));
            falReq.end();

        } catch (e) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // --- STATIC FILES ---
    let filePath = path.join(__dirname, url === '/' ? 'index.html' : url);
    const ext = path.extname(filePath);
    const contentType = MIMETYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 Not Found');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + err.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Native Server running at http://localhost:${PORT}`);
});
