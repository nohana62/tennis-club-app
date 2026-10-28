import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  BACKUP_FORMAT_VERSION,
  COLLECTION_NAMES,
  EXPECTED_PROJECT_ID,
} from './backup-firestore.mjs';

function parseArguments(args) {
  let file;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument.startsWith('--file=')) {
      file = argument.slice('--file='.length);
      continue;
    }

    if (argument === '--file') {
      file = args[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`未対応のオプションです: ${argument}`);
  }

  if (file === '') {
    throw new Error('--fileの後にバックアップファイルを指定してください。');
  }

  return { file };
}

async function findLatestBackup(cwd) {
  const backupDirectory = path.join(cwd, 'backups');
  let entries;

  try {
    entries = await readdir(backupDirectory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error('backupsフォルダがありません。');
    }
    throw error;
  }

  const candidates = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /^firestore-\d{8}-\d{6}Z\.json$/u.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort()
    .reverse();

  if (candidates.length === 0) {
    throw new Error('確認できるバックアップJSONがありません。');
  }

  return path.join(backupDirectory, candidates[0]);
}

function assertBackupStructure(backup) {
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
    throw new Error('バックアップJSONの形式が正しくありません。');
  }
  if (backup.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error(
      `未対応のバックアップ形式です: ${String(backup.formatVersion)}`,
    );
  }
  if (backup.projectId !== EXPECTED_PROJECT_ID) {
    throw new Error(
      `バックアップ元のプロジェクトIDが一致しません: ${String(backup.projectId)}`,
    );
  }
  if (
    typeof backup.createdAt !== 'string' ||
    Number.isNaN(Date.parse(backup.createdAt))
  ) {
    throw new Error('バックアップ作成日時が正しくありません。');
  }
  if (
    !backup.collections ||
    typeof backup.collections !== 'object' ||
    Array.isArray(backup.collections)
  ) {
    throw new Error('コレクション情報がありません。');
  }

  const actualNames = Object.keys(backup.collections).sort();
  const expectedNames = [...COLLECTION_NAMES].sort();
  if (
    actualNames.length !== expectedNames.length ||
    actualNames.some((name, index) => name !== expectedNames[index])
  ) {
    throw new Error('必要な7コレクションがすべて含まれていません。');
  }

  const counts = {};
  let calculatedTotal = 0;

  for (const collectionName of COLLECTION_NAMES) {
    const collectionBackup = backup.collections[collectionName];
    if (
      !collectionBackup ||
      !Number.isInteger(collectionBackup.count) ||
      collectionBackup.count < 0 ||
      !Array.isArray(collectionBackup.documents) ||
      collectionBackup.count !== collectionBackup.documents.length
    ) {
      throw new Error(`${collectionName}の件数情報が一致しません。`);
    }

    for (const documentBackup of collectionBackup.documents) {
      if (
        !documentBackup ||
        typeof documentBackup.id !== 'string' ||
        documentBackup.id.length === 0 ||
        !Object.hasOwn(documentBackup, 'data')
      ) {
        throw new Error(`${collectionName}に不正なドキュメントがあります。`);
      }
    }

    counts[collectionName] = collectionBackup.count;
    calculatedTotal += collectionBackup.count;
  }

  if (
    !Number.isInteger(backup.totalCount) ||
    backup.totalCount !== calculatedTotal
  ) {
    throw new Error('全体件数とコレクション別件数の合計が一致しません。');
  }

  return { counts, totalCount: calculatedTotal };
}

export async function verifyBackupFile(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (path.extname(resolvedPath).toLowerCase() !== '.json') {
    throw new Error('確認対象は.jsonファイルを指定してください。');
  }

  const contents = await readFile(resolvedPath);
  const hashContents = await readFile(`${resolvedPath}.sha256`, 'utf8');
  const savedHashMatch = /^([0-9a-f]{64})\s{2}(.+)\s*$/iu.exec(hashContents);
  if (!savedHashMatch) {
    throw new Error('SHA-256ファイルの形式が正しくありません。');
  }

  const [, savedHash, savedFileName] = savedHashMatch;
  if (savedFileName !== path.basename(resolvedPath)) {
    throw new Error('SHA-256ファイルに記録されたファイル名が一致しません。');
  }

  const calculatedHash = createHash('sha256').update(contents).digest('hex');
  if (savedHash.toLowerCase() !== calculatedHash) {
    throw new Error('SHA-256が一致しません。ファイルが変更または破損しています。');
  }

  let backup;
  try {
    backup = JSON.parse(contents.toString('utf8'));
  } catch {
    throw new Error('バックアップJSONを読み取れません。');
  }

  const summary = assertBackupStructure(backup);
  return {
    filePath: resolvedPath,
    createdAt: backup.createdAt,
    projectId: backup.projectId,
    hash: calculatedHash,
    ...summary,
  };
}

export async function runVerification(args, cwd = process.cwd()) {
  const { file } = parseArguments(args);
  const filePath = file
    ? path.resolve(cwd, file)
    : await findLatestBackup(cwd);
  const result = await verifyBackupFile(filePath);

  console.log(`確認対象: ${path.relative(cwd, result.filePath)}`);
  console.log(`作成日時: ${result.createdAt}`);
  console.log(`プロジェクト: ${result.projectId}`);
  for (const collectionName of COLLECTION_NAMES) {
    console.log(`${collectionName}: ${result.counts[collectionName]}件`);
  }
  console.log(`合計: ${result.totalCount}件`);
  console.log(`SHA-256確認: 一致`);
  console.log('バックアップ検証完了');

  return result;
}

async function main() {
  try {
    await runVerification(process.argv.slice(2));
  } catch (error) {
    console.error(`バックアップ検証失敗: ${error?.message ?? String(error)}`);
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;

if (entryPoint === import.meta.url) {
  await main();
}
