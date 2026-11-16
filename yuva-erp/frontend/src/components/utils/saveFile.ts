// Saving a file the way a program does: the "Save as" window opens, and the person chooses the folder and the name. Chrome and Edge can do it
// (showSaveFilePicker); on a browser that cannot (Firefox, Safari) the file goes to the Downloads folder as before. When the person closes the
// window without saving, nothing is saved and nothing else happens.

interface SavePicker {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }>;
}

/** Returns true when the file was saved, false when the person cancelled. `extension` is like ".pdf". */
export async function saveBlobAs(filename: string, blob: Blob, description: string, extension: string): Promise<boolean> {
  const picker = (window as unknown as SavePicker).showSaveFilePicker;
  if (typeof picker === 'function') {
    try {
      const handle = await picker.call(window, { suggestedName: filename, types: [{ description, accept: { [blob.type || 'application/octet-stream']: [extension] } }] });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false; // the person pressed Cancel
      // any other problem (a blocked window, a folder that cannot be written): the normal download below
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
