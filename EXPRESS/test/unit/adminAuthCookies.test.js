const crypto = require('crypto');
const {
  ADMIN_AUTH_COOKIE_NAME,
  ADMIN_CSRF_COOKIE_NAME,
  clearAdminAuthCookies,
  setAdminAuthCookies,
  setAdminCsrfCookie,
} = require('../../src/utils/adminAuthCookies');

describe('adminAuthCookies', () => {
  let randomBytesSpy;

  beforeEach(() => {
    randomBytesSpy = vi.spyOn(crypto, 'randomBytes');
  });

  afterEach(() => {
    delete process.env.JWT_COOKIE_MAX_AGE_MS;
    delete process.env.COOKIE_DOMAIN;
    delete process.env.COOKIE_SAME_SITE;
    delete process.env.COOKIE_SECURE;
    randomBytesSpy.mockRestore();
  });

  it('sets admin auth and csrf cookies with shared base options', () => {
    const req = { secure: false };
    const res = {
      cookie: vi.fn(),
    };

    process.env.JWT_COOKIE_MAX_AGE_MS = '12000';
    process.env.COOKIE_DOMAIN = 'admin.example.com';
    process.env.COOKIE_SAME_SITE = 'lax';
    randomBytesSpy.mockReturnValue(Buffer.alloc(32, 0x33));

    const csrfToken = setAdminAuthCookies(req, res, 'admin-session-token');

    expect(csrfToken).toBe('3333333333333333333333333333333333333333333333333333333333333333');
    expect(res.cookie).toHaveBeenCalledTimes(2);
    expect(res.cookie).toHaveBeenNthCalledWith(
      1,
      ADMIN_AUTH_COOKIE_NAME,
      'admin-session-token',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        domain: 'admin.example.com',
        path: '/',
        maxAge: 12000,
      }),
    );
    expect(res.cookie).toHaveBeenNthCalledWith(
      2,
      ADMIN_CSRF_COOKIE_NAME,
      csrfToken,
      expect.objectContaining({
        httpOnly: false,
        secure: false,
        sameSite: 'lax',
        domain: 'admin.example.com',
        path: '/',
        maxAge: 12000,
      }),
    );
  });

  it('can issue and clear only the admin csrf cookie', () => {
    const req = { secure: true };
    const res = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    };

    randomBytesSpy.mockReturnValue(Buffer.alloc(32, 0x44));

    const csrfToken = setAdminCsrfCookie(req, res);
    clearAdminAuthCookies(req, res);

    expect(csrfToken).toBe('4444444444444444444444444444444444444444444444444444444444444444');
    expect(res.cookie).toHaveBeenCalledWith(
      ADMIN_CSRF_COOKIE_NAME,
      csrfToken,
      expect.objectContaining({
        httpOnly: false,
        secure: true,
      }),
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      ADMIN_AUTH_COOKIE_NAME,
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        path: '/',
      }),
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      ADMIN_CSRF_COOKIE_NAME,
      expect.objectContaining({
        httpOnly: false,
        secure: true,
        path: '/',
      }),
    );
  });
});
