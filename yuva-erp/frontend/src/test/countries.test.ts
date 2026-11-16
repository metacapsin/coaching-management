import { describe, expect, it } from 'vitest';
import { countryForPostalCode, dialCodeOf } from '../components/utils/countries';

describe('the country that a postal code shows', () => {
  it('a PIN code of India (6 digits) chooses India, from any other country', () => {
    expect(countryForPostalCode('852127', 'Sri Lanka')).toBe('India');
    expect(countryForPostalCode('852127', 'Nepal')).toBe('India');
    expect(dialCodeOf('India')).toBe('+91');
  });
  it('leaves the choice alone when the code fits the country, or says nothing', () => {
    expect(countryForPostalCode('852127', 'India')).toBeNull();
    expect(countryForPostalCode('852127', 'Singapore')).toBeNull(); // Singapore has 6 digits too
    expect(countryForPostalCode('12345', 'India')).toBeNull(); // 5 digits belong to many countries
    expect(countryForPostalCode('8521', 'India')).toBeNull(); // not finished
  });
  it('knows the codes that belong to one country only', () => {
    expect(countryForPostalCode('K1A 0B1', 'India')).toBe('Canada');
    expect(countryForPostalCode('SW1A 1AA', 'India')).toBe('United Kingdom');
    expect(countryForPostalCode('100-0001', 'India')).toBe('Japan');
    expect(countryForPostalCode('12345-6789', 'India')).toBe('United States');
    expect(countryForPostalCode('K1A 0B1', 'Canada')).toBeNull();
  });
});
