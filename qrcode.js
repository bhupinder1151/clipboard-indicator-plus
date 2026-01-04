import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

// Maximum text length that can fit in a QR code (conservative estimate for UTF-8)
export const MAX_QR_TEXT_LENGTH = 1500;

// Default port for the text server (using unique high port to avoid conflicts)
const DEFAULT_PORT = 47531;

/**
 * Simple HTTP server to serve clipboard text for QR code scanning
 * and receive text from phone
 */
export class TextServer {
    #server = null;
    #text = '';
    #port = DEFAULT_PORT;
    #onTextReceived = null;

    /**
     * Start serving the given text
     * @param {string} text - Text to serve (can be empty for receive-only mode)
     * @param {Function} onTextReceived - Callback when text is received from phone
     * @returns {string|null} - URL to access the text, or null on failure
     */
    start(text, onTextReceived = null) {
        if (this.#server) {
            this.stop();
        }

        this.#text = text || '';
        this.#onTextReceived = onTextReceived;
        this.#server = new Soup.Server();

        // Add handler for root path (GET - show page)
        this.#server.add_handler('/', (server, msg, path, query) => {
            const method = msg.get_method();

            if (method === 'POST') {
                // Handle POST - receive text from phone
                this.#handlePost(msg);
                return;
            }

            // GET - serve the HTML page
            this.#serveHtmlPage(msg);
        });

        // Try to find an available port
        for (let port = DEFAULT_PORT; port < DEFAULT_PORT + 20; port++) {
            try {
                this.#server.listen_all(port, Soup.ServerListenOptions.IPV4_ONLY);
                this.#port = port;
                break;
            } catch (e) {
                if (port === DEFAULT_PORT + 19) {
                    console.error('Failed to start server on any port');
                    return null;
                }
            }
        }

        const localIp = this.#getLocalIP();
        if (!localIp) {
            console.error('Could not determine local IP');
            this.stop();
            return null;
        }

        return `http://${localIp}:${this.#port}/`;
    }

    #handlePost(msg) {
        try {
            const body = msg.get_request_body();
            const bytes = body.flatten().get_data();
            const text = new TextDecoder().decode(bytes);

            // Parse URL-encoded form data
            const params = new URLSearchParams(text);
            const receivedText = params.get('text') || '';

            if (receivedText && this.#onTextReceived) {
                this.#onTextReceived(receivedText);
            }

            // Send success response
            const response = JSON.stringify({ success: true, message: 'Text received!' });
            msg.set_status(200, null);
            msg.get_response_headers().append('Content-Type', 'application/json');
            msg.get_response_body().append(response);
        } catch (e) {
            console.error('Error handling POST:', e);
            msg.set_status(500, null);
            msg.get_response_body().append(JSON.stringify({ success: false, error: e.message }));
        }
    }

    #serveHtmlPage(msg) {
        const titleStr = _('Clipboard Sync');
        const subtitleStr = _('Share clipboard between devices');
        const fromLaptopStr = _('From Laptop');
        const toLaptopStr = _('Send to Laptop');
        const copyTextStr = _('Copy Text');
        const copiedStr = _('Copied!');
        const sentStr = _('Sent!');
        const sendingStr = _('Sending...');
        const typeHereStr = _('Type or paste text here...');
        const sendBtnStr = _('Send to Laptop');
        const hintStr = _('Connected to same WiFi network');

        const hasText = this.#text && this.#text.length > 0;

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${titleStr}</title>
    <style>
        :root {
            --bg: #f5f5f7;
            --card-bg: #ffffff;
            --text: #1a1a1a;
            --text-secondary: #6b7280;
            --text-tertiary: #9ca3af;
            --textarea-bg: #f9fafb;
            --primary: #2563eb;
            --primary-hover: #1d4ed8;
            --success: #22c55e;
            --shadow: 0 1px 3px rgba(0,0,0,0.08);
            --radius: 16px;
            --radius-sm: 8px;
            --radius-btn: 10px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 24px 16px;
            background: var(--bg);
            min-height: 100vh;
        }
        .header { margin-bottom: 20px; }
        .header h1 { font-size: 28px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
        .header p { font-size: 15px; color: var(--text-secondary); }
        .card { background: var(--card-bg); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow); margin-bottom: 16px; }
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .card-title { font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
        .badge { background: var(--success); color: white; font-size: 12px; font-weight: 500; padding: 4px 10px; border-radius: 6px; }
        .textarea {
            width: 100%;
            min-height: 120px;
            border: none;
            background: var(--textarea-bg);
            font-size: 16px;
            line-height: 1.6;
            color: #374151;
            resize: none;
            outline: none;
            font-family: inherit;
            padding: 12px;
            border-radius: var(--radius-sm);
        }
        .textarea:read-only { color: #6b7280; }
        .btn-container { display: flex; justify-content: flex-end; margin-top: 16px; }
        .btn {
            background: var(--primary);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: var(--radius-btn);
            cursor: pointer;
            font-size: 15px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: background 0.2s, transform 0.1s;
        }
        .btn:hover { background: var(--primary-hover); }
        .btn:active { transform: scale(0.98); }
        .btn.success { background: var(--success); }
        .btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .btn svg { width: 18px; height: 18px; }
        .hint { font-size: 12px; color: var(--text-tertiary); margin-top: 16px; text-align: center; }
        .status { padding: 12px; border-radius: var(--radius-sm); margin-top: 12px; text-align: center; display: none; }
        .status.success { background: #dcfce7; color: #166534; display: block; }
        .status.error { background: #fee2e2; color: #991b1b; display: block; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${titleStr}</h1>
        <p>${subtitleStr}</p>
    </div>
    
    ${hasText ? `
    <div class="card">
        <div class="card-header">
            <span class="card-title">${fromLaptopStr}</span>
            <span class="badge">📥</span>
        </div>
        <textarea class="textarea" id="laptopText" readonly>${this.#escapeHtml(this.#text)}</textarea>
        <div class="btn-container">
            <button class="btn" id="copyBtn">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
                ${copyTextStr}
            </button>
        </div>
    </div>
    ` : ''}
    
    <div class="card">
        <div class="card-header">
            <span class="card-title">${toLaptopStr}</span>
            <span class="badge">📤</span>
        </div>
        <textarea class="textarea" id="phoneText" placeholder="${typeHereStr}"></textarea>
        <div id="status" class="status"></div>
        <div class="btn-container">
            <button class="btn" id="sendBtn">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
                ${sendBtnStr}
            </button>
        </div>
    </div>
    
    <p class="hint">✓ ${hintStr}</p>
    
    <script>
        const copyBtn = document.getElementById('copyBtn');
        const sendBtn = document.getElementById('sendBtn');
        const laptopText = document.getElementById('laptopText');
        const phoneText = document.getElementById('phoneText');
        const status = document.getElementById('status');
        
        const icons = {
            copy: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>',
            check: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
            send: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>'
        };
        
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                laptopText.select();
                laptopText.setSelectionRange(0, 99999);
                try {
                    await navigator.clipboard.writeText(laptopText.value);
                } catch { document.execCommand('copy'); }
                copyBtn.innerHTML = icons.check + ' ${copiedStr}';
                copyBtn.classList.add('success');
                setTimeout(() => {
                    copyBtn.innerHTML = icons.copy + ' ${copyTextStr}';
                    copyBtn.classList.remove('success');
                }, 2000);
            });
        }
        
        sendBtn.addEventListener('click', async () => {
            const text = phoneText.value.trim();
            if (!text) return;
            
            sendBtn.disabled = true;
            sendBtn.innerHTML = icons.send + ' ${sendingStr}';
            status.className = 'status';
            status.textContent = '';
            
            try {
                const response = await fetch(window.location.href, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: 'text=' + encodeURIComponent(text)
                });
                const result = await response.json();
                if (result.success) {
                    status.className = 'status success';
                    status.textContent = '${sentStr}';
                    sendBtn.innerHTML = icons.check + ' ${sentStr}';
                    sendBtn.classList.add('success');
                    phoneText.value = '';
                    setTimeout(() => {
                        sendBtn.innerHTML = icons.send + ' ${sendBtnStr}';
                        sendBtn.classList.remove('success');
                        sendBtn.disabled = false;
                    }, 2000);
                } else {
                    throw new Error(result.error || 'Failed');
                }
            } catch (e) {
                status.className = 'status error';
                status.textContent = 'Error: ' + e.message;
                sendBtn.innerHTML = icons.send + ' ${sendBtnStr}';
                sendBtn.disabled = false;
            }
        });
    </script>
