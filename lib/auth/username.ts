export function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) throw new Error("Username must be 3–30 characters: letters, numbers, dots, underscores or hyphens, starting with a letter or number.");
  return username;
}
