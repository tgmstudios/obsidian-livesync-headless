// Configuration loader with validation

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '..', 'config.json');

export async function loadConfig() {
    try {
        const data = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(data);
        
        // Validate required fields
        if (!config.vaultPath) throw new Error('vaultPath is required');
        if (!config.couchDB?.uri) throw new Error('couchDB.uri is required');
        if (!config.couchDB?.database) throw new Error('couchDB.database is required');
        if (!config.couchDB?.username) throw new Error('couchDB.username is required');
        if (!config.couchDB?.password) throw new Error('couchDB.password is required');
        
        // Set defaults
        if (typeof config.e2ee?.enabled !== 'boolean') {
            config.e2ee = { enabled: false, passphrase: '' };
        }
        if (!config.syncIntervalSeconds) {
            config.syncIntervalSeconds = 30;
        }
        
        return config;
    } catch (e) {
        if (e.code === 'ENOENT') {
            throw new Error('Config file not found. Run: npm run setup');
        }
        throw e;
    }
}

export function getAuthUrl(config) {
    const uri = config.couchDB.uri;
    const username = config.couchDB.username;
    const password = config.couchDB.password;
    const database = config.couchDB.database;
    
    return uri.replace('https://', `https://${username}:${password}@`) + `/${database}`;
}
