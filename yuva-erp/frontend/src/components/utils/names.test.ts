import { describe, expect, it } from 'vitest';
import { cleanName } from './names';

describe('cleanName', () => {
  it('removes symbols', () => expect(cleanName('Ra@vi# K$umar!')).toBe('Ravi Kumar'));
  it('keeps real names', () => {
    expect(cleanName("D'Souza")).toBe("D'Souza");
    expect(cleanName('Mary-Ann')).toBe('Mary-Ann');
    expect(cleanName('Md. Sahil')).toBe('Md. Sahil');
    expect(cleanName('राहुल शर्मा')).toBe('राहुल शर्मा');
  });
});
