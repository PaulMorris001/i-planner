// Same check middleware/errorHandler.ts uses for its own generic duplicate-key
// response — pulled out here so callers that need to *react* to the race
// themselves (rather than just let it fall through to a generic 409) can
// reuse the exact same test.
export function isDuplicateKeyError(err: unknown): boolean {
  return !!err && typeof err === 'object' && 'code' in err && (err as { code: unknown }).code === 11000;
}
