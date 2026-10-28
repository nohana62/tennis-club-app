import { createHash } from 'node:crypto';
import {
  access,
  constants,
  link,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const EXPECTED_PROJECT_ID = 'tennis-club-app-cb7d2';
export const BACKUP_FORMAT_VERSION = 1;
export const COLLECTION_NAMES = Object.freeze([
  'events',
  'members',
  'attendances',
  'doublesSchedules',
  'expenses',
  'settings',
  'posts',
]);

const ENV_FILE_NAME = '.env.backup.local';
const REQUIRED_ENV_KEYS = Object.freeze([
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]);

export function parseArguments(args) {
  let projectId;
  let checkOnly = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--check-only') {
      checkOnly = true;
      continue;
    }

    if (argument.startsWith('--project=')) {
      projectId = argument.slice('--project='.length);
      continue;
    }

    if (argument === '--project') {
      projectId = args[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`未対応のオプションです: ${argument}`);
  }

  if (!projectId) {
    throw new Error(
      `接続先確認のため --project=${EXPECTED_PROJECT_ID} を指定してください。`,
    );
  }

  if (projectId !== EXPECTED_PROJECT_ID) {
    throw new Error(
      `指定されたプロジェクトIDが許可されていません: ${projectId}`,
    );
  }

  return { projectId, checkOnly };
}

export function parseEnvFile(contents) {
  const values = {};

  for (const [index, originalLine] of contents.split(/\r?\n/u).entries()) {
    const line = originalLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
    if (!match) {
      throw new Error(`${ENV_FILE_NAME}の${index + 1}行目を読み取れません。`);
    }

    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (Object.hasOwn(values, key)) {
      throw new Error(`${ENV_FILE_NAME}で${key}が重複しています。`);
    }

    values[key] = value;
  }

  return values;
}

export function validateFirebaseConfig(values, requestedProjectId) {
  const missingKeys = REQUIRED_ENV_KEYS.filter((key) => !values[key]);
  if (missingKeys.length > 0) {
    throw new Error(
      `${ENV_FILE_NAME}に必要な設定がありません: ${missingKeys.join(', ')}`,
    );
  }

  const configuredProjectId = values.VITE_FIREBASE_PROJECT_ID;
  if (
    configuredProjectId !== EXPECTED_PROJECT_ID ||
    requestedProjectId !== EXPECTED_PROJECT_ID ||
    configuredProjectId !== requestedProjectId
  ) {
    throw new Error(
      `FirebaseプロジェクトIDが一致しません。設定: ${configuredProjectId} / 指定: ${requestedProjectId}`,
    );
  }

  return {
    apiKey: values.VITE_FIREBASE_API_KEY,
    authDomain: values.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: configuredProjectId,
    storageBucket: values.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: values.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: values.VITE_FIREBASE_APP_ID,
  };
}

function encodeNumber(value) {
  if (Number.isNaN(value)) {
    return { __firestoreType: 'number', value: 'NaN' };
  }
  if (value === Number.POSITIVE_INFINITY) {
    return { __firestoreType: 'number', value: 'Infinity' };
  }
  if (value === Number.NEGATIVE_INFINITY) {
    return { __firestoreType: 'number', value: '-Infinity' };
  }
  return value;
}

export function serializeFirestoreValue(value, valuePath = 'data', ancestors = new WeakSet()) {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'number') {
    return encodeNumber(value);
  }

  if (typeof value === 'undefined') {
    throw new Error(`${valuePath}にJSONへ保存できないundefinedがあります。`);
  }

  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
    throw new Error(`${valuePath}にJSONへ保存できない値があります。`);
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`${valuePath}に無効な日付があります。`);
    }
    return { __firestoreType: 'date', value: value.toISOString() };
  }

  if (ancestors.has(value)) {
    throw new Error(`${valuePath}に循環参照があります。`);
  }
  ancestors.add(value);

  try {
    const constructorName = value.constructor?.name;

    if (
      constructorName === 'Timestamp' &&
      Number.isInteger(value.seconds) &&
      Number.isInteger(value.nanoseconds)
    ) {
      return {
        __firestoreType: 'timestamp',
        seconds: value.seconds,
        nanoseconds: value.nanoseconds,
      };
    }

    if (
      constructorName === 'GeoPoint' &&
      typeof value.latitude === 'number' &&
      typeof value.longitude === 'number'
    ) {
      return {
        __firestoreType: 'geoPoint',
        latitude: value.latitude,
        longitude: value.longitude,
      };
    }

    if (
      constructorName === 'Bytes' &&
      typeof value.toBase64 === 'function'
    ) {
      return {
        __firestoreType: 'bytes',
        value: value.toBase64(),
      };
    }

    if (
      value.type === 'document' &&
      typeof value.path === 'string'
    ) {
      return {
        __firestoreType: 'documentReference',
        path: value.path,
      };
    }

    if (Array.isArray(value)) {
      return value.map((item, index) =>
        serializeFirestoreValue(item, `${valuePath}[${index}]`, ancestors),
      );
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(
        `${valuePath}に未対応のFirestore値があります: ${constructorName ?? 'unknown'}`,
      );
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        serializeFirestoreValue(item, `${valuePath}.${key}`, ancestors),
      ]),
    );
  } finally {
    ancestors.delete(value);
  }
}

function formatTimestamp(date) {
  return date
    .toISOString()
    .replace(/[-:]/gu, '')
    .replace(/\.\d{3}Z$/u, 'Z')
    .replace('T', '-');
}

