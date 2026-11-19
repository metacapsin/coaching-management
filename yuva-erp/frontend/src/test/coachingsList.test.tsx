import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

// The sign in form of the top part reads the sign in state: a fake one
const auth = { signIn: vi.fn(), signUp: vi.fn(), registerStudent: vi.fn(), registerTeacher: vi.fn(), hasUsers: true, hasSuper: true };
vi.mock('../Context/AuthContext', () => ({ useAuth: () => auth }));

// The list of the coachings that the home page asks the server for (the number is changed in each test)
let total = 3;
vi.mock('../components/utils/api', async importOriginal => {
  const real = await importOriginal<typeof import('../components/utils/api')>();
  return {
    ...real,
    listCoachings: () =>
      Promise.resolve(
        Array.from({ length: total }, (_, i) => ({
          id: `c${i + 1}`,
          name: `Coaching ${i + 1}`,
          city: `City ${i + 1}`,
          principalName: `Owner ${i + 1}`,
          phone: '',
          email: '',
          logoUrl: ''
        }))
      )
  };
});

import { LandingPage } from '../components/landing/LandingPage';

afterEach(cleanup);

describe('the coachings on the home page', () => {
  it('shows up to four coachings and no "See all coachings" link', async () => {
    total = 4;
    render(<LandingPage />);
    await waitFor(() => expect(screen.getByText('Coaching 4')).not.toBeNull());
    expect(screen.queryByRole('button', { name: /See all coachings/ })).toBeNull();
  }, 20000);

  it('with more than four, the fifth and the later ones are only in "See all coachings"', async () => {
    total = 6;
    render(<LandingPage />);
    await waitFor(() => expect(screen.getByText('Coaching 4')).not.toBeNull());
    // the page shows the first four only
    expect(screen.queryByText('Coaching 5')).toBeNull();
    expect(screen.queryByText('Coaching 6')).toBeNull();
    // the link opens the window with all of them
    fireEvent.click(screen.getByRole('button', { name: /See all coachings \(6\)/ }));
    const all = screen.getByRole('dialog', { name: 'All coachings' });
    for (const n of [1, 2, 3, 4, 5, 6]) expect(within(all).getByText(`Coaching ${n}`)).not.toBeNull();
    // the search finds one
    fireEvent.change(within(all).getByPlaceholderText(/Search by coaching/), { target: { value: 'coaching 5' } });
    expect(within(all).getByText('Coaching 5')).not.toBeNull();
    expect(within(all).queryByText('Coaching 2')).toBeNull();
    // the close button closes it
    fireEvent.click(within(all).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'All coachings' })).toBeNull();
  }, 20000);
});
