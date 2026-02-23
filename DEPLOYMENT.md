# Deployment Guide

Quick reference for deploying Obsidian LiveSync Headless.

---

## Fresh Install

### 1. Clone Repository

```bash
git clone https://github.com/tgmstudios/obsidian-livesync-headless.git
cd obsidian-livesync-headless
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Setup Wizard

```bash
npm run setup
```

**Wizard will ask for:**
- Vault path (e.g., `/home/user/obsidian/vault`)
- CouchDB URL (e.g., `https://obsidian.example.com`)
- Database name (e.g., `obsidian-vault`)
- Username
- Password
- E2EE enabled? (yes/no)
- E2EE passphrase (if enabled)
- Sync interval in seconds (default: 30)

**Result:** Creates `config.json` with chmod 600

### 4. Test Sync

```bash
npm start
```

Runs one sync cycle, then exits. Check for errors.

### 5. Install as Service

```bash
npm run install-service
sudo systemctl start obsidian-sync
```

---

## Service Management

### Start Service
```bash
sudo systemctl start obsidian-sync
```

### Stop Service
```bash
sudo systemctl stop obsidian-sync
```

### Restart Service
```bash
sudo systemctl restart obsidian-sync
```

### Check Status
```bash
systemctl status obsidian-sync
```

### View Logs
```bash
journalctl -u obsidian-sync -f
```

### Disable Auto-start
```bash
sudo systemctl disable obsidian-sync
```

### Re-enable Auto-start
```bash
sudo systemctl enable obsidian-sync
```

---

## Configuration Updates

After changing `config.json`:

```bash
sudo systemctl restart obsidian-sync
```

---

## Troubleshooting

### Check if service is running

```bash
systemctl is-active obsidian-sync
```

Expected output: `active`

### Check recent errors

```bash
journalctl -u obsidian-sync --since "10 minutes ago" | grep -i error
```

### Test connection manually

```bash
curl -u username:password https://obsidian.example.com/database-name
```

Should return JSON with database info.

### Verify vault permissions

```bash
ls -la /path/to/vault
```

Ensure the user running the service has read/write access.

---

## Updating

```bash
cd obsidian-livesync-headless
git pull
npm install
sudo systemctl restart obsidian-sync
```

---

## Uninstalling

```bash
sudo systemctl stop obsidian-sync
sudo systemctl disable obsidian-sync
sudo rm /etc/systemd/system/obsidian-sync.service
sudo systemctl daemon-reload
```

Then delete the project directory.

---

## Security Checklist

- [ ] `config.json` has chmod 600
- [ ] CouchDB uses HTTPS (not HTTP)
- [ ] Strong CouchDB password
- [ ] E2EE enabled (optional but recommended)
- [ ] Firewall restricts CouchDB access
- [ ] Regular backups of vault

---

## Performance Tuning

### Faster Sync (15 seconds)

Edit `config.json`:
```json
{
  "syncIntervalSeconds": 15
}
```

Then restart service.

### Slower Sync (for resource-constrained devices)

```json
{
  "syncIntervalSeconds": 120
}
```

### Large Vaults

For vaults >1GB, consider:
- Increasing timeout in `src/sync.mjs` (ajax timeout)
- Monitoring memory usage
- Using E2EE compression

---

## Production Checklist

Before going to production:

- [ ] Tested one-time sync successfully
- [ ] Service starts and runs without errors
- [ ] Files sync to/from other devices
- [ ] E2EE passphrase matches across devices
- [ ] Service auto-starts on boot
- [ ] Logs are clean (no errors)
- [ ] Backup strategy in place
- [ ] Documentation reviewed

---

## Support

If you encounter issues:

1. Check logs: `journalctl -u obsidian-sync -f`
2. Verify config: `cat config.json` (redact password!)
3. Test CouchDB connection manually
4. Search [GitHub Issues](https://github.com/tgmstudios/obsidian-livesync-headless/issues)
5. Open a new issue with logs + config (redacted)

---

**Happy syncing!** 🚀
