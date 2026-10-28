import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

const ROOT_COLLECTIONS = [
  'events',
  'members',
  'attendances',
  'doublesSchedules',
  'expenses',
  'settings',
  'posts',
];

describe('Firestore tenant scope', () => {
  test('does not access application data at the Firestore root', async () => {
    const source = await readFile('src/services/firebase.ts', 'utf8');
    for (const collectionName of ROOT_COLLECTIONS) {
      expect(source).not.toMatch(
        new RegExp(`(?:collection|doc)\\(db, ['"]${collectionName}['"]`),
      );
    }
  });

  test('builds every application data reference below organizations', async () => {
    const source = await readFile('src/services/firebase.ts', 'utf8');
    expect(source).toContain(
      "collection(db, 'organizations', organizationId, collectionName)",
    );
    expect(source).toContain(
      "doc(db, 'organizations', organizationId, collectionName, documentId)",
    );
  });
});
