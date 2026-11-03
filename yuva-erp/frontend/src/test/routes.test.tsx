import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TAB_PATHS, tabFromPath, tabPath, useTabRoute } from '../components/utils/useTabRoute';
import type { TabId } from '../Context/Access';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

const Probe: React.FC<{ allow?: (t: TabId) => boolean }> = ({ allow = () => true }) => {
  const [tab, go] = useTabRoute(allow);
  return (
    <div>
      <span data-testid="tab">{tab}</span>
      <button onClick={() => go('fees')}>fees</button>
    </div>
  );
};

describe('the address of every page', () => {
  it('every page has its own address and an address finds its page', () => {
    const paths = Object.values(TAB_PATHS);
    expect(new Set(paths).size).toBe(paths.length);
    for (const tab of Object.keys(TAB_PATHS) as TabId[]) expect(tabFromPath(tabPath(tab))).toBe(tab);
    expect(tabFromPath('/fees/')).toBe('fees');
    expect(tabFromPath('/nothing')).toBeNull();
    expect(tabFromPath('/')).toBeNull();
  });

  it('a reload opens the page of the address', () => {
    window.history.replaceState(null, '', '/attendance');
    render(<Probe />);
    expect(screen.getByTestId('tab').textContent).toBe('attendance');
  });

  it('opening a page changes the address and the Back button comes back', () => {
    window.history.replaceState(null, '', '/dashboard');
    render(<Probe />);
    fireEvent.click(screen.getByText('fees'));
    expect(screen.getByTestId('tab').textContent).toBe('fees');
    expect(window.location.pathname).toBe('/fees');
    // the Back button
    act(() => {
      window.history.replaceState(null, '', '/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByTestId('tab').textContent).toBe('dashboard');
  });

  it('a page this person may not open, or a wrong address, shows the dashboard and fixes the address', () => {
    window.history.replaceState(null, '', '/expenses');
    render(<Probe allow={t => t !== 'expenses'} />);
    expect(screen.getByTestId('tab').textContent).toBe('dashboard');
    expect(window.location.pathname).toBe('/dashboard');
  });
});
