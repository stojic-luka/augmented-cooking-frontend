export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (err && typeof err === 'object' && 'message' in err) {
    return String(err.message);
  }
  if (typeof err === 'string') {
    return err;
  }
  return fallback;
}
