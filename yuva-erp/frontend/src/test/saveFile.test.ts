import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveBlobAs } from '../components/utils/saveFile';

const blob = () => new Blob(['hello'], { type: 'application/pdf' });

describe('saving a file with the Save as window', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
    vi.restoreAllMocks();
  });

  it('opens the Save as window with the name and the type, and writes the file there', async () => {
    const write = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const picker = vi.fn(async () => ({ createWritable: async () => ({ write, close }) }));
    (window as unknown as Record<string, unknown>).showSaveFilePicker = picker;
    expect(await saveBlobAs('coachings.pdf', blob(), 'PDF document', '.pdf')).toBe(true);
    expect(picker).toHaveBeenCalledWith({ suggestedName: 'coachings.pdf', types: [{ description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } }] });
    expect(write).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('does nothing more when the person cancels the window', async () => {
    (window as unknown as Record<string, unknown>).showSaveFilePicker = vi.fn(async () => {
      throw new DOMException('cancelled', 'AbortError');
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    expect(await saveBlobAs('coachings.pdf', blob(), 'PDF document', '.pdf')).toBe(false);
    expect(click).not.toHaveBeenCalled(); // no download behind the back of the person
  });

  it('downloads the normal way when the browser has no Save as window', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    expect(await saveBlobAs('coachings.pdf', blob(), 'PDF document', '.pdf')).toBe(true);
    expect(click).toHaveBeenCalledTimes(1);
  });
});
