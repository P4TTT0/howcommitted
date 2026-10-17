/**
 * The versus palette (design.md): fixed order, color follows the developer
 * and never the rank. Classes are spelled out so Tailwind can see them.
 */
const SWATCH_CLASSES = [
  "bg-versus-p1",
  "bg-versus-p2",
  "bg-versus-p3",
  "bg-versus-p4",
  "bg-versus-p5",
] as const;

/** Swatch class for the developer at `index` (0 is P1). */
export function swatchClass(index: number): string {
  return SWATCH_CLASSES[index % SWATCH_CLASSES.length] as string;
}
