type ClerkErrorLike = {
  errors?: Array<{
    message?: unknown
  }>
  message?: unknown
}

function isClerkErrorLike(value: unknown): value is ClerkErrorLike {
  return typeof value === 'object' && value !== null
}

export function getClerkErrorMessage(error: unknown, fallback: string): string {
  if (!isClerkErrorLike(error)) {
    return fallback
  }

  const firstErrorMessage = error.errors?.[0]?.message
  if (typeof firstErrorMessage === 'string' && firstErrorMessage.trim()) {
    return firstErrorMessage
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message
  }

  return fallback
}
