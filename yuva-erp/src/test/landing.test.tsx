import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
// The sign in form in the top part reads the sign in state: a fake one
const auth = { signIn: vi.fn(), signUp: vi.fn(), registerStudent: vi.fn(), registerTeacher: vi.fn(), hasUsers: true, hasSuper: true };
vi.mock('../Context/AuthContext', () => ({ useAuth: () => auth }));

import { LandingPage } from '../components/landing/LandingPage';
import { LangProvider } from '../i18n/LangContext';

afterEach(cleanup);

describe('the public website', () => {
  it('shows the product and the sign in form on the same first page, without extra buttons to another page', () => {
    render(<LandingPage />);
    expect(screen.getByRole('heading', { level: 1, name: /Run your whole coaching/ })).not.toBeNull();
    // the sign in form (three tabs) is part of the page
    expect(screen.getByRole('heading', { name: 'Welcome back' })).not.toBeNull();
    for (const tab of ['Super Admin', 'Coaching Admin', 'Teacher / Student']) expect(screen.getByRole('button', { name: tab })).not.toBeNull();
    expect(screen.getByRole('button', { name: /Sign In as Coaching Admin/ })).not.toBeNull();
    // nothing leads to another page
    expect(document.querySelector('a[href="#/login"]')).toBeNull();
    expect(screen.queryByText('Back to the website')).toBeNull();
  });

  it('has the sections a visitor looks for', () => {
    render(<LandingPage />);
    for (const id of ['why', 'how', 'features', 'roles', 'security', 'faq', 'demo']) expect(document.getElementById(id)).not.toBeNull();
    expect(screen.getByText('Everything a coaching needs,', { exact: false })).not.toBeNull();
    // the footer leads back up to the sign in form
    expect(within(document.querySelector('footer') as HTMLElement).getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('#top');
  });

  it('the tabs change the text', () => {
    render(<LandingPage />);
    expect(screen.getByText('Every coaching of your area on one platform')).not.toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Separate data' }));
    expect(screen.getByText('One coaching can never see another')).not.toBeNull();
    expect(screen.queryByText('Every coaching of your area on one platform')).toBeNull();
  });

  it('a question opens and closes', () => {
    render(<LandingPage />);
    const q = screen.getByRole('button', { name: 'Do fees get paid online?' });
    expect(q.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(q);
    expect(q.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/needs a paid gateway/)).not.toBeNull();
    fireEvent.click(q);
    expect(q.getAttribute('aria-expanded')).toBe('false');
  });

  it('the demo form asks for the missing details before it sends anything', () => {
    render(<LandingPage />);
    fireEvent.click(screen.getByRole('button', { name: /Send my request/ }));
    expect(screen.getByRole('alert').textContent).toBe('Please write your name.');
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ravi' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: /Send my request/ }));
    expect(screen.getByRole('alert').textContent).toBe('Please write a valid email.');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ravi@example.com' } });
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /Send my request/ }));
    expect(screen.getByRole('alert').textContent).toBe('Please write a 10-digit mobile number.');
  });

  it('the message at the top changes by itself and a dot chooses one', () => {
    vi.useFakeTimers();
    try {
      render(<LandingPage />);
      const title = () => screen.getByRole('heading', { level: 1 }).textContent;
      expect(title()).toContain('Run your whole coaching');
      act(() => {
        vi.advanceTimersByTime(6100);
      });
      expect(title()).toContain('Take the roll call in a minute');
      fireEvent.click(screen.getByRole('button', { name: 'Show message 3' }));
      expect(title()).toContain('Fees and receipts');
    } finally {
      vi.useRealTimers();
    }
  });

  it('the tabs of "Why" go on by themselves, until somebody chooses one', () => {
    vi.useFakeTimers();
    try {
      render(<LandingPage />);
      const selected = () => screen.getByRole('tab', { selected: true }).textContent;
      expect(selected()).toBe('One platform');
      act(() => {
        vi.advanceTimersByTime(7100);
      });
      expect(selected()).toBe('Separate data');
      fireEvent.click(screen.getByRole('tab', { name: 'Works on phone' }));
      act(() => {
        vi.advanceTimersByTime(20000);
      });
      expect(selected()).toBe('Works on phone'); // chosen by the person: it stays
    } finally {
      vi.useRealTimers();
    }
  });

  it('the Add coaching buttons open the registration of a coaching in the form at the top', () => {
    render(<LandingPage />);
    const form = within(document.getElementById('signin') as HTMLElement);
    expect(form.queryByRole('heading', { name: 'Register your coaching' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add coaching' })[0]);
    expect(form.getByRole('heading', { name: 'Register your coaching' })).not.toBeNull();
  });

  it('the language button turns the page into Hindi and back, and the choice is remembered', () => {
    localStorage.removeItem('academiaos.lang');
    render(
      <LangProvider>
        <LandingPage />
      </LangProvider>
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Run your whole coaching');
    fireEvent.click(screen.getByRole('button', { name: 'हिंदी में देखें' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('अपनी पूरी कोचिंग चलाएँ');
    expect(screen.getByRole('button', { name: 'सुपर एडमिन' })).not.toBeNull();
    expect(localStorage.getItem('academiaos.lang')).toBe('hi');
    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Run your whole coaching');
    localStorage.removeItem('academiaos.lang');
  });

  it('the slider of a day moves with the arrows, and the gallery shows the screens of the app', () => {
    render(<LandingPage />);
    const day = screen.getByRole('group', { name: 'A day in your coaching' });
    expect(within(day).getByText('Morning: the roll call')).not.toBeNull();
    fireEvent.click(within(day).getByRole('button', { name: 'Next' }));
    expect(within(day).getByText('Noon: new admissions')).not.toBeNull();
    fireEvent.click(within(day).getByRole('button', { name: 'Previous' }));
    expect(within(day).getByText('Morning: the roll call')).not.toBeNull();
    const gallery = screen.getByRole('group', { name: 'See the real app' });
    expect(gallery.querySelector('img')?.getAttribute('src')).toBe('/screens/dashboard.png');
    // no real customer words yet: no invented ones are shown
    expect(screen.queryByText('What coachings say')).toBeNull();
  });

  it('a link from an email opens the sign in form of that person (?portal=super)', () => {
    window.history.replaceState(null, '', '/?portal=super#signin');
    try {
      render(<LandingPage />);
      expect(screen.getByRole('button', { name: /Sign In as Super Admin/ })).not.toBeNull();
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });
});
