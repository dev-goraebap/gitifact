import type { Note } from '../formats/note.js';

export function briefNotes(notes: readonly Note[], all = false) {
  const ordered = [...notes].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || a.id.localeCompare(b.id));
  const corrections = new Map<string, string[]>();
  for (const note of notes) if (note.supersedes) {
    const ids = corrections.get(note.supersedes) ?? [];
    ids.push(note.id); corrections.set(note.supersedes, ids);
  }
  const selected = all ? ordered : ordered.slice(0, 20);
  return { total: notes.length, included: selected.length, omitted: notes.length - selected.length,
    items: selected.map(note => {
      const characters = [...note.text];
      return { ...note, text: all ? note.text : characters.slice(0, 240).join(''), textTruncated: !all && characters.length > 240,
        path: '.tryce/notes/' + note.id + '.json', correctedBy: (corrections.get(note.id) ?? []).sort(),
      };
    }),
  };
}
export function briefList<T>(items: readonly T[], limit: number, all = false) {
  const selected = all ? [...items] : items.slice(0, limit);
  return { total: items.length, included: selected.length, omitted: items.length - selected.length, items: selected };
}
