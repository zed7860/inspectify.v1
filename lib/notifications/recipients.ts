export function parseRecipients(input: string | string[], limit = 50) {
  const list = [...new Set((Array.isArray(input) ? input.join(",") : input).split(/[,;\s]+/).map((value) => value.trim().toLowerCase()).filter(Boolean))];
  if (!list.length || list.length > limit || list.some((value) => !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value))) throw new Error(`Enter 1–${limit} valid email addresses separated by commas, semicolons or new lines.`);
  return list;
}