</body>
</html>`;

        msg.set_status(200, null);
        msg.get_response_headers().append('Content-Type', 'text/html; charset=utf-8');
        msg.get_response_body().append(html);
    }

    /**
     * Stop the server
     */
    stop() {
        if (this.#server) {
            this.#server.disconnect();
            this.#server = null;
        }
        this.#onTextReceived = null;
    }

    /**
     * Check if server is running
     */
    isRunning() {
        return this.#server !== null;
    }

    #escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    #getLocalIP() {
        try {
            // Get local IP using hostname command
            const [success, stdout, stderr, exitStatus] = GLib.spawn_command_line_sync('hostname -I');

            if (success && exitStatus === 0) {
                const output = new TextDecoder().decode(stdout).trim();
                // hostname -I returns space-separated IPs, take the first one
                const ips = output.split(/\s+/);
                // Find first valid IPv4 address
                for (const ip of ips) {
                    if (ip && ip.match(/^\d+\.\d+\.\d+\.\d+$/)) {
                        return ip;
                    }
                }
            }

            console.error('hostname -I failed or returned no IPs');
            return null;
        } catch (e) {
            console.error('Failed to get local IP:', e);
            return null;
        }
    }
}

/**
 * Check if text is too large for QR code
 * @param {string} text
 * @returns {boolean}
 */
export function isTextTooLargeForQR(text) {
    return text.length > MAX_QR_TEXT_LENGTH;
}

/**
 * Generate a QR code from text using qrencode CLI tool
 * @param {string} text - The text to encode
 * @param {string} outputDir - Directory to save the QR code
 * @returns {Promise<string|null>} - Path to generated QR image or null on failure
 */
export async function generateQRCode(text, outputDir) {
    return new Promise((resolve, reject) => {
        // Create output directory if it doesn't exist
        GLib.mkdir_with_parents(outputDir, parseInt('0775', 8));

        // Generate unique filename based on text hash
        const hash = GLib.compute_checksum_for_string(GLib.ChecksumType.MD5, text, -1);
        const filename = `qr_${hash}.png`;
        const outputPath = `${outputDir}/${filename}`;

        // Check if QR already exists
        if (GLib.file_test(outputPath, GLib.FileTest.EXISTS)) {
            resolve(outputPath);
            return;
        }

        // Build qrencode command
        // -o: output file, -s: size of each module, -m: margin
        const argv = ['qrencode', '-o', outputPath, '-s', '8', '-m', '2', text];

        try {
            const [success, pid] = GLib.spawn_async(
                null, // working directory
                argv,
                null, // env
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                null  // child setup
            );

            if (!success) {
                reject(new Error('Failed to spawn qrencode process'));
                return;
            }

            // Wait for process to complete
            GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, (pid, status) => {
                GLib.spawn_close_pid(pid);

                if (status === 0) {
                    resolve(outputPath);
                } else {
                    reject(new Error(`qrencode exited with status ${status}`));
                }
            });
        } catch (e) {
            reject(new Error(`Failed to run qrencode: ${e.message}. Is qrencode installed?`));
        }
    });
}

/**
 * Check if qrencode is available on the system
 * @returns {boolean}
 */
export function isQREncodeAvailable() {
    try {
        const [success] = GLib.spawn_command_line_sync('which qrencode');
        return success;
    } catch (e) {
        return false;
    }
}

/**
 * Delete a QR code file
 * @param {string} filePath - Path to the QR code file
 */
export async function deleteQRCode(filePath) {
    try {
        const file = Gio.file_new_for_path(filePath);
        await file.delete_async(GLib.PRIORITY_DEFAULT, null);
    } catch (e) {
        console.error('Failed to delete QR code:', e);
    }
}
