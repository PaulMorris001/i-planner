const TITLE_PART_MAX = 40;

// "Biology: Chapter 3 Notes!" -> "biology-chapter-3-notes". Accents are dropped
// ("Café" -> "cafe"); a title with no latin letters or digits gives "" (such a
// link just has no title in it).
export function slugifyTitle(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (base.length <= TITLE_PART_MAX) return base;
  // Cut at a word boundary where possible, never mid-word unless it's one long word.
  const cut = base.slice(0, TITLE_PART_MAX);
  const lastDash = cut.lastIndexOf('-');
  return (lastDash > 10 ? cut.slice(0, lastDash) : cut).replace(/-+$/, '');
}

// What goes after /n/: "<title-words>-<slug>", or just the slug for an untitled
// note. Only the slug (the last piece, which never contains a hyphen) identifies
// the note; the words are for people reading the link.
export function titledShareId(title: string, slug: string): string {
  const words = slugifyTitle(title);
  return words ? `${words}-${slug}` : slug;
}

// The slug in "<title-words>-<slug>". Also fine for a bare slug.
export function slugFromShareId(id: string): string {
  return id.slice(id.lastIndexOf('-') + 1);
}
