import { describe, expect, it } from 'vitest'
import { classifyInferenceError, httpStatusForInference } from './cerebrasErrors.js'

describe('classifyInferenceError', () => {
  it('detects Cerebras 429 / rate limit text', () => {
    const err = classifyInferenceError(new Error('HTTP 429 Too Many Requests from cerebras'))
    expect(err.code).toBe('rate_limit')
    expect(httpStatusForInference(err.code)).toBe(429)
    expect(err.retryAfterMs).toBeGreaterThan(0)
  })

  it('detects timeouts', () => {
    const err = classifyInferenceError(new Error('OpenClaw request timed out'))
    expect(err.code).toBe('timeout')
    expect(httpStatusForInference(err.code)).toBe(504)
  })
})