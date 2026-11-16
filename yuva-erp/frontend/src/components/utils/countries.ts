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
