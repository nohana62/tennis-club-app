import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  BACKUP_FORMAT_VERSION,
  EXPECTED_PROJECT_ID,
  assertSensitivePathsIgnored,
  parseArguments,
  parseEnvFile,
  runBackup,
  serializeFirestoreValue,
  validateFirebaseConfig,
  writeBackupFiles,
} from './backup-firestore.mjs';

const validConfig = {
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: `${EXPECTED_PROJECT_ID}.firebaseapp.com`,
  VITE_FIREBASE_PROJECT_ID: EXPECTED_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: `${EXPECTED_PROJECT_ID}.appspot.com`,
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789',
  VITE_FIREBASE_APP_ID: '1:123456789:web:test',
};

test('requires the exact production project argument', () => {
  assert.deepEqual(
    parseArguments([`--project=${EXPECTED_PROJECT_ID}`]),
    { projectId: EXPECTED_PROJECT_ID, checkOnly: false },
  );
  assert.deepEqual(
    parseArguments(['--check-only', '--project', EXPECTED_PROJECT_ID]),
    { projectId: EXPECTED_PROJECT_ID, checkOnly: true },
  );
  assert.throws(() => parseArguments([]), /--project=/u);
  assert.throws(
    () => parseArguments(['--project=another-project']),
    /許可されていません/u,
  );
});

test('parses the dedicated environment file and rejects duplicates', () => {
  const parsed = parseEnvFile(`
    # comment
    VITE_FIREBASE_PROJECT_ID=${EXPECTED_PROJECT_ID}
    VITE_FIREBASE_API_KEY="test-api-key"
  `);

  assert.equal(parsed.VITE_FIREBASE_PROJECT_ID, EXPECTED_PROJECT_ID);
  assert.equal(parsed.VITE_FIREBASE_API_KEY, 'test-api-key');
  assert.throws(
    () => parseEnvFile('SAME=first\nSAME=second'),
    /重複/u,
  );
});

test('validates all settings and the project identity', () => {
  const config = validateFirebaseConfig(validConfig, EXPECTED_PROJECT_ID);
  assert.equal(config.projectId, EXPECTED_PROJECT_ID);

  assert.throws(
    () =>
      validateFirebaseConfig(
        { ...validConfig, VITE_FIREBASE_API_KEY: '' },
        EXPECTED_PROJECT_ID,
      ),
    /必要な設定/u,
  );
  assert.throws(
    () =>
      validateFirebaseConfig(
        { ...validConfig, VITE_FIREBASE_PROJECT_ID: 'another-project' },
        EXPECTED_PROJECT_ID,
      ),
    /一致しません/u,
  );
});

test('preserves Firestore-specific value types', () => {
  class Timestamp {
    constructor(seconds, nanoseconds) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
  }

  const serialized = serializeFirestoreValue({
    createdAt: new Timestamp(123, 456),
    values: [Number.NaN, Number.POSITIVE_INFINITY],
    nested: { enabled: true },
  });

  assert.deepEqual(serialized, {
    createdAt: {
      __firestoreType: 'timestamp',
      seconds: 123,
      nanoseconds: 456,
    },
    values: [
      { __firestoreType: 'number', value: 'NaN' },
      { __firestoreType: 'number', value: 'Infinity' },
    ],
    nested: { enabled: true },
  });
  assert.throws(
    () => serializeFirestoreValue({ invalid: undefined }),
    /undefined/u,
  );
});

test('writes a verified backup and never overwrites it', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'tennis-backup-test-'));
  const createdAt = new Date('2026-09-21T04:00:00.000Z');
  const backup = {
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: createdAt.toISOString(),
    projectId: EXPECTED_PROJECT_ID,
    totalCount: 0,
    collections: {},
  };

  try {
    const output = await writeBackupFiles({ backup, cwd, createdAt });
    const saved = JSON.parse(await readFile(output.finalPath, 'utf8'));
    const hashFile = await readFile(output.hashPath, 'utf8');

    assert.deepEqual(saved, backup);
    assert.match(hashFile, new RegExp(`^${output.hash}  firestore-`, 'u'));
    await assert.rejects(
      writeBackupFiles({ backup, cwd, createdAt }),
      /既に存在/u,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('checks sensitive exclusions without requiring the Git command', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'tennis-ignore-test-'));

  try {
    await writeFile(
      path.join(cwd, '.gitignore'),
      'backups/\n.env.backup.local\n',
      'utf8',
    );
    await assert.doesNotReject(assertSensitivePathsIgnored(cwd));

    await writeFile(path.join(cwd, '.gitignore'), 'backups/\n', 'utf8');
    await assert.rejects(
      assertSensitivePathsIgnored(cwd),
      /\.env\.backup\.local/u,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('check-only validates local settings without creating a backup', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'tennis-check-test-'));

  try {
    await writeFile(
      path.join(cwd, '.gitignore'),
      'backups/\n.env.backup.local\n',
      'utf8',
    );
    await writeFile(
      path.join(cwd, '.env.backup.local'),
      `${Object.entries(validConfig)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n')}\n`,
      'utf8',
    );

    const result = await runBackup(
      ['--check-only', `--project=${EXPECTED_PROJECT_ID}`],
      cwd,
    );

    assert.deepEqual(result, {
      checkOnly: true,
      projectId: EXPECTED_PROJECT_ID,
    });
    await assert.rejects(readFile(path.join(cwd, 'backups')), /ENOENT|EISDIR/u);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('the backup script does not reference Firestore write APIs', async () => {
  const source = await readFile(
    new URL('./backup-firestore.mjs', import.meta.url),
    'utf8',
  );
  const writeApiPattern = new RegExp(
    ['add', 'set', 'update', 'delete']
      .map((operation) => `${operation}Doc`)
      .concat(['writeBatch', 'runTransaction'])
      .join('|'),
    'u',
  );

  assert.doesNotMatch(source, writeApiPattern);
});
