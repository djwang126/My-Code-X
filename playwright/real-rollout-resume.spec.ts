import { expect, test } from '@playwright/test';
import { REAL_RESUME_FIXTURE_THREAD_ID } from './fixtures/real-resume-fixture';

test('frontend resumes a real saved Codex rollout through the full app stack', async ({ page }) => {
  test.setTimeout(120_000);

  await page.addInitScript(threadId => {
    window.sessionStorage.setItem('my-code-x-viewer-id', 'fixture-viewer');
    window.sessionStorage.setItem('my-code-x-tab-id', 'fixture-tab');
    window.sessionStorage.setItem('my-code-x-thread-id', threadId);
  }, REAL_RESUME_FIXTURE_THREAD_ID);

  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 120_000 });

  await expect(page.getByRole('heading', { name: 'My code X' })).toBeVisible();
  await expect(page.getByText(`Thread: ${REAL_RESUME_FIXTURE_THREAD_ID}`)).toBeVisible();
  await expect(page.getByRole('log', { name: 'chat transcript' })).toContainText('hi');
  await expect(page.getByRole('log', { name: 'chat transcript' })).toContainText('Hi! 😸 How can I help?');
  await expect(page.getByText('Select a workspace to start chatting')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();
});
