import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
// The sign in form in the top part reads the sign in state: a fake one
const auth = { signIn: vi.fn(), signUp: vi.fn(), registerStudent: vi.fn(), registerTeacher: vi.fn(), hasUsers: true, hasSuper: true };
vi.mock('../Context/AuthContext', () => ({ useAuth: () => auth }));

import { LandingPage } from '../components/landing/LandingPage';

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
});
