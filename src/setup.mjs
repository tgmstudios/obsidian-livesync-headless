#!/usr/bin/env node
// Interactive setup wizard for Obsidian LiveSync Headless

import readline from 'readline';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '..', 'config.json');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise(resolve => rl.question(prompt, resolve));
}

async function main() {
    console.log('\n🚀 Obsidian LiveSync Headless - Setup Wizard\n');
    console.log('This wizard will help you configure sync for your Obsidian vault.\n');

    // Vault path
    const vaultPath = await question('📁 Vault path (e.g., /home/user/obsidian/vault): ');
    if (!vaultPath) {
        console.error('❌ Vault path is required');
        rl.close();
        process.exit(1);
    }

    // CouchDB URI
    const couchURI = await question('🌐 CouchDB URL (e.g., https://obsidian.example.com): ');
    if (!couchURI) {
        console.error('❌ CouchDB URL is required');
        rl.close();
        process.exit(1);
    }

    // Database name
    const dbName = await question('📦 Database name (e.g., obsidian-vault): ');
    if (!dbName) {
        console.error('❌ Database name is required');
        rl.close();
        process.exit(1);
    }

    // Username
    const username = await question('👤 CouchDB username: ');
    if (!username) {
        console.error('❌ Username is required');
        rl.close();
        process.exit(1);
    }

    // Password
    const password = await question('🔑 CouchDB password: ');
    if (!password) {
        console.error('❌ Password is required');
        rl.close();
        process.exit(1);
    }

    // E2EE
    const e2eeEnabled = await question('🔒 Enable end-to-end encryption (E2EE)? (yes/no): ');
    const useE2EE = e2eeEnabled.toLowerCase().startsWith('y');

    let passphrase = '';
    if (useE2EE) {
        passphrase = await question('🔐 E2EE passphrase: ');
        if (!passphrase) {
            console.error('❌ Passphrase is required when E2EE is enabled');
            rl.close();
            process.exit(1);
        }
    }

    // Sync interval
    const intervalInput = await question('⏱️  Sync interval in seconds (default: 30): ');
    const syncInterval = parseInt(intervalInput) || 30;

    // Build config
    const config = {
        vaultPath: path.resolve(vaultPath),
        couchDB: {
            uri: couchURI,
            database: dbName,
            username: username,
            password: password
        },
        e2ee: {
            enabled: useE2EE,
            passphrase: passphrase
        },
        syncIntervalSeconds: syncInterval
    };

    // Save config
    try {
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        await fs.chmod(configPath, 0o600); // Make config file private
        console.log('\\n✅ Configuration saved to:', configPath);
        console.log('\\n📝 Next steps:');
        console.log('   1. Run sync: npm start');
        console.log('   2. Install service: npm run install-service');
        console.log('\\n⚠️  Security: Keep config.json private (chmod 600 already applied)');
    } catch (e) {
        console.error('❌ Failed to save config:', e.message);
        rl.close();
        process.exit(1);
    }

    rl.close();
}

main().catch(err => {
    console.error('Setup failed:', err);
    rl.close();
    process.exit(1);
});
