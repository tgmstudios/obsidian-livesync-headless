# Obsidian LiveSync Headless

🚀 **Bidirectional sync for Obsidian vaults on headless Linux servers**

Sync your Obsidian vault to a headless Linux server (VPS, Raspberry Pi, home server) using the official [Self-hosted LiveSync](https://github.com/vrtmrz/obsidian-livesync) protocol.

Perfect for:
- ✅ Server-side automation and scripting
- ✅ Backup solutions
- ✅ CI/CD workflows
- ✅ Headless note processing
- ✅ Multi-device sync via intermediate server

---

## Features

- ✅ **Full LiveSync compatibility** - Works with the official Obsidian LiveSync plugin
- ✅ **Bidirectional sync** - Upload and download changes automatically
- ✅ **E2EE support** - Optional end-to-end encryption (HKDF + AES-256-GCM)
- ✅ **Change detection** - Efficient mtime + size tracking
- ✅ **Systemd integration** - Runs as a background service
- ✅ **Easy setup** - Interactive configuration wizard
- ✅ **No desktop required** - Pure Node.js, runs anywhere

---

## Quick Start

### 1. Install

```bash
git clone https://github.com/tgmstudios/obsidian-livesync-headless.git
cd obsidian-livesync-headless
npm install
```

### 2. Configure

```bash
npm run setup
```

The setup wizard will ask for:
- Vault path (e.g., `/home/user/obsidian/my-vault`)
- CouchDB URL (e.g., `https://obsidian.example.com`)
- Database name
- Username and password
- E2EE settings (on/off + passphrase)

### 3. Run

**One-time sync:**
```bash
npm start
```

**Install as systemd service (recommended):**
```bash
npm run install-service
sudo systemctl enable obsidian-sync
sudo systemctl start obsidian-sync
```

---

## Requirements

- **Node.js** 18+ 
- **CouchDB** server with LiveSync database
- **Linux** (systemd for service mode)

---

## Configuration

After running `npm run setup`, config is saved to `config.json`:

```json
{
  "vaultPath": "/home/user/obsidian/vault",
  "couchDB": {
    "uri": "https://obsidian.example.com",
    "database": "obsidian-vault",
    "username": "admin",
    "password": "secret"
  },
  "e2ee": {
    "enabled": false,
    "passphrase": ""
  },
  "syncIntervalSeconds": 30
}
```

**Important:** Keep `config.json` secure! It contains your CouchDB credentials.

---

## Usage

### Check Sync Status

```bash
sudo systemctl status obsidian-sync
```

### View Logs

```bash
journalctl -u obsidian-sync -f
```

### Restart Service

```bash
sudo systemctl restart obsidian-sync
```

### Stop Service

```bash
sudo systemctl stop obsidian-sync
```

---

## How It Works

This tool implements the same sync protocol as the official Obsidian LiveSync plugin:

1. **Document Structure**
   - File metadata stored with `_id` = filename
   - Content split into chunks (type: `leaf`)
   - Chunks referenced in `children` array

2. **Sync Process**
   - Every 30 seconds (configurable):
     - Upload local changes first (preserves edits)
     - Download remote changes second
   - Uses PouchDB changes feed for efficient sync

3. **Encryption (Optional)**
   - HKDF-SHA256 key derivation (310,000 PBKDF2 iterations)
   - AES-256-GCM encryption
   - Ephemeral salts (same as LiveSync plugin)

---

## Comparison with Official Plugin

| Feature | Official Plugin | This Tool |
|---------|----------------|-----------|
| **Platform** | Obsidian desktop/mobile | Headless Linux |
| **Sync Protocol** | ✅ LiveSync | ✅ LiveSync (compatible) |
| **E2EE** | ✅ Yes | ✅ Yes (optional) |
| **Automation** | ❌ No | ✅ Yes (CLI + service) |
| **GUI** | ✅ Yes | ❌ No (headless) |

---

## Troubleshooting

### Files not syncing

1. Check service status: `systemctl status obsidian-sync`
2. Check logs: `journalctl -u obsidian-sync -f`
3. Verify CouchDB credentials
4. Ensure E2EE settings match your other devices

### E2EE passphrase mismatch

If you see encrypted chunks but can't read them:
- Your passphrase doesn't match
- E2EE is enabled on one side but not the other

**Fix:** Update `config.json` to match your LiveSync settings, then restart.

### Permission denied

The service runs as your user. Ensure the vault path is readable/writable:
```bash
ls -la ~/obsidian/vault
```

---

## Development

### Run in dev mode

```bash
node src/sync.mjs --daemon
```

### Run tests

```bash
npm test
```

### Build documentation

```bash
npm run docs
```

---

## Security

⚠️ **Important Security Notes:**

1. **Credentials**: `config.json` contains your CouchDB password in plain text. Protect it:
   ```bash
   chmod 600 config.json
   ```

2. **E2EE**: If you enable E2EE, your passphrase is stored in `config.json`. Consider using environment variables:
   ```bash
   E2EE_PASSPHRASE=your-secret npm start
   ```

3. **CouchDB**: Use HTTPS for your CouchDB server. Never sync over plain HTTP.

4. **Firewall**: Restrict CouchDB access to trusted IPs only.

---

## Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Obsidian LiveSync](https://github.com/vrtmrz/obsidian-livesync) by vrtmrz - The original plugin this tool is compatible with
- [PouchDB](https://pouchdb.com/) - JavaScript database for sync
- [Obsidian](https://obsidian.md/) - The knowledge base app

---

## Support

- 🐛 **Bug reports**: [GitHub Issues](https://github.com/tgmstudios/obsidian-livesync-headless/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/tgmstudios/obsidian-livesync-headless/discussions)
- 📧 **Email**: aiden.johnson@tgmstudios.net

---

**Made with ❤️ for the Obsidian community**
