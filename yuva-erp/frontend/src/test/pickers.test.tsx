import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DateInput, DatePicker, Dropdown, Select } from '../components/ui/Pickers';

afterEach(cleanup);

const Drop = () => {
  const [v, setV] = useState('');
  return (
    <>
      <Dropdown value={v} onChange={setV} options={['Sick', 'Casual', 'Other']} label="Type" />
      <output data-testid="out">{v}</output>
    </>
  );
};

// the same use as a native <select>: <option> children, onChange(e) with e.target.value
const Native = () => {
  const [v, setV] = useState('b2');
  return (
    <>
      <Select value={v} onChange={e => setV(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg" aria-label="Batch">
        <option value="">All batches</option>
        {['b1', 'b2', 'b3'].map(id => (
          <option key={id} value={id}>
            Batch {id}
          </option>
        ))}
        <option value="x" disabled>
          Closed batch
        </option>
      </Select>
      <output data-testid="out">{v}</output>
    </>
  );
};

const Cal = ({ min, max }: { min?: string; max?: string }) => {
  const [v, setV] = useState('');
  return (
    <>
      <DatePicker value={v} onChange={setV} min={min} max={max} label="Day" clearable />
      <output data-testid="out">{v}</output>
    </>
  );
};

const Native2 = () => {
  const [v, setV] = useState('2012-03-04');
  return (
    <>
      <DateInput value={v} onChange={e => setV(e.target.value)} aria-label="Birth" />
      <output data-testid="out">{v}</output>
    </>
  );
};

describe('Dropdown', () => {
  it('opens a list, picks a choice and closes', () => {
    render(<Drop />);
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(screen.getByLabelText('Type'));
    expect(screen.getAllByRole('option').length).toBe(3);
    fireEvent.click(screen.getByText('Casual'));
    expect(screen.getByTestId('out').textContent).toBe('Casual');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('works with the keyboard and closes with Escape', () => {
    render(<Drop />);
    const button = screen.getByLabelText('Type');
    fireEvent.keyDown(button, { key: 'ArrowDown' }); // opens, the first choice is active
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(screen.getByTestId('out').textContent).toBe('Casual');
    fireEvent.click(button);
    expect(screen.getByRole('listbox')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('Select (drop-in for <select>)', () => {
  it('shows the chosen option, lists all the <option> children and gives e.target.value', () => {
    render(<Native />);
    const button = screen.getByLabelText('Batch');
    expect(button.textContent).toContain('Batch b2');
    fireEvent.click(button);
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['All batches', 'Batch b1', 'Batch b2', 'Batch b3', 'Closed batch']);
    fireEvent.click(screen.getByText('Batch b3'));
    expect(screen.getByTestId('out').textContent).toBe('b3');
    expect(button.textContent).toContain('Batch b3');
    // the empty choice
    fireEvent.click(button);
    fireEvent.click(screen.getByText('All batches'));
    expect(screen.getByTestId('out').textContent).toBe('');
  });

  it('does not take a disabled option', () => {
    render(<Native />);
    fireEvent.click(screen.getByLabelText('Batch'));
    fireEvent.click(screen.getByText('Closed batch'));
    expect(screen.getByTestId('out').textContent).toBe('b2');
  });
});

describe('DatePicker', () => {
  it('shows the month, moves between months and picks a day', () => {
    render(<Cal />);
    fireEvent.click(screen.getByLabelText('Day'));
    const dialog = screen.getByRole('dialog');
    const title = () => dialog.querySelector('button[title]')!.textContent;
    const first = title();
    fireEvent.click(screen.getByLabelText('Next'));
    expect(title()).not.toBe(first);
    fireEvent.click(screen.getByLabelText('Previous'));
    expect(title()).toBe(first);
    fireEvent.click(screen.getAllByRole('button').find(b => b.getAttribute('aria-label')?.startsWith('15 '))!);
    expect(screen.getByTestId('out').textContent).toMatch(/^\d{4}-\d{2}-15$/);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not let a day before the minimum or after the maximum be chosen; Clear empties it', () => {
    render(<Cal min="2030-06-10" max="2030-06-20" />);
    fireEvent.click(screen.getByLabelText('Day'));
    expect(screen.getByText('June 2030')).not.toBeNull(); // opens on the month of the minimum
    expect((screen.getByLabelText('9 Jun 2030') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('21 Jun 2030') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('9 Jun 2030'));
    expect(screen.getByTestId('out').textContent).toBe('');
    fireEvent.click(screen.getByLabelText('10 Jun 2030'));
    expect(screen.getByTestId('out').textContent).toBe('2030-06-10');
    fireEvent.click(screen.getByLabelText('Day'));
    fireEvent.click(screen.getByText('Clear'));
    expect(screen.getByTestId('out').textContent).toBe('');
  });

  it('jumps to a year and a month quickly (a date of birth) and the drop-in DateInput gives e.target.value', () => {
    render(<Native2 />);
    const button = screen.getByLabelText('Birth');
    expect(button.textContent).toContain('4 Mar 2012');
    fireEvent.click(button);
    fireEvent.click(screen.getByTitle('Choose the month and the year')); // the years
    fireEvent.click(screen.getByText('2008'));
    fireEvent.click(screen.getByText('Sep')); // the months
    fireEvent.click(screen.getByLabelText('17 Sep 2008'));
    expect(screen.getByTestId('out').textContent).toBe('2008-09-17');
    expect(button.textContent).toContain('17 Sep 2008');
  });
});
