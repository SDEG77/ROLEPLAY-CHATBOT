const crypto = require('crypto');

const AUTH_COOKIE_NAME = 'dnd_dm_auth';
const CSRF_COOKIE_NAME = 'dnd_dm_csrf';

function getCookieDomain() {
  return process.env.COOKIE_DOMAIN || undefined;
}

function getConfiguredCookieSameSite() {
  return process.env.COOKIE_SAME_SITE || '';
}

function getConfiguredCookieSecure() {
  if (process.env.COOKIE_SECURE === 'true') {
    return true;
  }

  if (process.env.COOKIE_SECURE === 'false') {
    return false;
  }

  return null;
}

function isProductionEnv() {
  return process.env.NODE_ENV === 'production';
}

function getCookieSameSite() {
  const configuredSameSite = getConfiguredCookieSameSite();

  if (configuredSameSite) {
    return configuredSameSite;
  }

  return isProductionEnv() ? 'none' : 'lax';
}

function useSecureCookies(req) {
  const configuredSecure = getConfiguredCookieSecure();

  if (configuredSecure !== null) {
    return configuredSecure;
  }

  return isProductionEnv() || req.secure;
}

function getBaseCookieOptions(req) {
  return {
    httpOnly: true,
    secure: useSecureCookies(req),
    sameSite: getCookieSameSite(req),
    domain: getCookieDomain(),
    path: '/',
  };
}

function getAuthCookieOptions(req) {
  return {
    ...getBaseCookieOptions(req),
    maxAge: getTokenMaxAgeMs(),
  };
}

function getCsrfCookieOptions(req) {
  return {
    ...getBaseCookieOptions(req),
    httpOnly: false,
    maxAge: getTokenMaxAgeMs(),
  };
}

function getClearCookieOptions(req) {
  return {
    ...getBaseCookieOptions(req),
  };
}

function getTokenMaxAgeMs() {
  const envValue = Number(process.env.JWT_COOKIE_MAX_AGE_MS);

  if (Number.isFinite(envValue) && envValue > 0) {
    return envValue;
  }

  return 7 * 24 * 60 * 60 * 1000;
}

function createCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setAuthCookies(req, res, token) {
  const csrfToken = createCsrfToken();

  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions(req));
  res.cookie(CSRF_COOKIE_NAME, csrfToken, getCsrfCookieOptions(req));

  return csrfToken;
}

function setCsrfCookie(req, res) {
  const csrfToken = createCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, csrfToken, getCsrfCookieOptions(req));
  return csrfToken;
}

function clearAuthCookies(req, res) {
  const clearOptions = getClearCookieOptions(req);
  res.clearCookie(AUTH_COOKIE_NAME, clearOptions);
  res.clearCookie(CSRF_COOKIE_NAME, {
    ...clearOptions,
    httpOnly: false,
  });
}

module.exports = {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  clearAuthCookies,
  getTokenMaxAgeMs,
  setCsrfCookie,
  setAuthCookies,
};
