import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { initializeAdmin } from './admin-config.mjs';
import { linkOwnerToOrganization } from './owner-organization-link.mjs';
import { validateId } from './admin-utils.mjs';

const prompt = createInterface({ input, output });

try {
  const loginId = validateId(
    await prompt.question('既存ownerのユーザーID: '),
    'ユーザーID',
  );
  const organizationId = validateId(
    await prompt.question('追加で紐づける団体ID: '),
    '団体ID',
  );
  const confirmation = await prompt.question(
    `${loginId}を${organizationId}のownerとして紐づけます。LINKと入力: `,
  );
  if (confirmation !== 'LINK') throw new Error('紐づけを中止しました。');

  const { projectId, db } = await initializeAdmin();
  console.log(`接続先: ${projectId}`);
  const result = await linkOwnerToOrganization({ db, loginId, organizationId });
  console.log(result.alreadyLinked
    ? '既に同じowner紐づけがあり、団体一覧だけを整合しました。'
    : 'ownerを団体へ紐づけました。');
  console.log(`団体ID: ${result.organizationId}`);
  console.log(`ユーザーID: ${result.loginId}`);
} catch (error) {
  console.error(`owner紐づけ失敗: ${error?.message ?? String(error)}`);
  process.exitCode = 1;
} finally {
  prompt.close();
}
