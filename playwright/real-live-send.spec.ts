import { expect, test } from '@playwright/test';

test.skip(process.env.RUN_REAL_CODEX_LIVE !== '1', 'Set RUN_REAL_CODEX_LIVE=1 to run the real Codex live-send smoke test.');

const idleShutdownMinutes = Number.parseFloat(process.env.MY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES || '0.03');
const idleWaitMs = Math.max(4_000, Math.ceil(idleShutdownMinutes * 60_000 * 2));
const liveWorkspacePath = 'D:/repos/My-Code-X-B';

test('frontend can send a real hi message through Codex', async ({ page }) => {
  test.setTimeout(180_000);

  await page.addInitScript(workspacePath => {
    window.sessionStorage.clear();
    window.localStorage.setItem(
      'my-code-x-saved-workspaces',
      JSON.stringify([
        {
          path: workspacePath,
          label: 'My-Code-X-B',
          lastThreadId: '',
        },
      ]),
    );
    window.sessionStorage.setItem('my-code-x-active-workspace', workspacePath);
  }, liveWorkspacePath);

  await page.goto('/');

  const composer = page.getByRole('textbox', { name: 'chat input' });
  const sendButton = page.getByRole('button', { name: 'Send' });

  await expect(page.getByRole('heading', { name: 'My code X' })).toBeVisible();
  await expect(sendButton).toBeEnabled();

  await composer.fill('hi');
  await sendButton.click();

  await expect(sendButton).toBeDisabled();
  await expect(page.getByText(/^Thread: (?!新会话$).+/)).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole('log', { name: 'chat transcript' })).toContainText('hi', { timeout: 120_000 });
  await expect(page.locator('article[aria-label="assistant message"]').last()).toBeVisible({ timeout: 120_000 });
  await expect(sendButton).toBeEnabled({ timeout: 120_000 });
});

test('frontend captures real idle-recovery latency for the first send after idle shutdown', async ({ page }, testInfo) => {
  test.setTimeout(240_000);

  await page.addInitScript(workspacePath => {
    window.localStorage.setItem('my-code-x-debug-stream-timing', '1');
    window.sessionStorage.clear();
    window.sessionStorage.setItem('my-code-x-debug-stream-timing', '1');
    window.localStorage.setItem(
      'my-code-x-saved-workspaces',
      JSON.stringify([
        {
          path: workspacePath,
          label: 'My-Code-X-B',
          lastThreadId: '',
        },
      ]),
    );
    window.sessionStorage.setItem('my-code-x-active-workspace', workspacePath);
  }, liveWorkspacePath);

  await page.goto('/');

  const composer = page.getByRole('textbox', { name: 'chat input' });
  const sendButton = page.getByRole('button', { name: 'Send' });
  const transcript = page.getByRole('log', { name: 'chat transcript' });
  const assistantMessages = page.locator('article[aria-label="assistant message"]');

  await expect(sendButton).toBeEnabled();

  await composer.fill('请简单回复 ready');
  await sendButton.click();

  await expect(transcript).toContainText('请简单回复 ready', { timeout: 120_000 });
  await expect(assistantMessages.last()).toBeVisible({ timeout: 120_000 });
  await expect(sendButton).toBeEnabled({ timeout: 120_000 });

  const assistantCountBeforeIdle = await assistantMessages.count();

  await page.waitForTimeout(idleWaitMs);

  const sendRequestPromise = page.waitForResponse(
    response =>
      response.url().includes('/api/v2/chat/message') &&
      response.request().method() === 'POST' &&
      response.status() === 200,
    { timeout: 120_000 },
  );

  const sendStartedAt = Date.now();
  await composer.fill('idle latency probe');
  await sendButton.click();

  const sendResponse = await sendRequestPromise;
  const requestAcceptedAt = Date.now();

  await expect
    .poll(async () => await assistantMessages.count(), {
      timeout: 120_000,
      message: 'expected the second send to create a new assistant message after idle recovery',
    })
    .toBeGreaterThan(assistantCountBeforeIdle);
  const firstAssistantVisibleAt = Date.now();

  await expect(sendButton).toBeEnabled({ timeout: 120_000 });
  const turnCompletedAt = Date.now();

  const report = {
    workspace: liveWorkspacePath,
    idleShutdownMinutes,
    idleWaitMs,
    messageRequestStatus: sendResponse.status(),
    timingsMs: {
      requestAccepted: requestAcceptedAt - sendStartedAt,
      firstAssistantVisible: firstAssistantVisibleAt - sendStartedAt,
      turnCompleted: turnCompletedAt - sendStartedAt,
    },
  };

  console.info('[real-live-idle-recovery-latency]', JSON.stringify(report));
  await testInfo.attach('real-live-idle-recovery-latency.json', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });
});
