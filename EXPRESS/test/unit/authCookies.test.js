const crypto = require('crypto');
const {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  clearAuthCookies,
  getTokenMaxAgeMs,
  setAuthCookies,
  setCsrfCookie,
} = require('../../src/utils/authCookies');

describe('authCookies', () => {
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

  it('uses the configured max age when present', () => {
    process.env.JWT_COOKIE_MAX_AGE_MS = '12345';

    expect(getTokenMaxAgeMs()).toBe(12345);
  });

  it('falls back to the default max age when the env value is missing', () => {
    expect(getTokenMaxAgeMs()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('sets auth and csrf cookies with the expected options', () => {
    const req = { secure: false };
    const res = {
      cookie: vi.fn(),
    };

    process.env.JWT_COOKIE_MAX_AGE_MS = '6000';
    process.env.COOKIE_DOMAIN = 'example.com';
    process.env.COOKIE_SAME_SITE = 'strict';
    randomBytesSpy.mockReturnValue(Buffer.alloc(32, 0x11));

    const csrfToken = setAuthCookies(req, res, 'session-token');

    expect(csrfToken).toBe('1111111111111111111111111111111111111111111111111111111111111111');
    expect(res.cookie).toHaveBeenCalledTimes(2);
    expect(res.cookie).toHaveBeenNthCalledWith(
      1,
      AUTH_COOKIE_NAME,
      'session-token',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        domain: 'example.com',
        path: '/',
        maxAge: 6000,
      }),
    );
    expect(res.cookie).toHaveBeenNthCalledWith(
      2,
      CSRF_COOKIE_NAME,
      csrfToken,
      expect.objectContaining({
        httpOnly: false,
        secure: false,
        sameSite: 'strict',
        domain: 'example.com',
        path: '/',
        maxAge: 6000,
      }),
    );
  });

  it('sets a standalone csrf cookie and clears both cookies', () => {
    const req = { secure: true };
    const res = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    };

    randomBytesSpy.mockReturnValue(Buffer.alloc(32, 0x22));

    const csrfToken = setCsrfCookie(req, res);
    clearAuthCookies(req, res);

    expect(csrfToken).toBe('2222222222222222222222222222222222222222222222222222222222222222');
    expect(res.cookie).toHaveBeenCalledWith(
      CSRF_COOKIE_NAME,
      csrfToken,
      expect.objectContaining({
        httpOnly: false,
        secure: true,
      }),
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAME,
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        path: '/',
      }),
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      CSRF_COOKIE_NAME,
      expect.objectContaining({
        httpOnly: false,
        secure: true,
        path: '/',
      }),
    );
  });
});
