const cron = require('node-cron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const config = require('../config');

function runBackup() {
  if (!config.MONGODB_URI) return;
  const backupDir = path.join(config.DATA_DIR, 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(backupDir, `rekart-auto-${stamp}`);

  execFile('mongodump', [`--uri=${config.MONGODB_URI}`, `--out=${out}`], err => {
    if (err) console.error('[backup-cron]', err.message);
    else console.log('[backup-cron] saved →', out);
    pruneOldBackups(backupDir);
  });
}

function pruneOldBackups(backupDir) {
  try {
    const entries = fs
      .readdirSync(backupDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name.startsWith('rekart-auto-'))
      .map(d => ({ name: d.name, mtime: fs.statSync(path.join(backupDir, d.name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    entries.slice(config.BACKUP_RETENTION_COUNT).forEach(entry => {
      fs.rmSync(path.join(backupDir, entry.name), { recursive: true, force: true });
    });
  } catch (err) {
    console.warn('[backup-cron] prune failed:', err.message);
  }
}

function startBackupScheduler() {
  if (!config.BACKUP_CRON_ENABLED || !cron.validate(config.BACKUP_CRON_SCHEDULE)) return;
  cron.schedule(config.BACKUP_CRON_SCHEDULE, runBackup);
  console.log(`[backup-cron] scheduled → ${config.BACKUP_CRON_SCHEDULE}`);
}

module.exports = { startBackupScheduler, runBackup };
