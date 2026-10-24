// Saves everything in one JSON file (server/data/db.json): accounts, sessions, institute data and
// the activity log. Writes are atomic (temp file + rename) and a backup is kept.

import fs from 'node:fs';
import path from 'node:path';
import { renumberLegacyRolls } from './rollno.mjs';

const BACKUP_EVERY_MS = 10 * 60 * 1000;
const SAVE_DELAY_MS = 250;
const MAX_AUDIT = 3000;

const LEGACY_USERS_KEY = 'academia_os_users_v1';
const LEGACY_INSTITUTE_KEY = 'academia_os_institute_data_v1';

const emptyState = () => ({ format: 2, version: 0, users: [], institute: null, sessions: {}, audit: [] });

const parseJson = (value, fallback) => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

// Older versions stored two browser-style strings under "data". Turn them into the new layout.
const migrate = raw => {
  if (raw && raw.format === 2 && Array.isArray(raw.users)) {
    return {
      ...emptyState(),
      ...raw,
      sessions: raw.sessions && typeof raw.sessions === 'object' ? raw.sessions : {},
      audit: Array.isArray(raw.audit) ? raw.audit : []
    };
  }
  if (raw && raw.data && typeof raw.data === 'object') {
    const users = parseJson(raw.data[LEGACY_USERS_KEY], []);
    const institute = parseJson(raw.data[LEGACY_INSTITUTE_KEY], null);
    return {
      ...emptyState(),
      version: typeof raw.version === 'number' ? raw.version : 0,
      users: Array.isArray(users) ? users : [],
      institute: institute && typeof institute === 'object' ? institute : null
    };
  }
  return emptyState();
};

export const createStore = dir => {
  fs.mkdirSync(dir, { recursive: true });
  const dbFile = path.join(dir, 'db.json');
  const backupFile = path.join(dir, 'db.backup.json');

  let raw = null;
  try {
    raw = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  } catch {
    /* first start, or the file is unreadable: start empty */
  }

  const migrating = !!raw && !(raw.format === 2);
  if (migrating) {
    // Keep the original file untouched, just in case
    const copy = path.join(dir, `db.before-upgrade-${Date.now()}.json`);
    try {
      fs.copyFileSync(dbFile, copy);
      console.log(`Upgraded the data file to the new format. Old file saved as ${path.basename(copy)}`);
    } catch (err) {
      console.error('Could not copy the old data file:', err.message);
    }
  }

  const state = migrate(raw);
  if (migrating) state.version += 1;

  // Older data used roll numbers like APEX-25-0101: they become plain running numbers (01, 02, ...)
  const hadFile = fs.existsSync(dbFile);
  const rollsChanged = renumberLegacyRolls(state);
  if (rollsChanged > 0) {
    state.version += 1;
    if (hadFile && !migrating) {
      try {
        fs.copyFileSync(dbFile, path.join(dir, `db.before-rollno-${Date.now()}.json`));
      } catch (err) {
        console.error('Could not copy the data file:', err.message);
      }
    }
    console.log(`Roll numbers of ${rollsChanged} student${rollsChanged === 1 ? '' : 's'} changed to plain numbers (01, 02, ...).`);
  }

  let timer = null;
  let writing = false;
  let again = false;
  let lastBackupAt = 0;

  const dropExpiredSessions = () => {
    const now = Date.now();
    for (const [key, session] of Object.entries(state.sessions)) {
      if (!session || session.expiresAt <= now) delete state.sessions[key];
    }
  };

  const write = () => {
    if (writing) {
      again = true;
      return;
    }
    writing = true;
    dropExpiredSessions();
    const snapshot = JSON.stringify(state);
    const tmp = `${dbFile}.tmp`;

    fs.promises
      .writeFile(tmp, snapshot)
      .then(async () => {
        if (Date.now() - lastBackupAt > BACKUP_EVERY_MS && fs.existsSync(dbFile)) {
          await fs.promises.copyFile(dbFile, backupFile);
          lastBackupAt = Date.now();
        }
        await fs.promises.rename(tmp, dbFile); // the file is never half written
      })
      .catch(err => console.error('Could not save db.json:', err.message))
      .finally(() => {
        writing = false;
        if (again) {
          again = false;
          write();
        }
      });
  };

  // Save soon (many quick changes become one write)
  const touch = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      write();
    }, SAVE_DELAY_MS);
  };

  if (migrating || rollsChanged > 0) touch();

  return {
    state,
    dbFile,
    // Something other clients must see changed (accounts or institute data)
    bump() {
      state.version += 1;
      touch();
    },
    // Something changed that clients do not need to refetch (sessions, activity log)
    touch,
    audit(user, action, detail = '') {
      state.audit.push({
        at: new Date().toISOString(),
        userId: user?.id || null,
        name: user?.name || null,
        action,
        detail: String(detail).slice(0, 300)
      });
      if (state.audit.length > MAX_AUDIT) state.audit.splice(0, state.audit.length - MAX_AUDIT);
      touch();
    },
    // Used when the process stops
    flushSync() {
      if (timer) clearTimeout(timer);
      timer = null;
      try {
        fs.writeFileSync(dbFile, JSON.stringify(state));
      } catch (err) {
        console.error('Could not save on exit:', err.message);
      }
    }
  };
};
