import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ROOT_COLLECTIONS,
  classifyDocuments,
  parseMigrationOptions,
} from './migrate-root-data-utils.mjs';

test('dry-run is the default migration mode', () => {
  assert.deepEqual(parseMigrationOptions(['--organization=club-a']), {
    organizationId: 'club-a',
    apply: false,
    deleteSource: false,
  });
  assert.equal(ROOT_COLLECTIONS.length, 7);
});

test('copy and deletion each require an exact explicit confirmation', () => {
  assert.throws(
    () => parseMigrationOptions(['--organization=club-a', '--apply']),
    /COPY_TO_club-a/,
  );
  assert.throws(
    () => parseMigrationOptions([
      '--organization=club-a',
      '--apply',
      '--confirm=COPY_TO_club-a',
      '--delete-source',
    ]),
    /DELETE_ROOT_DATA_club-a/,
  );
  assert.deepEqual(parseMigrationOptions([
    '--organization=club-a',
    '--apply',
    '--confirm=COPY_TO_club-a',
    '--delete-source',
    '--delete-confirm=DELETE_ROOT_DATA_club-a',
  ]), {
    organizationId: 'club-a',
    apply: true,
    deleteSource: true,
  });
});

test('classifies identical reruns as safe and rejects content conflicts', () => {
  const source = [
    { id: 'same', data: { value: 1 } },
    { id: 'new', data: { value: 2 } },
    { id: 'conflict', data: { value: 3 } },
  ];
  const target = [
    { id: 'same', data: { value: 1 } },
    { id: 'conflict', data: { value: 4 } },
  ];
  const result = classifyDocuments(source, target);
  assert.deepEqual(result.copy.map(({ id }) => id), ['new']);
  assert.deepEqual(result.identical, ['same']);
  assert.deepEqual(result.conflicts, ['conflict']);
});
