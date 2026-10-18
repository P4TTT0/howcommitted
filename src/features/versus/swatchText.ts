/**
 * Text color that keeps contrast on the versus swatch at `index` (see
 * `palette.ts`): Mustard (P3) and Sky (P5) take Ink, the rest Paper. Hot pink
 * (P2) only passes for large type (3.9:1), so never use it for small text.
 */
const TEXT_CLASSES = [
  "text-paper",
  "text-paper",
  "text-ink",
  "text-paper",
  "text-ink",
] as const;

export function swatchTextClass(index: number): string {
  return TEXT_CLASSES[index % TEXT_CLASSES.length] as string;
}
