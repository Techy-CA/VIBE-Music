// Seeded shuffle so each section gets different order
export const shuffle = <T>(arr: T[], seed?: number): T[] => {
  const a = [...arr];
  let s = seed ?? Math.floor(Math.random() * 10000);
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};  