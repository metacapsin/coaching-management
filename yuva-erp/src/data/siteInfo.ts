// The real contact details and the real words of customers shown on the website.
// Fill these in with true information only. Whatever is left empty is simply not shown on the page.

export const SITE_INFO = {
  company: 'Bytechnik',
  email: '',
  phone: '',
  address: 'Vijay Chowk, Laxmi Nagar, East Delhi, Delhi 110092, India'
};

// The round buttons under the text of the footer. Only the ones with a real address (url) are shown, so fill in the
// pages of the company and leave the others empty. key: facebook, x, linkedin, instagram, medium, reviews.
export const SOCIAL: { key: 'facebook' | 'x' | 'linkedin' | 'instagram' | 'medium' | 'reviews'; label: string; url: string }[] = [
  { key: 'facebook', label: 'Facebook', url: '' },
  { key: 'x', label: 'X', url: '' },
  { key: 'linkedin', label: 'LinkedIn', url: '' },
  { key: 'instagram', label: 'Instagram', url: '' },
  { key: 'medium', label: 'Medium', url: '' },
  { key: 'reviews', label: 'Reviews', url: '' }
];

// Real quotes of real coachings (with their permission). While this list is empty the page shows no testimonials.
export const TESTIMONIALS: { quote: string; name: string; role: string }[] = [];

// Screenshots of the real app for the gallery of the website (files in public/screens). Empty = no gallery.
export const SCREENSHOTS: { file: string; title: string; text: string }[] = [
  { file: '/screens/dashboard.png', title: 'Dashboard', text: 'Today’s fees, absentees, admissions and the attendance of the last seven days on one page.' },
  { file: '/screens/attendance.png', title: 'Daily attendance', text: 'The roll call of a batch: present, absent, late or excused with one tap.' },
  { file: '/screens/fees.png', title: 'Fees and receipts', text: 'Every receipt, the pending dues and the total collected, with search and CSV download.' },
  { file: '/screens/students.png', title: 'Admissions and students', text: 'All students with their batch, fee status and contact, ready to search and filter.' }
];
