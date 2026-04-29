// Shared rune palette. Used by:
//   • Clue features that show a discovered rune in the journal / inspect view.
//   • RuneDial features that let the player cycle through symbols to enter a code.
// Glyphs are Elder Futhark Unicode characters so they render with any font that
// includes the U+16A0–U+16FF range (most modern OS fonts do).

export const RUNES = [
  { id: 'fehu',     char: 'ᚠ' },
  { id: 'uruz',     char: 'ᚢ' },
  { id: 'thurisaz', char: 'ᚦ' },
  { id: 'ansuz',    char: 'ᚨ' },
  { id: 'raido',    char: 'ᚱ' },
  { id: 'kenaz',    char: 'ᚲ' },
];

const BY_ID = new Map(RUNES.map((r) => [r.id, r]));

export function runeChar(id) {
  return BY_ID.get(id)?.char ?? '?';
}

export function runeIndex(id) {
  return RUNES.findIndex((r) => r.id === id);
}
