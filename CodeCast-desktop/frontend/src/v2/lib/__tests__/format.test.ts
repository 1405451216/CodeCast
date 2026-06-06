// frontend/src/v2/lib/__tests__/format.test.ts
import { describe, it, expect } from 'vitest';
import { formatWailsError } from '../format';

describe('formatWailsError', () => {
  it('null/undefined → "unknown error"', () => {
    expect(formatWailsError(null)).toBe('unknown error');
    expect(formatWailsError(undefined)).toBe('unknown error');
  });
  it('string passthrough', () => {
    expect(formatWailsError('boom')).toBe('boom');
  });
  it('Error.message', () => {
    expect(formatWailsError(new Error('x'))).toBe('x');
  });
  it('object { message }', () => {
    expect(formatWailsError({ message: 'm' })).toBe('m');
  });
  it('object { error }', () => {
    expect(formatWailsError({ error: 'e' })).toBe('e');
  });
  it('object { data }', () => {
    expect(formatWailsError({ data: 'd' })).toBe('d');
  });
  it('object without known field → JSON', () => {
    expect(formatWailsError({ foo: 1 })).toBe('{"foo":1}');
  });
});
