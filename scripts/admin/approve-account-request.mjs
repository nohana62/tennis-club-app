import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { initializeAdmin } from './admin-config.mjs';
import { approveAccountRequest } from './account-request-approval.mjs';
import { validateId } from './admin-utils.mjs';

const prompt = createInterface({ input, output });
const recoverInterrupted = process.argv.slice(2).includes('--recover');

try {
  const organizationId = validateId(await prompt.question('団体ID: '), '団体ID');
  const loginId = validateId(
    await prompt.question('承認するユーザーID: '),
    'ユーザーID',
  );
  const confirmation = await prompt.question(
    `${organizationId} の ${loginId} をowner承認済みの権限で発行します。PROVISIONと入力: `,
  );
  if (confirmation !== 'PROVISION') throw new Error('発行を中止しました。');
  if (recoverInterrupted) {
    const recoveryConfirmation = await prompt.question(
      '中断された承認のAuth利用者と予約を取り消して再実行します。RECOVERと入力: ',
    );
    if (recoveryConfirmation !== 'RECOVER') throw new Error('復旧を中止しました。');
  }

  const { projectId, auth, db } = await initializeAdmin();
  console.log(`接続先: ${projectId}`);
  const result = await approveAccountRequest({
    auth,
    db,
    organizationId,
    loginId,
    recoverInterrupted,
  });
  console.log('owner承認済みアカウントを発行しました。');
  console.log(`団体ID: ${result.organizationId}`);
  console.log(`ユーザーID: ${result.loginId}`);
  console.log(`表示名: ${result.displayName}`);
  console.log(`権限: ${result.role}`);
  console.log(`一時パスワード（再表示不可）: ${result.temporaryPassword}`);
} catch (error) {
  console.error(`アカウント発行失敗: ${error?.message ?? String(error)}`);
  process.exitCode = 1;
} finally {
  prompt.close();
}
