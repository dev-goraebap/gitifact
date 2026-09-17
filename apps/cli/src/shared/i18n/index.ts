// One language is one folder. Long-form text ships as Markdown beside the built entry point;
// one-line strings live in messages.json and are bundled into main.js.
export const defaultLanguage = 'ko' as const;
export type Language = typeof defaultLanguage;
