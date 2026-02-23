#!/usr/bin/env node
// Obsidian LiveSync Headless Sync - TRUE LIVESYNC COMPATIBLE VERSION
// Based on reverse engineering the actual LiveSync plugin

import PouchDB from 'pouchdb';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load settings
const settingsPath = path.join(__dirname, 'settings.json');
let settings;
try {
    settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
    console.log('✓ Settings loaded');
} catch (e) {
    console.error('Failed to load settings:', e.message);
    process.exit(1);
}

// Configuration
const VAULT_PATH = path.resolve(process.env.HOME, 'obsidian/school/spring-2026');
const E2EE_ENABLED = false; // Set to true if you enable E2EE in LiveSync
const E2EE_PASSPHRASE = 'password'; // Only used if E2EE_ENABLED is true
const SYNC_INTERVAL_MS = 30 * 1000; // 30 seconds
const BATCH_SIZE = 500;

// Check for pull-only mode (file-based flag or env variable)
import { existsSync } from 'fs';
const PULL_ONLY_FLAG_PATH = path.join(__dirname, '.pull-only');
const PULL_ONLY = existsSync(PULL_ONLY_FLAG_PATH) || process.env.PULL_ONLY === 'true';

if (PULL_ONLY) {
    console.log('⚠️  PULL-ONLY MODE ENABLED - Uploads disabled');
}

// CouchDB connection
const COUCH_URI = settings.couchDB_URI;
const COUCH_USER = settings.couchDB_USER;
const COUCH_PASS = settings.couchDB_PASSWORD;
const COUCH_DB = settings.couchDB_DBNAME;

const remoteUrl = `${COUCH_URI}/${COUCH_DB}`;
const authUrl = COUCH_URI.replace('https://', `https://${COUCH_USER}:${COUCH_PASS}@`) + `/${COUCH_DB}`;

// Crypto constants
const webcrypto = globalThis.crypto;
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 310000;
const HKDF_SALT_LENGTH = 32;
const PBKDF2_SALT_LENGTH = 32;
const gcmTagLength = 128;
const HKDF_SALTED_ENCRYPTED_PREFIX = "%$";

// Entry types
const EntryTypes = {
    NOTE_PLAIN: "plain",
    NOTE_BINARY: "newnote",
    CHUNK: "leaf",
};

// State management
const stateFile = path.join(__dirname, 'sync-state.json');
let syncState = { lastSeq: null, localFiles: {} };

async function loadState() {
    try {
        const data = await fs.readFile(stateFile, 'utf8');
        syncState = JSON.parse(data);
        if (!syncState.localFiles) syncState.localFiles = {};
    } catch (e) {
        syncState = { lastSeq: null, localFiles: {} };
    }
}

async function saveState() {
    await fs.writeFile(stateFile, JSON.stringify(syncState, null, 2));
}

// Crypto functions
function base64ToArrayBuffer(base64) {
    return new Uint8Array(Buffer.from(base64, 'base64'));
}

function arrayBufferToBase64(buffer) {
    return Buffer.from(buffer).toString('base64');
}

function writeString(str) {
    return new TextEncoder().encode(str);
}

function readString(arr) {
    return new TextDecoder().decode(arr);
}

const keyCache = new Map();

async function deriveMasterKey(passphrase, pbkdf2Salt) {
    const cacheKey = passphrase + '-' + Buffer.from(pbkdf2Salt).toString('hex');
    if (keyCache.has(cacheKey)) {
        return keyCache.get(cacheKey);
    }
    
    const binaryPassphrase = writeString(passphrase);
    const keyMaterial = await webcrypto.subtle.importKey(
        "raw", binaryPassphrase, { name: "PBKDF2" }, false, ["deriveKey"]
    );
    
    const masterKeyRaw = await webcrypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: pbkdf2Salt,
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    
    const masterKeyBuffer = await webcrypto.subtle.exportKey("raw", masterKeyRaw);
    const hkdfKey = await webcrypto.subtle.importKey(
        "raw", masterKeyBuffer, { name: "HKDF" }, false, ["deriveKey"]
    );
    
    keyCache.set(cacheKey, hkdfKey);
    return hkdfKey;
}

