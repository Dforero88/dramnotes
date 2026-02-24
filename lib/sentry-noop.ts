export function init() {
  // no-op in local/dev
}

export function captureException(_error: unknown): string {
  return ''
}

export function captureMessage(_message: string, _context?: unknown): string {
  return ''
}

export async function flush(_timeout?: number): Promise<boolean> {
  return true
}

