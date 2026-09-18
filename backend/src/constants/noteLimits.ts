// Shared by note.controller.ts, folder.controller.ts, and sharedNote.controller.ts
// (the import-copy path) so all three enforce the same caps instead of each
// hardcoding its own copy of the same magic number.
//
// NOTE_BODY_MAX_LENGTH must stay in sync with app/note-editor.tsx's own
// constant of the same name — that caps it at entry for a nicer UX, this
// enforces it regardless so a stale client build (or the API called
// directly) can't bypass it. An unbounded body rendered into a native <Text>
// builds a proportionally large text-fragment tree, and a large enough one
// has caused a real, confirmed stack-overflow crash when that tree was later
// torn down — see app/note-editor.tsx and components/notes/NoteListSection.tsx.
//
// NOTE_TITLE_MAX_LENGTH / FOLDER_NAME_MAX_LENGTH close the same crash class
// for the two other free-text fields in this feature — title and folder name
// are rendered the exact same way (ListRow, GridTile, PageHeader, etc.) but,
// unlike body, had no cap anywhere until now.
export const NOTE_BODY_MAX_LENGTH = 20_000;
export const NOTE_TITLE_MAX_LENGTH = 200;
export const FOLDER_NAME_MAX_LENGTH = 100;
