import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ProgressCharts } from '../components/ui/ProgressCharts';

afterEach(cleanup);

describe('the progress charts of a child', () => {
  it('shows the marks of every test with the change, and the attendance of every month', () => {
    render(
      <ProgressCharts
        tests={[
          { title: 'Unit 1', date: '2026-09-01', percent: 50 },
          { title: 'Unit 2', date: '2026-10-01', percent: 80 }
        ]}
        months={[
          { month: '2026-09', present: 18, total: 24 },
          { month: '2026-10', present: 20, total: 20 }
        ]}
      />
    );
    expect(screen.getByText('Marks in every test')).not.toBeNull();
    expect(screen.getByText('80%')).not.toBeNull();
    expect(screen.getByText(/30% since the first test/)).not.toBeNull();
    expect(screen.getByText('Sep 26')).not.toBeNull();
    expect(screen.getByText(/75%/)).not.toBeNull(); // September: 18 of 24
    expect(screen.getByText(/100%/)).not.toBeNull();
  });

  it('says so while there is nothing to show', () => {
    render(<ProgressCharts tests={[]} months={[]} />);
    expect(screen.getByText('The chart appears after the first test result.')).not.toBeNull();
    expect(screen.getByText('No attendance marked yet.')).not.toBeNull();
  });
});