async function deriveKey(passphrase, pbkdf2Salt, hkdfSalt) {
    const masterKey = await deriveMasterKey(passphrase, pbkdf2Salt);
    return await webcrypto.subtle.deriveKey(
        {
            name: "HKDF",
            salt: hkdfSalt,
            info: new Uint8Array(),
            hash: "SHA-256",
        },
        masterKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

async function encryptWithEphemeralSalt(input, passphrase) {
    const pbkdf2Salt = webcrypto.getRandomValues(new Uint8Array(PBKDF2_SALT_LENGTH));
    const iv = webcrypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const hkdfSalt = webcrypto.getRandomValues(new Uint8Array(HKDF_SALT_LENGTH));
    
    const key = await deriveKey(passphrase, pbkdf2Salt, hkdfSalt);
    const plaintext = writeString(input);
    
    const encryptedData = await webcrypto.subtle.encrypt(
        { name: "AES-GCM", iv, tagLength: gcmTagLength },
        key,
        plaintext
    );
    
    const combined = new Uint8Array(
        PBKDF2_SALT_LENGTH + IV_LENGTH + HKDF_SALT_LENGTH + encryptedData.byteLength
    );
    combined.set(pbkdf2Salt, 0);
    combined.set(iv, PBKDF2_SALT_LENGTH);
    combined.set(hkdfSalt, PBKDF2_SALT_LENGTH + IV_LENGTH);
    combined.set(new Uint8Array(encryptedData), PBKDF2_SALT_LENGTH + IV_LENGTH + HKDF_SALT_LENGTH);
    
    return HKDF_SALTED_ENCRYPTED_PREFIX + arrayBufferToBase64(combined);
}

async function decryptWithEphemeralSalt(input, passphrase) {
    if (!input.startsWith(HKDF_SALTED_ENCRYPTED_PREFIX)) {
        throw new Error(`Expected '${HKDF_SALTED_ENCRYPTED_PREFIX}' prefix.`);
    }
    
    const base64Data = input.slice(HKDF_SALTED_ENCRYPTED_PREFIX.length);
    const encryptedBuffer = base64ToArrayBuffer(base64Data);
    
    const minLength = PBKDF2_SALT_LENGTH + IV_LENGTH + HKDF_SALT_LENGTH;
    if (encryptedBuffer.length < minLength) {
        throw new Error("Invalid data length.");
    }
    
    let offset = 0;
    const pbkdf2Salt = encryptedBuffer.slice(offset, offset + PBKDF2_SALT_LENGTH);
    offset += PBKDF2_SALT_LENGTH;
    
    const iv = encryptedBuffer.slice(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;
    
    const hkdfSalt = encryptedBuffer.slice(offset, offset + HKDF_SALT_LENGTH);
    offset += HKDF_SALT_LENGTH;
    
    const encryptedData = encryptedBuffer.slice(offset);
    
    const key = await deriveKey(passphrase, pbkdf2Salt, hkdfSalt);
    const decryptedBuffer = await webcrypto.subtle.decrypt(
        { name: "AES-GCM", iv, tagLength: gcmTagLength },
        key,
        encryptedData
    );
    
    return readString(new Uint8Array(decryptedBuffer));
}

// Generate chunk ID based on content hash (like LiveSync does)
function generateChunkId(content, passphrase) {
    const hash = crypto.createHash('sha256');
    hash.update(content);
    hash.update(passphrase);
    return 'h:' + hash.digest('hex').substring(0, 40);
}

// File operations
async function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
}

async function writeFile(filePath, content) {
    await ensureDir(filePath);
    if (typeof content === 'string') {
        await fs.writeFile(filePath, content, 'utf8');
    } else {
        await fs.writeFile(filePath, content);
    }
}

class HeadlessSync {
    constructor() {
        this.remoteDb = null;
        this.chunkCache = new Map();
        this.stats = { synced: 0, errors: 0, skipped: 0, uploaded: 0 };
    }

    async init() {
        console.log('Initializing LiveSync-compatible sync...');
        console.log(`Vault path: ${VAULT_PATH}`);
        console.log(`Remote DB: ${remoteUrl}`);
        
        await loadState();
        
        this.remoteDb = new PouchDB(authUrl, {
            skip_setup: true,
            ajax: { timeout: 60000 }
        });

        try {
            const info = await this.remoteDb.info();
            console.log(`Connected: ${info.db_name}, ${info.doc_count} docs, seq: ${info.update_seq}`);
            return info;
        } catch (e) {
            console.error('Failed to connect:', e.message);
            throw e;
        }
    }

    async fetchChunksForFile(children) {
        const chunks = [];
        for (const chunkId of children) {
            if (this.chunkCache.has(chunkId)) {
                chunks.push(this.chunkCache.get(chunkId));
                continue;
            }
            
            try {
                const chunkDoc = await this.remoteDb.get(chunkId);
                // Get data (decrypt only if E2EE is enabled)
                let data = chunkDoc.data;
                if (E2EE_ENABLED && typeof data === 'string' && data.startsWith(HKDF_SALTED_ENCRYPTED_PREFIX)) {
                    data = await decryptWithEphemeralSalt(data, E2EE_PASSPHRASE);
                }
                this.chunkCache.set(chunkId, data);
                chunks.push(data);
            } catch (e) {
                console.warn(`Missing chunk ${chunkId}:`, e.message);
            }
        }
        return chunks;
    }

    async processFileEntry(entry) {
        let filePath = entry.path;
        
        if (!filePath) {
            this.stats.skipped++;
            return;
        }
        
        // Skip internal files
        if (filePath.startsWith('.obsidian/plugins/') || 
            filePath.startsWith('_') ||
            filePath.includes('/.trash/')) {
            this.stats.skipped++;
            return;
        }
        
        // Handle deleted files
        if (entry.deleted) {
            const fullPath = path.join(VAULT_PATH, filePath);
            try {
                await fs.unlink(fullPath);
                console.log(`Deleted: ${filePath}`);
                delete syncState.localFiles[filePath];
            } catch (e) {
                // File might not exist locally
            }
            return;
        }
        
        // Get file content from chunks
        let content = '';
        if (entry.children && entry.children.length > 0) {
            const chunks = await this.fetchChunksForFile(entry.children);
            content = chunks.join('');
        }
        
        // Handle binary files (base64 decode)
        if (entry.type === EntryTypes.NOTE_BINARY && content) {
            try {
                content = Buffer.from(content, 'base64');
            } catch (e) {
                console.warn(`Failed to decode base64 for ${filePath}:`, e.message);
            }
        }
        
        const fullPath = path.join(VAULT_PATH, filePath);
        await writeFile(fullPath, content);
        
        // Track in local state
        const stats = await fs.stat(fullPath);
        syncState.localFiles[filePath] = {
            mtime: stats.mtimeMs,
            size: stats.size,
            synced: true
        };
        
        this.stats.synced++;
        console.log(`Downloaded: ${filePath}`);
    }

    async syncFromChanges() {
        console.log('\nFetching remote changes...');
        
        const changesOpts = {
            include_docs: true,
            limit: BATCH_SIZE
        };
        
        if (syncState.lastSeq) {
            changesOpts.since = syncState.lastSeq;
        }
        
        const changes = await this.remoteDb.changes(changesOpts);
        console.log(`Got ${changes.results.length} remote changes`);
        
        for (const change of changes.results) {
            const doc = change.doc;
            if (!doc || doc._id.startsWith('_')) continue;
            
            // Check if it's a file entry (has children array and type)
            if (doc.children && Array.isArray(doc.children) && 
                (doc.type === EntryTypes.NOTE_PLAIN || doc.type === EntryTypes.NOTE_BINARY)) {
                try {
                    await this.processFileEntry(doc);
                } catch (e) {
                    console.error(`Error processing ${doc._id}:`, e.message);
                    this.stats.errors++;
                }
            }
        }
        
        syncState.lastSeq = changes.last_seq;
        await saveState();
        
        return changes.results.length;
    }

    async scanLocalChanges() {
        console.log('\nScanning for local changes...');
        
        const walk = async (dir, baseDir = '') => {
            const files = await fs.readdir(dir, { withFileTypes: true });
            const results = [];
            
            for (const file of files) {
                const fullPath = path.join(dir, file.name);
                const relativePath = path.join(baseDir, file.name);
                
                if (file.name.startsWith('.') && !relativePath.endsWith('.md')) continue;
                if (file.name.startsWith('_')) continue;
                if (relativePath.includes('/.trash/')) continue;
                
                if (file.isDirectory()) {
                    if (file.name === '.obsidian') continue;
                    const subFiles = await walk(fullPath, relativePath);
                    results.push(...subFiles);
                } else {
                    const ext = path.extname(file.name).toLowerCase();
                    if (['.md', '.png', '.jpg', '.jpeg', '.gif', '.pdf', '.tex', '.log', '.aux'].includes(ext)) {
                        results.push(relativePath);
                    }
                }
            }
            
            return results;
        };
        
        const allFiles = await walk(VAULT_PATH);
        const changedFiles = [];
        
        for (const filepath of allFiles) {
            const fullPath = path.join(VAULT_PATH, filepath);
            const stats = await fs.stat(fullPath);
            const tracked = syncState.localFiles[filepath];
            
            if (!tracked || tracked.mtime !== stats.mtimeMs || tracked.size !== stats.size) {
                changedFiles.push({ path: filepath, stats });
            }
        }
        
        console.log(`Found ${changedFiles.length} local changes`);
        return changedFiles;
    }

    async uploadFile(filepath, stats) {
        const fullPath = path.join(VAULT_PATH, filepath);
        const content = await fs.readFile(fullPath);
        const isBinary = !filepath.endsWith('.md');
        
        // Prepare content
        let textContent;
        if (isBinary) {
            textContent = content.toString('base64');
        } else {
            textContent = content.toString('utf8');
        }
        
        // Encrypt content only if E2EE is enabled
        let chunkData;
        if (E2EE_ENABLED) {
            chunkData = await encryptWithEphemeralSalt(textContent, E2EE_PASSPHRASE);
        } else {
            chunkData = textContent; // Store plain text
        }
        
        // Generate chunk ID based on content hash (LiveSync way)
        const chunkId = generateChunkId(textContent, E2EE_ENABLED ? E2EE_PASSPHRASE : '');
        
        // Create chunk document
        const chunkDoc = {
            _id: chunkId,
            type: EntryTypes.CHUNK,
            data: chunkData
        };
        
        // Upload chunk first
        try {
            const existingChunk = await this.remoteDb.get(chunkId).catch(() => null);
            if (existingChunk) {
                chunkDoc._rev = existingChunk._rev;
            }
            await this.remoteDb.put(chunkDoc);
        } catch (e) {
            console.warn(`Failed to upload chunk for ${filepath}:`, e.message);
            throw e;
        }
        
        // Build the file document (exact LiveSync format)
        // CRITICAL: Document ID must be lowercase (LiveSync behavior)
        const docId = filepath.toLowerCase();
        const doc = {
            _id: docId,
            type: isBinary ? EntryTypes.NOTE_BINARY : EntryTypes.NOTE_PLAIN,
            path: filepath, // Original case preserved in path field
            mtime: stats.mtimeMs,
            ctime: stats.birthtimeMs,
            size: stats.size,
            children: [chunkId],
            eden: {},
            deleted: false
        };
        
        // Get existing doc for _rev
        try {
            const existing = await this.remoteDb.get(docId);
            doc._rev = existing._rev;
            
            // Delete old chunks if different
            if (existing.children && existing.children.length > 0) {
                for (const oldChunkId of existing.children) {
                    if (oldChunkId !== chunkId) {
                        try {
                            const oldChunk = await this.remoteDb.get(oldChunkId);
                            await this.remoteDb.remove(oldChunk);
                        } catch (e) {
                            // Old chunk might not exist
                        }
                    }
                }
            }
        } catch (e) {
            // New file
        }
        
        // Upload file document
        await this.remoteDb.put(doc);
        console.log(`Uploaded: ${filepath}`);
        
        // Track in local state
        syncState.localFiles[filepath] = {
            mtime: stats.mtimeMs,
            size: stats.size,
            synced: true
        };
        
        this.stats.uploaded++;
    }

    async uploadLocalChanges() {
        if (PULL_ONLY) {
            console.log('Skipping upload (PULL-ONLY mode)');
            return;
        }
        
        const changedFiles = await this.scanLocalChanges();
        
        for (const { path: filepath, stats } of changedFiles) {
            try {
                await this.uploadFile(filepath, stats);
            } catch (e) {
                console.error(`Error uploading ${filepath}:`, e.message);
                this.stats.errors++;
            }
        }
        
        await saveState();
    }

    async close() {
        if (this.remoteDb) await this.remoteDb.close();
    }
}

async function main() {
    const sync = new HeadlessSync();
    const args = process.argv.slice(2);
    
    try {
        await sync.init();
        
        if (args.includes('--daemon')) {
            if (!syncState.lastSeq) {
                console.log('First run - performing initial sync...');
                await sync.uploadLocalChanges();
                await sync.syncFromChanges();
                const info = await sync.remoteDb.info();
                syncState.lastSeq = info.update_seq;
                await saveState();
            }
            
            console.log(`\nStarting daemon mode (sync every ${SYNC_INTERVAL_MS/1000}s)...`);
            
            const runSync = async () => {
                try {
                    console.log(`\n[${new Date().toISOString()}] Running bidirectional sync...`);
                    
                    // Upload local changes first
                    await sync.uploadLocalChanges();
                    if (sync.stats.uploaded > 0) {
                        console.log(`Uploaded ${sync.stats.uploaded} files`);
                        sync.stats.uploaded = 0;
                    }
                    
                    // Then download remote changes
                    const downloadCount = await sync.syncFromChanges();
                    if (downloadCount > 0) {
                        console.log(`Downloaded ${downloadCount} changes`);
                    }
                } catch (e) {
                    console.error('Sync error:', e.message);
                }
            };
            
            await runSync();
            setInterval(runSync, SYNC_INTERVAL_MS);
        } else {
            // One-time sync
            await sync.uploadLocalChanges();
            await sync.syncFromChanges();
            await sync.close();
            console.log('\n✅ Sync complete!');
            console.log(`Downloaded: ${sync.stats.synced}, Uploaded: ${sync.stats.uploaded}, Errors: ${sync.stats.errors}`);
        }
    } catch (e) {
        console.error('Fatal error:', e);
        await sync.close();
        process.exit(1);
    }
}

main();
