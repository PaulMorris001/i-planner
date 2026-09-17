import { useWindowDimensions } from 'react-native';
import { Spacing } from '@/constants/theme';

const COLUMNS = 3;
const TILE_GAP = 14;

// Shared by NoteGridSection and app/notes.tsx's folder grid, so both grids
// line up with identical columns/gap. Computed from the actual screen width
// rather than percentage widths, which combined with a numeric gap can
// overflow a wrapping row (see GridTile's `width` prop comment) — assumes the
// grid sits inside a container with Spacing.md side padding, true for both
// current callers (app/notes.tsx and app/notes-folder.tsx).
export function useGridTileWidth() {
  const { width } = useWindowDimensions();
  const contentWidth = width - Spacing.md * 2;
  const tileWidth = (contentWidth - TILE_GAP * (COLUMNS - 1)) / COLUMNS;
  return { tileWidth, gap: TILE_GAP };
}
