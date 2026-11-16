// The countries of the teacher form and their dial codes (the same list is on the server). India is the first and the usual one: the contact number
// has the dial code of the chosen country before its 10 digits.

export const COUNTRIES: { name: string; code: string }[] = [
  { name: 'India', code: '+91' },
  { name: 'Nepal', code: '+977' },
  { name: 'Bangladesh', code: '+880' },
  { name: 'Sri Lanka', code: '+94' },
  { name: 'Pakistan', code: '+92' },
  { name: 'Bhutan', code: '+975' },
  { name: 'Maldives', code: '+960' },
  { name: 'United Arab Emirates', code: '+971' },
  { name: 'Saudi Arabia', code: '+966' },
  { name: 'Qatar', code: '+974' },
  { name: 'Kuwait', code: '+965' },
  { name: 'Oman', code: '+968' },
  { name: 'Bahrain', code: '+973' },
  { name: 'United States', code: '+1' },
  { name: 'Canada', code: '+1' },
  { name: 'United Kingdom', code: '+44' },
  { name: 'Australia', code: '+61' },
  { name: 'New Zealand', code: '+64' },
  { name: 'Singapore', code: '+65' },
  { name: 'Malaysia', code: '+60' },
  { name: 'Germany', code: '+49' },
  { name: 'France', code: '+33' },
  { name: 'Italy', code: '+39' },
  { name: 'Japan', code: '+81' }
];

export const dialCodeOf = (country: string): string => COUNTRIES.find(c => c.name === country)?.code ?? '+91';

// The country that a postal code shows by its shape, when the shape belongs to one country only: a PIN code of India (6 digits), a postal code of
// Canada (K1A 0B1), of the United Kingdom (SW1A 1AA), a ZIP+4 of the United States (12345-6789) and of Japan (100-0001). A code of 4 or 5 digits
// belongs to many countries, so it says nothing. `current` is the country that is chosen now: when the code fits it, nothing changes (Singapore also
// has 6 digits, so a Singapore teacher stays in Singapore). The answer is the name of the country to choose, or null to leave the choice alone.
export const countryForPostalCode = (code: string, current: string): string | null => {
  const c = code.trim();
  if (/^\d{6}$/.test(c)) return current === 'India' || current === 'Singapore' ? null : 'India';
  if (/^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/.test(c)) return current === 'Canada' ? null : 'Canada';
  if (/^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/.test(c)) return current === 'United Kingdom' ? null : 'United Kingdom';
  if (/^\d{3}-\d{4}$/.test(c)) return current === 'Japan' ? null : 'Japan';
  if (/^\d{5}-\d{4}$/.test(c)) return current === 'United States' ? null : 'United States';
  return null;
};
