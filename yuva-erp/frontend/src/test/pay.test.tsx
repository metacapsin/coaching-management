import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PayPage } from '../components/pay/PayPage';
import { isUpiId, payPageLink, withPayLink } from '../components/utils/helpers';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('the pay page of a fee notice', () => {
  it('has one button that opens the UPI app with the coaching, the amount and the note', () => {
    window.history.replaceState(null, '', '/pay?pa=alpha%40okbank&pn=Alpha%20Classes&am=40000&sn=Aarav');
    render(<PayPage />);
    const button = screen.getByRole('link', { name: /Pay ₹40,000 now/ });
    const href = button.getAttribute('href') as string;
    expect(href.startsWith('upi://pay?')).toBe(true);
    expect(href).toContain('pa=alpha%40okbank');
    expect(href).toContain('am=40000');
    expect(href).toContain('cu=INR');
    expect(screen.getByText('alpha@okbank')).not.toBeNull();
  });

  it('says so when the link is not complete (no UPI id or a wrong amount)', () => {
    window.history.replaceState(null, '', '/pay?pa=notanupi&am=-5');
    render(<PayPage />);
    expect(screen.getByText('This payment link is not complete')).not.toBeNull();
    expect(screen.queryByRole('link', { name: /Pay/ })).toBeNull();
  });

  it('the notice gets a Pay now link only when the coaching has a UPI id and something is due', () => {
    expect(isUpiId('alpha@okbank')).toBe(true);
    expect(isUpiId('alpha')).toBe(false);
    const link = payPageLink({ upiId: 'alpha@okbank', name: 'Alpha' }, 'Aarav', 40000);
    expect(link).toContain('/pay?pa=alpha%40okbank');
    expect(withPayLink('Hello', link)).toContain('Pay now: ');
    expect(payPageLink({ name: 'Alpha' }, 'Aarav', 40000)).toBe('');
    expect(payPageLink({ upiId: 'alpha@okbank', name: 'Alpha' }, 'Aarav', 0)).toBe('');
    expect(withPayLink('Hello', '')).toBe('Hello');
  });
});
