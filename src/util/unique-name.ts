export function uniqueName(name: string, set: Set<string>): string {
  if (!set.has(name)) return name;

  for (let i = 1; i < 100; i++) if (!set.has(name + String(i))) return name + String(i);

  return name;
}
