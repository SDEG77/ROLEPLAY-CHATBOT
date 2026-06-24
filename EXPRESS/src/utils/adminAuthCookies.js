const crypto = require('crypto');
const { getTokenMaxAgeMs } = require('./authCookies');

const ADMIN_AUTH_COOKIE_NAME = 'dnd_dm_admin';
const ADMIN_CSRF_COOKIE_NAME = 'dnd_dm_admin_csrf';

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

function createCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setAdminAuthCookies(req, res, token) {
  const csrfToken = createCsrfToken();
  const baseOptions = getBaseCookieOptions(req);

  res.cookie(ADMIN_AUTH_COOKIE_NAME, token, {
    ...baseOptions,
    maxAge: getTokenMaxAgeMs(),
  });

  res.cookie(ADMIN_CSRF_COOKIE_NAME, csrfToken, {
    ...baseOptions,
    httpOnly: false,
    maxAge: getTokenMaxAgeMs(),
  });

  return csrfToken;
}

function setAdminCsrfCookie(req, res) {
  const csrfToken = createCsrfToken();
  const baseOptions = getBaseCookieOptions(req);

  res.cookie(ADMIN_CSRF_COOKIE_NAME, csrfToken, {
    ...baseOptions,
    httpOnly: false,
    maxAge: getTokenMaxAgeMs(),
  });

  return csrfToken;
}

function clearAdminAuthCookies(req, res) {
  const baseOptions = getBaseCookieOptions(req);
  res.clearCookie(ADMIN_AUTH_COOKIE_NAME, baseOptions);
  res.clearCookie(ADMIN_CSRF_COOKIE_NAME, {
    ...baseOptions,
    httpOnly: false,
  });
}

module.exports = {
  ADMIN_AUTH_COOKIE_NAME,
  ADMIN_CSRF_COOKIE_NAME,
  clearAdminAuthCookies,
  setAdminAuthCookies,
  setAdminCsrfCookie,
};
