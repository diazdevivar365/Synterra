// Forgentic (codename: Synterra) — E2E smoke suite.
//
// Contract: these tests document the minimum viable front door for the web
// app. They WILL FAIL until `apps/web` lands in W0-1 §G — that is intentional.
// They exist now so that the moment the web app boots, CI catches any
// regression against these two invariants without waiting for bespoke tests.
//
// Invariants:
// 1. `/` serves an HTML document whose <title> contains the brand.
// 2. `GET /api/health` responds 200 with a JSON payload shaped
//    `{ status: 'ok', version: string, uptime: number }`.

import { expect, test } from '@playwright/test';

test.describe('smoke — public surface', () => {
  test('home page loads and the brand appears in the document title', async ({ page }) => {
    const response = await page.goto('/');
    expect(response, 'navigation to / returned no response').not.toBeNull();
    expect(response!.ok(), `unexpected status ${response!.status()}`).toBeTruthy();

    await expect(page).toHaveTitle(/Forgentic/i);
  });

  test('/api/health returns { status: "ok", version, uptime }', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status(), 'health endpoint must be 200').toBe(200);

    const contentType = res.headers()['content-type'] ?? '';
    expect(contentType, 'health endpoint must advertise JSON').toMatch(/application\/json/);

    const body = (await res.json()) as { status?: unknown; version?: unknown; uptime?: unknown };

    expect(body.status, 'status field must be "ok"').toBe('ok');
    expect(typeof body.version, 'version must be a string').toBe('string');
    expect(typeof body.uptime, 'uptime must be a number').toBe('number');
    expect(body.uptime as number).toBeGreaterThanOrEqual(0);
  });
});
