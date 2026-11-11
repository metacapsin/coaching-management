import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// The login page reads the sign-in state from the AuthContext: a fake one is used here
const auth = { signIn: vi.fn(), signUp: vi.fn(), registerStudent: vi.fn(), registerTeacher: vi.fn(), hasUsers: true, hasSuper: true };
vi.mock('../Context/AuthContext', () => ({ useAuth: () => auth }));

import { AuthPage } from '../components/auth/AuthPage';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { Pager } from '../components/ui/Pager';
import { ModalShell } from '../components/ui/ModalShell';

beforeEach(() => {
  auth.hasUsers = true;
  auth.hasSuper = true;
  window.matchMedia =
    window.matchMedia || ((() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia);
});
afterEach(cleanup);

describe('login page', () => {
  it('has three tabs and starts on the Coaching Admin sign in', () => {
    render(<AuthPage />);
    expect(screen.getByRole('button', { name: 'Super Admin' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Coaching Admin' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Teacher / Student' })).not.toBeNull();
    expect(screen.getByText('Sign in as Coaching Admin to continue.')).not.toBeNull();
    expect(screen.queryByText(/Register your coaching/)).toBeNull(); // only the Super Admin adds a coaching
    expect(screen.getByText(/added by the Super Admin/)).not.toBeNull();
  });

  it('asks to create the Super Admin first when there is none', () => {
    auth.hasSuper = false;
    render(<AuthPage />);
    expect(screen.getByRole('heading', { name: 'Create the Super Admin' })).not.toBeNull();
    expect(screen.getByText('Confirm Password')).not.toBeNull();
  });

  it('shows the Super Admin sign in with "Forgot your password?" once the Super Admin exists', () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Super Admin' }));
    expect(screen.getByText('Sign in as Super Admin to continue.')).not.toBeNull();
    expect(screen.getByText('Forgot your password?')).not.toBeNull();
  });

  it('offers "Create an account" to teachers and students', () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Teacher / Student' }));
    expect(screen.getByText('Create an account')).not.toBeNull();
  });
});

describe('small parts', () => {
  it('the theme button switches the dark look and remembers it', () => {
    localStorage.clear();
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('academia_os_theme_v1')).toBe('dark');
    fireEvent.click(screen.getByRole('button'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('a pop-up closes with the Escape key', () => {
    const onClose = vi.fn();
    render(
      <ModalShell title="Test window" onClose={onClose}>
        <p>content</p>
      </ModalShell>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('the pager shows the range and goes to the next page', () => {
    const onPage = vi.fn();
    render(<Pager page={1} pages={3} from={1} to={20} total={55} onPage={onPage} />);
    expect(screen.getByText(/of 55/)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPage).toHaveBeenCalledWith(2);
  });
});
