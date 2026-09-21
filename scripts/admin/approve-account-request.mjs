import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { initializeAdmin } from './admin-config.mjs';
import { approveAccountRequest } from './account-request-approval.mjs';
import { validateId } from './admin-utils.mjs';

const prompt = createInterface({ input, output });

try {
  const organizationId = validateId(await prompt.question('団体ID: '), '団体ID');
  const loginId = validateId(
    await prompt.question('承認するユーザーID: '),
    'ユーザーID',
  );
  const confirmation = await prompt.question(
    `${organizationId} の ${loginId} を一般利用者として承認します。APPROVEと入力: `,
  );
  if (confirmation !== 'APPROVE') throw new Error('承認を中止しました。');

  const { projectId, auth, db } = await initializeAdmin();
  console.log(`接続先: ${projectId}`);
  const result = await approveAccountRequest({
    auth,
    db,
    organizationId,
    loginId,
  });
  console.log('アカウント申請を承認しました。');
  console.log(`団体ID: ${result.organizationId}`);
  console.log(`ユーザーID: ${result.loginId}`);
  console.log(`表示名: ${result.displayName}`);
  console.log(`一時パスワード（再表示不可）: ${result.temporaryPassword}`);
} catch (error) {
  console.error(`申請承認失敗: ${error?.message ?? String(error)}`);
  process.exitCode = 1;
} finally {
  prompt.close();
}
