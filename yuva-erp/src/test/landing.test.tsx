import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LandingPage } from '../components/landing/LandingPage';

afterEach(cleanup);

describe('the public website', () => {
  it('shows the product, and the sign in and demo links lead to the right places', () => {
    render(<LandingPage />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Run your whole coaching');
    const signIn = screen.getAllByRole('link', { name: /Sign in/ });
    expect(signIn.length).toBeGreaterThan(0);
    for (const link of signIn) expect(link.getAttribute('href')).toBe('#/login');
    for (const link of screen.getAllByRole('link', { name: 'Book a demo' })) expect(link.getAttribute('href')).toBe('#demo');
  });

  it('has the sections a visitor looks for', () => {
    render(<LandingPage />);
    for (const id of ['why', 'how', 'features', 'roles', 'security', 'faq', 'demo']) expect(document.getElementById(id)).not.toBeNull();
    expect(screen.getByText('Everything a coaching needs,', { exact: false })).not.toBeNull();
    // the footer repeats the way in
    expect(within(document.querySelector('footer') as HTMLElement).getByRole('link', { name: 'Register your coaching' })).not.toBeNull();
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
