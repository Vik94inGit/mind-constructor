// Whether an event happened in a field the user types into: a text input, a
// textarea or editable text. Long-press, paste and keys there belong to the
// browser (its own Paste bubble on a tablet, say), not to the map.
export function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || !!el.isContentEditable;
}

// Whether a paste carries words. Text copied from Word, a web page or a
// phone's clipboard often comes with a picture of the same text beside it;
// pasted into a text field, the words are what was meant.
export function clipboardHasText(data: DataTransfer | null): boolean {
  if (!data) return false;
  try {
    return data.getData("text/plain").trim().length > 0;
  } catch {
    return false;
  }
}
