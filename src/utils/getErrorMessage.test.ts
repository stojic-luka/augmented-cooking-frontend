import { describe, expect, it } from 'vitest';
import { getErrorMessage } from './getErrorMessage';

describe('getErrorMessage', () => {
  it('unwraps Error instances, {message} objects, and raw strings', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage({ message: 'from object' })).toBe('from object');
    expect(getErrorMessage('plain string')).toBe('plain string');
  });

  it('falls back when nothing usable is present', () => {
    expect(getErrorMessage(null)).toBe('Something went wrong. Please try again.');
    expect(getErrorMessage(undefined, 'Custom')).toBe('Custom');
    expect(getErrorMessage(42)).toBe('Something went wrong. Please try again.');
  });
});
