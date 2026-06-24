import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/services/geminiService', () => ({
  generateDungeonMasterReply: vi.fn(),
  extractCampaignMemories: vi.fn(async () => []),
  extractInventoryUpdates: vi.fn(async () => []),
  isAnyProviderConfigured: vi.fn(() => false),
}))

const { createApp } = await import('../../src/app')

function buildAgent() {
  return request.agent(createApp())
}

async function registerUser(agent, suffix = 'owner') {
  const response = await agent.post('/api/auth/register').send({
    name: `User ${suffix}`,
    email: `user-${suffix}@example.com`,
    password: 'StrongPass123!',
  })

  return {
    csrfToken: response.body.csrfToken,
    user: response.body.user,
  }
}

async function createCampaign(agent, csrfToken, overrides = {}) {
  const response = await agent
    .post('/api/campaigns')
    .set('X-CSRF-Token', csrfToken)
    .send({
      title: 'The Crown Below',
      playerName: 'Sigrae',
      characterName: 'Nyra',
      campaignIdea: 'Recover the lost crown from a haunted city.',
      ...overrides,
    })

  return response
}

describe('campaign controller routes', () => {
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY
    delete process.env.GROQ_API_KEY
  })

  it('creates, lists, reads, updates, and deletes a campaign', async () => {
    const agent = buildAgent()
    const { csrfToken } = await registerUser(agent, 'crud-owner')

    const createResponse = await createCampaign(agent, csrfToken)

    expect(createResponse.status).toBe(201)
    expect(createResponse.body.campaign).toMatchObject({
      title: 'The Crown Below',
      playerName: 'Sigrae',
      characterName: 'Nyra',
      campaignIdea: 'Recover the lost crown from a haunted city.',
    })
    expect(createResponse.body.campaign.messages).toHaveLength(1)
    expect(createResponse.body.campaign.memories).toHaveLength(2)

    const createdCampaignId = createResponse.body.campaign._id

    const listResponse = await agent.get('/api/campaigns')

    expect(listResponse.status).toBe(200)
    expect(listResponse.body.campaigns).toHaveLength(1)
    expect(listResponse.body.campaigns[0]).toMatchObject({
      _id: createdCampaignId,
      title: 'The Crown Below',
      messageCount: 1,
      memoryCount: 2,
      inventoryCount: 0,
    })

    const getResponse = await agent.get(`/api/campaigns/${createdCampaignId}`)

    expect(getResponse.status).toBe(200)
    expect(getResponse.body.campaign).toMatchObject({
      _id: createdCampaignId,
      title: 'The Crown Below',
      playerName: 'Sigrae',
      characterName: 'Nyra',
    })

    const updateResponse = await agent
      .put(`/api/campaigns/${createdCampaignId}`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        title: 'The Crown Restored',
        playerName: 'Sigrae',
        characterName: 'Nyra',
        campaignIdea: 'Recover the lost crown and defend the capital.',
        tone: 'Gritty heroic fantasy',
        playStyle: 'Tactical and story-driven',
      })

    expect(updateResponse.status).toBe(200)
    expect(updateResponse.body.campaign).toMatchObject({
      title: 'The Crown Restored',
      tone: 'Gritty heroic fantasy',
      playStyle: 'Tactical and story-driven',
    })

    const deleteResponse = await agent
      .delete(`/api/campaigns/${createdCampaignId}`)
      .set('X-CSRF-Token', csrfToken)

    expect(deleteResponse.status).toBe(200)
    expect(deleteResponse.body).toEqual({
      deletedCampaignId: createdCampaignId,
    })

    const missingResponse = await agent.get(`/api/campaigns/${createdCampaignId}`)
    expect(missingResponse.status).toBe(404)
  })

  it('supports inventory add, update, and delete routes', async () => {
    const agent = buildAgent()
    const { csrfToken } = await registerUser(agent, 'inventory-owner')
    const createResponse = await createCampaign(agent, csrfToken)
    const campaignId = createResponse.body.campaign._id

    const addResponse = await agent
      .post(`/api/campaigns/${campaignId}/inventory`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        name: 'Rope',
        quantity: 2,
        status: 'carried',
        details: '50 ft hemp rope',
      })

    expect(addResponse.status).toBe(201)
    expect(addResponse.body.campaign.inventory).toHaveLength(1)
    const itemId = addResponse.body.campaign.inventory[0]._id

    const updateResponse = await agent
      .put(`/api/campaigns/${campaignId}/inventory/${itemId}`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        name: 'Rope',
        quantity: 3,
        status: 'stored',
        details: 'Stowed in the pack',
      })

    expect(updateResponse.status).toBe(200)
    expect(updateResponse.body.campaign.inventory[0]).toMatchObject({
      _id: itemId,
      name: 'Rope',
      quantity: 3,
      status: 'stored',
      details: 'Stowed in the pack',
    })

    const deleteResponse = await agent
      .delete(`/api/campaigns/${campaignId}/inventory/${itemId}`)
      .set('X-CSRF-Token', csrfToken)

    expect(deleteResponse.status).toBe(200)
    expect(deleteResponse.body.campaign.inventory).toHaveLength(0)
  })

  it('keeps campaign data isolated between owners', async () => {
    const ownerAgent = buildAgent()
    const { csrfToken: ownerCsrfToken } = await registerUser(ownerAgent, 'owner-a')
    const createResponse = await createCampaign(ownerAgent, ownerCsrfToken)
    const campaignId = createResponse.body.campaign._id

    const intruderAgent = buildAgent()
    const { csrfToken: intruderCsrfToken } = await registerUser(intruderAgent, 'owner-b')

    const getResponse = await intruderAgent.get(`/api/campaigns/${campaignId}`)
    const updateResponse = await intruderAgent
      .put(`/api/campaigns/${campaignId}`)
      .set('X-CSRF-Token', intruderCsrfToken)
      .send({
        title: 'Stolen campaign',
        playerName: 'Sigrae',
        characterName: 'Nyra',
        campaignIdea: 'Nope.',
      })

    const deleteResponse = await intruderAgent
      .delete(`/api/campaigns/${campaignId}`)
      .set('X-CSRF-Token', intruderCsrfToken)

    expect(getResponse.status).toBe(404)
    expect(updateResponse.status).toBe(404)
    expect(deleteResponse.status).toBe(404)
  })
})
