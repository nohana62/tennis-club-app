import { isDeepStrictEqual } from 'node:util';
import { validateId } from './admin-utils.mjs';

export const ROOT_COLLECTIONS = [
  'events',
  'members',
  'attendances',
  'doublesSchedules',
  'expenses',
  'settings',
  'posts',
];

export function parseMigrationOptions(args) {
  const values = new Map();
  for (const arg of args) {
    if (!arg.startsWith('--')) throw new Error(`不明な引数です: ${arg}`);
    const [key, ...rest] = arg.slice(2).split('=');
    values.set(key, rest.length > 0 ? rest.join('=') : true);
  }
  const allowed = new Set([
    'organization',
    'apply',
    'confirm',
    'delete-source',
    'delete-confirm',
  ]);
  for (const key of values.keys()) {
    if (!allowed.has(key)) throw new Error(`不明なオプションです: --${key}`);
  }
  const organizationValue = values.get('organization');
  if (typeof organizationValue !== 'string') {
    throw new Error('--organization=<団体ID> は必須です。');
  }
  const organizationId = validateId(organizationValue, '団体ID');
  const apply = values.get('apply') === true;
  const deleteSource = values.get('delete-source') === true;
  if (deleteSource && !apply) {
    throw new Error('--delete-source には --apply も必要です。');
  }
  if (apply && values.get('confirm') !== `COPY_TO_${organizationId}`) {
    throw new Error(`コピー実行には --confirm=COPY_TO_${organizationId} が必要です。`);
  }
  if (
    deleteSource
    && values.get('delete-confirm') !== `DELETE_ROOT_DATA_${organizationId}`
  ) {
    throw new Error(
      `元データ削除には --delete-confirm=DELETE_ROOT_DATA_${organizationId} が必要です。`,
    );
  }
  return { organizationId, apply, deleteSource };
}

export function classifyDocuments(sourceDocuments, targetDocuments) {
  const targetById = new Map(targetDocuments.map((document) => [document.id, document.data]));
  const copy = [];
  const identical = [];
  const conflicts = [];
  for (const source of sourceDocuments) {
    const target = targetById.get(source.id);
    if (target === undefined) {
      copy.push(source);
    } else if (isDeepStrictEqual(source.data, target)) {
      identical.push(source.id);
    } else {
      conflicts.push(source.id);
    }
  }
  return { copy, identical, conflicts };
}
