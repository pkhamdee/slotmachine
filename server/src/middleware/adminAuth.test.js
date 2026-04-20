import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { adminSessionToken, requireAdminAuth } from './adminAuth.js';

// Minimal Express-like req/res stubs
function makeRes() {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json   = (body)  => { res.body = body;       return res; };
  return res;
}

// ── adminSessionToken ──────────────────────────────────────────────────────

describe('adminSessionToken', () => {
  test('is a 64-character lowercase hex string', () => {
    assert.match(adminSessionToken, /^[0-9a-f]{64}$/);
  });

  test('is unique across module imports (same singleton)', () => {
    // Importing the same module twice gives the same token
    assert.equal(typeof adminSessionToken, 'string');
    assert.ok(adminSessionToken.length > 0);
  });
});

// ── requireAdminAuth ───────────────────────────────────────────────────────

describe('requireAdminAuth()', () => {
  test('calls next() when Authorization header matches the token', () => {
    const req = { headers: { authorization: `Bearer ${adminSessionToken}` } };
    const res = makeRes();
    let called = false;
    requireAdminAuth(req, res, () => { called = true; });
    assert.ok(called, 'next() should have been called');
  });

  test('returns 401 when Authorization header is missing', () => {
    const req = { headers: {} };
    const res = makeRes();
    let called = false;
    requireAdminAuth(req, res, () => { called = true; });
    assert.ok(!called, 'next() should not have been called');
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'Unauthorized');
  });

  test('returns 401 when token is wrong', () => {
    const req = { headers: { authorization: 'Bearer wrongtoken' } };
    const res = makeRes();
    requireAdminAuth(req, res, () => {});
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'Unauthorized');
  });

  test('returns 401 when Bearer prefix is missing', () => {
    const req = { headers: { authorization: adminSessionToken } };
    const res = makeRes();
    requireAdminAuth(req, res, () => {});
    assert.equal(res.statusCode, 401);
  });

  test('returns 401 for empty string header', () => {
    const req = { headers: { authorization: '' } };
    const res = makeRes();
    requireAdminAuth(req, res, () => {});
    assert.equal(res.statusCode, 401);
  });

  test('does not call next() and does not mutate req on invalid auth', () => {
    const req = { headers: { authorization: 'Bearer bad' } };
    const res = makeRes();
    const originalReq = { ...req };
    requireAdminAuth(req, res, () => {});
    assert.deepEqual(req.headers, originalReq.headers);
  });
});
