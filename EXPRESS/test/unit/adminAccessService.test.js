const {
  createAdminEntryGrant,
  createAdminSessionToken,
  getClientOrigin,
  validateAdminKeyFile,
  verifyAdminEntryGrant,
  verifyAdminSessionToken,
} = require('../../src/services/adminAccessService');
const { encryptAdminKeyPayload } = require('../../src/utils/adminKeyCrypto');

describe('adminAccessService', () => {
  afterEach(() => {
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.ADMIN_ENTRY_SECRET;
    delete process.env.ADMIN_KEY_SECRET;
    delete process.env.CLIENT_ORIGIN;
    delete process.env.ADMIN_ENTRY_EXPIRES_IN;
    delete process.env.ADMIN_SESSION_EXPIRES_IN;
  });

  it('returns the configured client origin and a sensible default', () => {
    delete process.env.CLIENT_ORIGIN;
    expect(getClientOrigin()).toBe('http://localhost:5173');

    process.env.CLIENT_ORIGIN = 'https://example.com';
    expect(getClientOrigin()).toBe('https://example.com');
  });

  it('creates and verifies an admin unlock grant', () => {
    process.env.ADMIN_ENTRY_SECRET = 'entry-secret-for-tests';
    process.env.ADMIN_ENTRY_EXPIRES_IN = '1h';

    const token = createAdminEntryGrant();
    const payload = verifyAdminEntryGrant(token);

    expect(payload).toMatchObject({
      purpose: 'admin-unlock',
    });
    expect(payload.nonce).toEqual(expect.any(String));
  });

  it('creates and verifies an admin session token', () => {
    process.env.ADMIN_SESSION_SECRET = 'session-secret-for-tests';
    process.env.ADMIN_SESSION_EXPIRES_IN = '1h';

    const token = createAdminSessionToken({
      label: 'Owner',
      keyId: 'admin-owner',
    });
    const payload = verifyAdminSessionToken(token);

    expect(payload).toMatchObject({
      role: 'admin',
      label: 'Owner',
      keyId: 'admin-owner',
      sub: 'admin-owner',
    });
  });

  it('validates an encrypted admin key file payload', () => {
    process.env.ADMIN_KEY_SECRET = 'shared-admin-secret';

    const encrypted = encryptAdminKeyPayload(
      {
        secret: 'shared-admin-secret',
        label: 'Owner',
        keyId: 'admin-owner',
        createdAt: '2026-06-24T00:00:00.000Z',
      },
      'super-secure-passphrase',
    );

    expect(
      validateAdminKeyFile({
        keyFile: encrypted,
        passphrase: 'super-secure-passphrase',
      }),
    ).toEqual({
      label: 'Owner',
      keyId: 'admin-owner',
      createdAt: '2026-06-24T00:00:00.000Z',
    });
  });

  it('rejects admin key files with the wrong shared secret', () => {
    process.env.ADMIN_KEY_SECRET = 'shared-admin-secret';

    const encrypted = encryptAdminKeyPayload(
      {
        secret: 'different-secret',
        label: 'Owner',
        keyId: 'admin-owner',
        createdAt: '2026-06-24T00:00:00.000Z',
      },
      'super-secure-passphrase',
    );

    expect(() =>
      validateAdminKeyFile({
        keyFile: encrypted,
        passphrase: 'super-secure-passphrase',
      }),
    ).toThrow('Admin key validation failed.');
  });
});
