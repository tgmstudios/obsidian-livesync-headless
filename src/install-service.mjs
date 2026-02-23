#!/usr/bin/env node
// Install systemd service

import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

async function main() {
    console.log('🔧 Installing Obsidian LiveSync Headless as systemd service...\n');

    const serviceName = 'obsidian-sync';
    const user = os.userInfo().username;
    const syncScript = path.join(projectRoot, 'src', 'sync.mjs');
    
    // Create service file
    const serviceContent = `[Unit]
Description=Obsidian LiveSync Headless Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${user}
WorkingDirectory=${projectRoot}
ExecStart=/usr/bin/node ${syncScript} --daemon
Restart=on-failure
RestartSec=30
StandardOutput=journal
StandardError=journal

# Environment
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
`;

    const serviceFile = `/etc/systemd/system/${serviceName}.service`;

    try {
        // Write service file
        await fs.writeFile('/tmp/obsidian-sync.service', serviceContent);
        console.log('✓ Service file created');

        // Copy to systemd
        await execAsync(`sudo cp /tmp/obsidian-sync.service ${serviceFile}`);
        console.log(`✓ Service file installed: ${serviceFile}`);

        // Reload systemd
        await execAsync('sudo systemctl daemon-reload');
        console.log('✓ Systemd reloaded');

        // Enable service
        await execAsync(`sudo systemctl enable ${serviceName}`);
        console.log(`✓ Service enabled (auto-start on boot)`);

        console.log(`\\n✅ Service installed successfully!`);
        console.log(`\\n📝 Next steps:`);
        console.log(`   Start service:   sudo systemctl start ${serviceName}`);
        console.log(`   Check status:    systemctl status ${serviceName}`);
        console.log(`   View logs:       journalctl -u ${serviceName} -f`);
        console.log(`   Stop service:    sudo systemctl stop ${serviceName}`);

    } catch (e) {
        console.error('❌ Installation failed:', e.message);
        console.error('\\nMake sure you have sudo permissions.');
        process.exit(1);
    }
}

main();
