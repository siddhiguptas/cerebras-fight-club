export type InferenceFailureCode = 'rate_limit' | 'timeout' | 'openclaw' | 'unknown'

export class InferenceError extends Error {
  readonly code: InferenceFailureCode
  readonly retryAfterMs: number

  constructor(message: string, code: InferenceFailureCode, retryAfterMs = 20_000) {
    super(message)
    this.name = 'InferenceError'
    this.code = code
    this.retryAfterMs = retryAfterMs
  }
}

const RATE_LIMIT_MS = Number(process.env.RIVAL_RATE_LIMIT_BACKOFF_MS ?? 22_000)

export function classifyInferenceError(error: unknown): InferenceError {
  const raw =
    error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error ?? 'unknown')
  const text = raw.toLowerCase()

  if (
    text.includes('429') ||
    text.includes('rate limit') ||
    text.includes('rate_limit') ||
    text.includes('too many requests') ||
    text.includes('rpm') ||
    text.includes('tpm') ||
    text.includes('quota')
  ) {
    return new InferenceError(
      'Cerebras rate limit (429) — OpenClaw/Kimi temporarily overloaded',
      'rate_limit',
      RATE_LIMIT_MS,
    )
  }

  if (text.includes('timed out') || text.includes('timeout')) {
    return new InferenceError('OpenClaw request timed out', 'timeout', 12_000)
  }

  if (text.includes('openclaw')) {
    return new InferenceError(raw.split('\n')[0] ?? 'OpenClaw agent failed', 'openclaw', 8_000)
  }

  return new InferenceError(raw.split('\n')[0] ?? 'Inference failed', 'unknown', 10_000)
}

export function httpStatusForInference(code: InferenceFailureCode): number {
  if (code === 'rate_limit') return 429
  if (code === 'timeout') return 504
  return 503
}

export function jsonForInference(error: unknown): {
  status: number
  body: { error: string; code: InferenceFailureCode; retryAfterMs: number }
} {
  const inferred = error instanceof InferenceError ? error : classifyInferenceError(error)
  return {
    status: httpStatusForInference(inferred.code),
    body: {
      error: inferred.message,
      code: inferred.code,
      retryAfterMs: inferred.retryAfterMs,
    },
  }
}