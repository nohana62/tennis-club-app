import { initializeAdmin } from './admin-config.mjs';
import {
  ROOT_COLLECTIONS,
  classifyDocuments,
  parseMigrationOptions,
} from './migrate-root-data-utils.mjs';

const BATCH_SIZE = 400;

async function readDocuments(collectionReference) {
  const snapshot = await collectionReference.get();
  return snapshot.docs.map((document) => ({
    id: document.id,
    data: document.data(),
  }));
}

async function commitInBatches(db, writes) {
  for (let offset = 0; offset < writes.length; offset += BATCH_SIZE) {
    const batch = db.batch();
    for (const write of writes.slice(offset, offset + BATCH_SIZE)) {
      if (write.operation === 'set') batch.set(write.reference, write.data);
      else batch.delete(write.reference);
    }
    await batch.commit();
  }
}

try {
  const options = parseMigrationOptions(process.argv.slice(2));
  const { projectId, db } = await initializeAdmin();
  console.log(`接続先: ${projectId}`);
  console.log(`対象団体: ${options.organizationId}`);
  console.log(`モード: ${options.apply ? 'コピー実行' : 'dry-run（書き込みなし）'}`);

  const plans = [];
  for (const collectionName of ROOT_COLLECTIONS) {
    const sourceReference = db.collection(collectionName);
    const targetReference = db.collection(
      `organizations/${options.organizationId}/${collectionName}`,
    );
    const [source, target] = await Promise.all([
      readDocuments(sourceReference),
      readDocuments(targetReference),
    ]);
    const classification = classifyDocuments(source, target);
    plans.push({ collectionName, source, targetReference, ...classification });
    console.log(
      `${collectionName}: 元=${source.length}, コピー予定=${classification.copy.length}, `
      + `同一=${classification.identical.length}, 競合=${classification.conflicts.length}`,
    );
  }

  const conflicts = plans.flatMap((plan) => (
    plan.conflicts.map((id) => `${plan.collectionName}/${id}`)
  ));
  if (conflicts.length > 0) {
    throw new Error(
      `移行先に内容が異なる文書があります。上書きせず停止しました: ${conflicts.join(', ')}`,
    );
  }

  if (!options.apply) {
    console.log(
      `実行するには --apply --confirm=COPY_TO_${options.organizationId} を追加してください。`,
    );
    process.exit(0);
  }

  const copyWrites = plans.flatMap((plan) => plan.copy.map((document) => ({
    operation: 'set',
    reference: plan.targetReference.doc(document.id),
    data: document.data,
  })));
  await commitInBatches(db, copyWrites);

  for (const plan of plans) {
    const target = await readDocuments(plan.targetReference);
    const verification = classifyDocuments(plan.source, target);
    if (verification.copy.length > 0 || verification.conflicts.length > 0) {
      throw new Error(`コピー後検証に失敗しました: ${plan.collectionName}`);
    }
  }
  console.log(`コピー後検証完了: ${copyWrites.length}文書を新規コピーしました。`);

  if (!options.deleteSource) {
    console.log('元データは保持しました。');
    process.exit(0);
  }

  const deleteWrites = plans.flatMap((plan) => plan.source.map((document) => ({
    operation: 'delete',
    reference: db.doc(`${plan.collectionName}/${document.id}`),
  })));
  await commitInBatches(db, deleteWrites);

  for (const collectionName of ROOT_COLLECTIONS) {
    const remaining = await db.collection(collectionName).limit(1).get();
    if (!remaining.empty) {
      throw new Error(`元データ削除後検証に失敗しました: ${collectionName}`);
    }
  }
  console.log(`元データ削除完了: ${deleteWrites.length}文書を削除しました。`);
} catch (error) {
  console.error(`ルートデータ移行失敗: ${error?.message ?? String(error)}`);
  process.exitCode = 1;
}
