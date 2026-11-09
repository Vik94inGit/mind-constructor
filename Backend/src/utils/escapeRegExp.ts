// User text that goes into a RegExp (search, case-insensitive lookups):
// escape it so "a.b" or "(" match themselves instead of being read as a
// pattern, or throwing, or running away on a crafted one.
export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
