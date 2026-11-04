// Where the main menu's ghosts sit round its node (dashboard/MenuNode.tsx):
// evenly on a circle of `radius`, the first straight up, the rest clockwise,
// as offsets from the centre. Rounded to whole pixels so the ghosts stay crisp.
export function ringPoints(count: number, radius: number): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return { x: Math.round(radius * Math.cos(angle)), y: Math.round(radius * Math.sin(angle)) };
  });
}
