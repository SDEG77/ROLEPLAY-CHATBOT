import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/services/geminiService', () => ({
  isAnyProviderConfigured: vi.fn(() => false),
  isGeminiConfigured: vi.fn(() => false),
  isGroqConfigured: vi.fn(() => false),
}))

const { createApp } = await import('../../src/app')

describe('app feature tests', () => {
  it('serves the root readiness response', async () => {
    const response = await request(createApp()).get('/')

    expect(response.status).toBe(200)
    expect(response.text).toBe('D&D Gemini DM API is ready.')
  })

  it('returns health flags for the AI provider setup', async () => {
    const response = await request(createApp()).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      ok: true,
      aiProviderConfigured: false,
      geminiConfigured: false,
      groqConfigured: false,
    })
  })
})
