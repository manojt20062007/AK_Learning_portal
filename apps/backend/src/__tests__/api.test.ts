import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@aklms.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@AK2024!';

test('GET /health returns 200 and connected database', async () => {
  const res = await fetch(`${BASE_URL}/health`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { status: string; database: string };
  assert.equal(body.status, 'ok');
  assert.equal(body.database, 'connected');
});

test('GET /api/public/categories returns 200 and array', async () => {
  const res = await fetch(`${BASE_URL}/api/public/categories`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { success: boolean; data: unknown[] };
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
});

test('GET /api/public/certificates/verify/INVALID returns 404', async () => {
  const res = await fetch(`${BASE_URL}/api/public/certificates/verify/INVALID-CODE-999`);
  assert.equal(res.status, 404);
});

test('Protected endpoints reject unauthenticated requests with 401', async () => {
  const [adminRes, studentRes, videoRes] = await Promise.all([
    fetch(`${BASE_URL}/api/admin/dashboard`),
    fetch(`${BASE_URL}/api/student/dashboard`),
    fetch(`${BASE_URL}/api/video/lessons/00000000-0000-0000-0000-000000000000/session`, { method: 'POST' }),
  ]);
  assert.equal(adminRes.status, 401);
  assert.equal(studentRes.status, 401);
  assert.equal(videoRes.status, 401);
});

test('POST /api/auth/login rejects invalid password with 401', async () => {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: 'WrongPassword123!' }),
  });
  assert.equal(res.status, 401);
});

test('Admin login + RBAC + video system-check flow', async () => {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assert.equal(loginRes.status, 200);
  const setCookie = loginRes.headers.get('set-cookie');
  assert.ok(setCookie, 'Session cookie must be set');
  const cookie = setCookie.split(';')[0];

  // Admin dashboard succeeds
  const dashRes = await fetch(`${BASE_URL}/api/admin/dashboard`, {
    headers: { Cookie: cookie },
  });
  assert.equal(dashRes.status, 200);

  // Admin video system-check succeeds
  const sysRes = await fetch(`${BASE_URL}/api/admin/videos/system-check`, {
    headers: { Cookie: cookie },
  });
  assert.equal(sysRes.status, 200);

  // Admin cannot access student-only routes (403 Forbidden)
  const stuRes = await fetch(`${BASE_URL}/api/student/dashboard`, {
    headers: { Cookie: cookie },
  });
  assert.equal(stuRes.status, 403);
});
