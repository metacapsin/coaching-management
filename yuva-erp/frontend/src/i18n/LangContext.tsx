// The app is in English only. `useLang().t` gives the text as it is, so the screens that call it need no change.
export const useLang = () => ({ t: (text: string) => text });
