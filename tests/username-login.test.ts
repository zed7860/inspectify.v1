import { beforeEach, expect, it, vi } from "vitest";
import { normalizeUsername } from "../lib/auth/username";
const mock = vi.hoisted(() => ({ resolve: vi.fn(), signIn: vi.fn(), profile: vi.fn(), signOut: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => ({ from: () => ({ select: () => ({ eq: mock.eq }) }) }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signInWithPassword: mock.signIn, signOut: mock.signOut }, from: () => ({ select: () => ({ eq: () => ({ single: mock.profile }) }) }) }) }));
import { POST } from "../app/api/auth/login/route";
const login = (identifier: string) => POST(new Request("https://example.com/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier, password: "valid-password", role: "PMC" }) }));
beforeEach(() => {
  vi.clearAllMocks();
  mock.eq.mockReturnValue({ is: () => ({ maybeSingle: mock.resolve }) });
  mock.resolve.mockResolvedValue({ data: { email: "person@example.com" } });
  mock.signIn.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
  mock.profile.mockResolvedValue({ data: { role: "PMC", is_active: true } });
});
it("normalizes usernames and rejects ambiguous or invalid identifiers", () => {
  expect(normalizeUsername("  Site.Admin ")).toBe("site.admin");
  for (const value of ["a", "foo@bar.com", "space name", "_name", "x".repeat(31)]) expect(() => normalizeUsername(value)).toThrow();
});
it("authenticates a username using its account email without exposing the email", async () => {
  const response = await login("Site.Admin");
  expect(mock.eq).toHaveBeenCalledWith("username", "site.admin");
  expect(mock.signIn).toHaveBeenCalledWith({ email: "person@example.com", password: "valid-password" });
  expect(await response.json()).toEqual({ ok: true, role: "PMC", redirect: "/pmc" });
});
it("retains direct email login", async () => {
  await login("Person@Example.com");
  expect(mock.resolve).not.toHaveBeenCalled();
  expect(mock.signIn).toHaveBeenCalledWith({ email: "person@example.com", password: "valid-password" });
});
it("returns the same error for unknown usernames and wrong passwords", async () => {
  mock.resolve.mockResolvedValue({ data: null });
  const unknown = await login("unknown");
  mock.signIn.mockResolvedValue({ error: { message: "Wrong password" } });
  const wrong = await login("person@example.com");
  expect(unknown.status).toBe(401);
  expect(wrong.status).toBe(401);
  expect(await unknown.json()).toEqual(await wrong.json());
});
it("denies access to disabled users even with a correct password", async () => {
  mock.profile.mockResolvedValue({ data: { role: "PMC", is_active: false } });
  const response = await login("site.admin");
  expect(mock.signOut).toHaveBeenCalled();
  expect(response.headers.get("location")).toContain("error=disabled");
});
