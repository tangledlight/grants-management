/** Public-deployment checks. Network guards reject every API mutation. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL || 'https://grants-management.vercel.app';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(30000);
const errors = [], writes = [];
page.on('pageerror', e => errors.push(e.message));
await page.route('**/api/**', route => {
  if (route.request().method() === 'GET') return route.continue();
  writes.push(route.request().method() + ' ' + new URL(route.request().url()).pathname);
  return route.abort();
});
try {
  const response = await page.goto(base);
  assert.equal(response.status(), 200);
  await page.getByRole('heading', { name: 'Your funding, in focus.' }).waitFor();
  assert.equal(await page.locator('article').filter({ has: page.getByRole('heading', { name: 'Neighborhood Community Project Grant', exact: true }) }).count(), 0);
  await page.getByRole('button', { name: 'Create grant', exact: true }).click();
  assert.equal(await page.getByLabel('Title *', { exact: true }).inputValue(), 'Neighborhood Community Project Grant');
  assert.equal(await page.getByLabel('Assigned reviewer', { exact: true }).locator('option').count(), 2);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Assigned to me', exact: true }).click();
  await page.getByText('No grants are assigned to you.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'View all grants', exact: true }).click();
  await page.getByLabel('Search grant titles').fill('no-such-demo-grant-987654321');
  await page.getByText('No grants match your search. Try another keyword.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  console.log('Public access, creation prefill, ownership filters and empty states passed.');

  await page.getByRole('button', { name: 'Review queue', exact: true }).click();
  await page.getByText('You’re all caught up. No applications need your decision.', { exact: true }).waitFor();
  console.log('The live-demo baseline starts with an empty review queue.');

  await page.getByLabel('Mode', { exact: true }).selectOption('applicant');
  const arts = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Community Arts Fund', exact: true }) });
  await arts.getByRole('button', { name: 'View grant', exact: true }).click();
  assert.ok(!(await page.locator('main').innerText()).includes('Total funding budget'));
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.getByLabel('Email *', { exact: true }).waitFor();
  await page.getByLabel('Requested funding (USD) *', { exact: true }).waitFor();
  assert.equal(await page.locator('input[type=file]').count(), 3);
  await page.getByText('No documents uploaded. Add the required files before submitting.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByLabel('Demo user', { exact: true }).selectOption('00000000-0000-0000-0000-000000000004');
  await page.getByRole('button', { name: 'My Applications', exact: true }).click();
  await page.getByRole('button', { name: 'Community Arts Fund', exact: true }).click();
  await page.getByRole('heading', { name: 'Submitted information', exact: true }).waitFor();
  const text = await page.locator('main').innerText();
  for (const amount of ['$20,000.00','$5,000.00','$15,000.00']) assert.ok(text.includes(amount), `Missing ${amount}`);
  assert.ok(!text.includes('Synthetic demo decision.'));
  assert.ok(!text.includes('Total funding budget'));
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'sample-proposal.pdf', exact: true }).click();
  assert.equal((await downloadPromise).suggestedFilename(), 'sample-proposal.pdf');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile layout must fit viewport');
  await page.reload();
  await page.getByRole('heading', { name: 'Your funding, in focus.' }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile dashboard must fit viewport');
  assert.deepEqual(writes, [], 'Public smoke test must not attempt API mutations');
  assert.deepEqual(errors, [], 'No browser JavaScript errors');
  console.log('Applicant forms, award balances, privacy, private download, reload and mobile layout passed.');
  console.log('Public browser checks passed with zero API mutations.');
} finally { await browser.close(); }
