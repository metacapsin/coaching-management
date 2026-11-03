// The real contact details and the real words of customers shown on the website.
// Fill these in with true information only. Whatever is left empty is simply not shown on the page.

export const SITE_INFO = {
  company: 'Bytechnik',
  email: '',
  phone: '',
  address: 'Vijay Chowk, Laxmi Nagar, East Delhi, Delhi 110092, India'
};

// The round buttons under the text of the footer. For now each one opens the home page of the site (and Reviews a search for the
// company), not the company's own page. Put the company's own page as url when it is known; an empty url hides the button. key: facebook, x, linkedin, instagram, medium, reviews.
export const SOCIAL: { key: 'facebook' | 'x' | 'linkedin' | 'instagram' | 'medium' | 'reviews'; label: string; url: string }[] = [
  { key: 'facebook', label: 'Facebook', url: 'https://www.facebook.com' },
  { key: 'x', label: 'X', url: 'https://x.com' },
  { key: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com' },
  { key: 'instagram', label: 'Instagram', url: 'https://www.instagram.com' },
  { key: 'medium', label: 'Medium', url: 'https://medium.com' },
  { key: 'reviews', label: 'Reviews', url: 'https://www.google.com/search?q=Bytechnik+reviews' }
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
