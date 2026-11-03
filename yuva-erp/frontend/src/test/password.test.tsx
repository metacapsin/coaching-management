import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PasswordInput } from '../components/ui/PasswordInput';

afterEach(cleanup);

describe('password box', () => {
  it('hides the password and the eye button shows it and hides it again', () => {
    render(<PasswordInput placeholder="Password" defaultValue="secret123" />);
    const box = screen.getByPlaceholderText('Password') as HTMLInputElement;
    expect(box.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(box.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(box.type).toBe('password');
  });

  it('passes the usual input settings on', () => {
    render(<PasswordInput placeholder="Password" autoComplete="current-password" className="w-full" />);
    const box = screen.getByPlaceholderText('Password');
    expect(box.getAttribute('autocomplete')).toBe('current-password');
    expect(box.className).toContain('w-full');
  });
});