async function pathExists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

export async function assertSensitivePathsIgnored(cwd) {
  const gitignorePath = path.join(cwd, '.gitignore');
  let contents;

  try {
    contents = await readFile(gitignorePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(
        '.gitignoreがありません。機密ファイルの除外を確認できないため中止します。',
      );
    }
    throw error;
  }

  const rules = new Set(
    contents
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#')),
  );
  const requiredRules = ['backups/', ENV_FILE_NAME];
  const missingRules = requiredRules.filter((rule) => !rules.has(rule));

  if (missingRules.length > 0) {
    throw new Error(
      `.gitignoreに必要な設定がありません: ${missingRules.join(', ')}`,
    );
  }
}

export async function writeBackupFiles({
  backup,
  cwd,
  createdAt = new Date(),
}) {
  const outputDirectory = path.join(cwd, 'backups');
  const baseName = `firestore-${formatTimestamp(createdAt)}.json`;
  const finalPath = path.join(outputDirectory, baseName);
  const hashPath = `${finalPath}.sha256`;
  const temporaryPath = path.join(
    outputDirectory,
    `.${baseName}.${process.pid}.tmp`,
  );
  const temporaryHashPath = `${temporaryPath}.sha256`;

  await mkdir(outputDirectory, { recursive: true });
  if (await pathExists(finalPath) || await pathExists(hashPath)) {
    throw new Error(`同名のバックアップが既に存在します: ${baseName}`);
  }

  const contents = `${JSON.stringify(backup, null, 2)}\n`;
  let finalCreated = false;
  let hashCreated = false;

  try {
    await writeFile(temporaryPath, contents, { encoding: 'utf8', flag: 'wx' });
    JSON.parse(await readFile(temporaryPath, 'utf8'));
    const hash = createHash('sha256').update(contents, 'utf8').digest('hex');
    await writeFile(temporaryHashPath, `${hash}  ${baseName}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });

    await link(temporaryPath, finalPath);
    finalCreated = true;
    await link(temporaryHashPath, hashPath);
    hashCreated = true;
    await Promise.all([rm(temporaryPath), rm(temporaryHashPath)]);

    return { finalPath, hashPath, hash };
  } catch (error) {
    const cleanupTargets = [
      temporaryPath,
      temporaryHashPath,
      ...(hashCreated ? [hashPath] : []),
      ...(finalCreated ? [finalPath] : []),
    ];
    await Promise.all(
      cleanupTargets.map((target) => rm(target, { force: true })),
    );
    throw error;
  }
}

async function loadFirebaseConfig(cwd, requestedProjectId) {
  const envPath = path.join(cwd, ENV_FILE_NAME);
  let contents;

  try {
    contents = await readFile(envPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(
        `${ENV_FILE_NAME}がありません。.env.backup.exampleをコピーして作成してください。`,
      );
    }
    throw error;
  }

  return validateFirebaseConfig(parseEnvFile(contents), requestedProjectId);
}

async function readCollections(db, firestoreApi) {
  const collections = {};
  let totalCount = 0;

  for (const collectionName of COLLECTION_NAMES) {
    const snapshot = await firestoreApi.getDocs(
      firestoreApi.collection(db, collectionName),
    );
    const documents = snapshot.docs.map((documentSnapshot) => ({
      id: documentSnapshot.id,
      data: serializeFirestoreValue(
        documentSnapshot.data(),
        `${collectionName}/${documentSnapshot.id}`,
      ),
    }));

    collections[collectionName] = {
      count: documents.length,
      documents,
    };
    totalCount += documents.length;
    console.log(`${collectionName}: ${documents.length}件`);
  }

  return { collections, totalCount };
}

export async function runBackup(args, cwd = process.cwd()) {
  const { projectId, checkOnly } = parseArguments(args);
  await assertSensitivePathsIgnored(cwd);
  const firebaseConfig = await loadFirebaseConfig(cwd, projectId);

  console.log(`接続先: ${firebaseConfig.projectId}`);
  if (checkOnly) {
    console.log('設定確認完了: Firebaseには接続していません。');
    return { checkOnly: true, projectId };
  }

  console.log(
    '注意: バックアップには個人情報や通知資格情報が含まれる可能性があります。',
  );

  const firebaseAppApi = await import('firebase/app');
  const firestoreApi = await import('firebase/firestore');
  const app = firebaseAppApi.initializeApp(firebaseConfig, 'local-backup');

  try {
    const db = firestoreApi.getFirestore(app);
    const createdAt = new Date();
    const { collections, totalCount } = await readCollections(db, firestoreApi);
    const backup = {
      formatVersion: BACKUP_FORMAT_VERSION,
      createdAt: createdAt.toISOString(),
      projectId,
      source: 'firebase-client-sdk',
      collectionOrder: COLLECTION_NAMES,
      totalCount,
      collections,
    };
    const output = await writeBackupFiles({ backup, cwd, createdAt });

    console.log('バックアップ完了');
    console.log(`合計: ${totalCount}件`);
    console.log(`保存先: ${path.relative(cwd, output.finalPath)}`);
    console.log(`SHA-256: ${output.hash}`);

    return output;
  } finally {
    await firebaseAppApi.deleteApp(app);
  }
}

async function main() {
  try {
    await runBackup(process.argv.slice(2));
  } catch (error) {
    console.error(`バックアップ失敗: ${error?.message ?? String(error)}`);
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;

if (entryPoint === import.meta.url) {
  await main();
}
