import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { initializeAdmin } from './admin-config.mjs';
import { listPendingAccountRequests } from './account-request-approval.mjs';

const prompt = createInterface({ input, output });

try {
  const organizationId = await prompt.question('団体ID: ');
  const { projectId, db } = await initializeAdmin();
  const requests = await listPendingAccountRequests(db, organizationId);
  console.log(`接続先: ${projectId}`);
  if (requests.length === 0) {
    console.log('承認待ちの申請はありません。');
  } else {
    console.table(requests);
  }
} catch (error) {
  console.error(`申請一覧取得失敗: ${error?.message ?? String(error)}`);
  process.exitCode = 1;
} finally {
  prompt.close();
}
