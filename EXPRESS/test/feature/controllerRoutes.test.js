import request from 'supertest'
import { describe, expect, it } from 'vitest'
import Campaign from '../../src/models/Campaign'
import User from '../../src/models/User'
import {
  createAdminEntryGrant,
  createAdminSessionToken,
} from '../../src/services/adminAccessService'
import { encryptAdminKeyPayload } from '../../src/utils/adminKeyCrypto'

const { createApp } = await import('../../src/app')

function buildAgent() {
  return request.agent(createApp())
}

async function registerUser(agent, overrides = {}) {
  const response = await agent.post('/api/auth/register').send({
    name: 'Sigrae',
    email: 'sigrae@example.com',
    password: 'StrongPass123!',
    ...overrides,
  })

  return response
}

describe('controller routes', () => {
  afterEach(() => {
    delete process.env.ADMIN_SESSION_SECRET
    delete process.env.ADMIN_ENTRY_SECRET
    delete process.env.ADMIN_KEY_SECRET
    delete process.env.CLIENT_ORIGIN
  })

  it('logs in an existing user and returns auth cookies', async () => {
    const agent = buildAgent()
    await registerUser(agent)

    const response = await agent.post('/api/auth/login').send({
      email: 'sigrae@example.com',
      password: 'StrongPass123!',
    })

    expect(response.status).toBe(200)
    expect(response.body.user).toMatchObject({
      name: 'Sigrae',
      email: 'sigrae@example.com',
    })
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('dnd_dm_auth='),
        expect.stringContaining('dnd_dm_csrf='),
      ]),
    )
  })

  it('redirects the admin entry route with a grant token', async () => {
    process.env.ADMIN_ENTRY_SECRET = 'entry-secret-for-tests'
    process.env.CLIENT_ORIGIN = 'https://example.com'

    const response = await request(createApp()).get('/endmin')

    expect(response.status).toBe(302)
    expect(response.headers.location).toContain('https://example.com/endmin?grant=')
  })

  it('returns the admin session when a valid admin cookie is present', async () => {
    process.env.ADMIN_SESSION_SECRET = 'session-secret-for-tests'

    const adminToken = createAdminSessionToken({
      label: 'Owner',
      keyId: 'admin-owner',
    })

    const response = await request(createApp())
      .get('/api/admin/session')
      .set('Cookie', `dnd_dm_admin=${adminToken}`)

    expect(response.status).toBe(200)
    expect(response.body.admin).toEqual({
      role: 'admin',
      label: 'Owner',
      keyId: 'admin-owner',
    })
    expect(response.body.csrfToken).toBeTruthy()
  })

  it('lists admin users in newest-first order', async () => {
    process.env.ADMIN_SESSION_SECRET = 'session-secret-for-tests'

    const adminToken = createAdminSessionToken({
      label: 'Owner',
      keyId: 'admin-owner',
    })

    await User.create([
      {
        name: 'Older',
        email: 'older@example.com',
        passwordHash: 'hash-older',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        name: 'Newer',
        email: 'newer@example.com',
        passwordHash: 'hash-newer',
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
        updatedAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    ])

    const response = await request(createApp())
      .get('/api/admin/users')
      .set('Cookie', `dnd_dm_admin=${adminToken}`)

    expect(response.status).toBe(200)
    expect(response.body.totalUsers).toBe(2)
    expect(response.body.users[0].email).toBe('newer@example.com')
    expect(response.body.users[1].email).toBe('older@example.com')
  })

  it('returns admin metrics for stored users and campaigns', async () => {
    process.env.ADMIN_SESSION_SECRET = 'session-secret-for-tests'

    const adminToken = createAdminSessionToken({
      label: 'Owner',
      keyId: 'admin-owner',
    })

    const user = await User.create({
      name: 'Sigrae',
      email: 'sigrae@example.com',
      passwordHash: 'hash-sigrae',
    })

    await Campaign.create({
      owner: user._id,
      title: 'The Crown Below',
      playerName: 'Sigrae',
      characterName: 'Nyra',
      campaignIdea: 'Recover the lost crown.',
      messages: [
        { role: 'user', content: 'We move forward.' },
        { role: 'assistant', content: 'The cave answers with a rumble.' },
      ],
    })

    const response = await request(createApp())
      .get('/api/admin/metrics')
      .set('Cookie', `dnd_dm_admin=${adminToken}`)

    expect(response.status).toBe(200)
    expect(response.body.totals.users).toBe(1)
    expect(response.body.totals.campaigns).toBe(1)
    expect(response.body.totals.messages).toBe(2)
  })

  it('unlocks an admin session with a valid grant and encrypted key file', async () => {
    process.env.ADMIN_SESSION_SECRET = 'session-secret-for-tests'
    process.env.ADMIN_ENTRY_SECRET = 'entry-secret-for-tests'
    process.env.ADMIN_KEY_SECRET = 'shared-admin-secret'

    const grantToken = createAdminEntryGrant()

    const keyFile = encryptAdminKeyPayload(
      {
        secret: 'shared-admin-secret',
        label: 'Owner',
        keyId: 'admin-owner',
        createdAt: '2026-06-24T00:00:00.000Z',
      },
      'super-secure-passphrase',
    )

    const response = await request(createApp()).post('/api/admin/session/unlock').send({
      grantToken,
      keyFile,
      passphrase: 'super-secure-passphrase',
    })

    expect(response.status).toBe(200)
    expect(response.body.admin).toMatchObject({
      role: 'admin',
      label: 'Owner',
      keyId: 'admin-owner',
    })
    expect(response.body.csrfToken).toBeTruthy()
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('dnd_dm_admin='),
        expect.stringContaining('dnd_dm_admin_csrf='),
      ]),
    )
  })
})
