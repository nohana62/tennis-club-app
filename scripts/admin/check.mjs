import { initializeAdmin } from './admin-config.mjs';

try {
  const { projectId, auth, db } = await initializeAdmin();
  await Promise.all([
    auth.listUsers(1),
    db.collection('organizations').limit(1).get(),
  ]);
  console.log(`接続先: ${projectId}`);
  console.log('管理ツール確認完了: 書き込みは行っていません。');
} catch (error) {
  console.error(`管理ツール確認失敗: ${error?.message ?? String(error)}`);
  process.exitCode = 1;
}
