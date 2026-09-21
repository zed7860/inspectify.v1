import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ updateAuth: vi.fn(), getAuth: vi.fn(), updateProfile: vi.fn(), single: vi.fn(), deleteAuth: vi.fn(), lookup: vi.fn() }));
vi.mock("@/lib/auth/guard", () => ({ requireUser: async () => ({ user: { id: "admin" }, profile: { name: "Admin", role: "ADMIN" } }) }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => ({ auth: { admin: { getUserById: mocks.getAuth, updateUserById: mocks.updateAuth, deleteUser: mocks.deleteAuth } }, from: () => ({ update: mocks.updateProfile, select: () => ({ eq: () => ({ is: () => ({ single: mocks.lookup }) }) }) }) }) }));
import { POST } from "../app/api/admin/users/route";
function request() {
  const form = new FormData();
  for (const [key, value] of Object.entries({ action: "update", id: "user", name: "New name", email: "New@Example.com", role: "PMC", username: "new.user", isActive: "true" })) form.set(key, value);
  return new Request("https://example.com/api/admin/users", { method: "POST", body: form });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuth.mockResolvedValue({ data: { user: { email: "old@example.com", user_metadata: { name: "Old" } } } });
  mocks.updateAuth.mockResolvedValue({ error: null });
  mocks.updateProfile.mockReturnValue({ eq: () => ({ is: () => ({ select: () => ({ single: mocks.single }) }) }) });
  mocks.lookup.mockResolvedValue({ data: { id: "user" }, error: null });
  mocks.deleteAuth.mockResolvedValue({ error: null });
  mocks.single.mockResolvedValue({ data: { id: "user" }, error: null });
});
it("synchronizes the login email before saving the profile", async () => {
  expect((await POST(request())).status).toBe(303);
  expect(mocks.updateAuth).toHaveBeenCalledWith("user", expect.objectContaining({ email: "new@example.com", email_confirm: true }));
  expect(mocks.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ email: "new@example.com", role: "PMC" }));
});
it("does not change a profile when Auth rejects a duplicate email", async () => {
  mocks.updateAuth.mockResolvedValue({ error: { message: "Email already registered" } });
  expect((await POST(request())).status).toBe(400);
  expect(mocks.updateProfile).not.toHaveBeenCalled();
});
it("restores the login email when profile save fails", async () => {
  mocks.single.mockResolvedValue({ error: { message: "Invalid company" } });
  expect((await POST(request())).status).toBe(400);
  expect(mocks.updateAuth).toHaveBeenLastCalledWith("user", { email: "old@example.com", email_confirm: true, user_metadata: { name: "Old" } });
});

function actionRequest(action: string, id = "user", isActive = "false") {
  const form = new FormData();
  form.set("action", action); form.set("id", id); form.set("isActive", isActive);
  return new Request("https://example.com/api/admin/users", { method: "POST", body: form });
}
it("disables users and supports enabling them again", async () => {
  expect((await POST(actionRequest("setActive"))).status).toBe(200);
  expect(mocks.updateProfile).toHaveBeenLastCalledWith({ is_active: false });
  await POST(actionRequest("setActive", "user", "true"));
  expect(mocks.updateProfile).toHaveBeenLastCalledWith({ is_active: true });
});
it("blocks admin self-disable and self-deletion", async () => {
  expect((await POST(actionRequest("setActive", "admin"))).status).toBe(400);
  expect((await POST(actionRequest("delete", "admin"))).status).toBe(400);
  expect(mocks.updateProfile).not.toHaveBeenCalled();
  expect(mocks.deleteAuth).not.toHaveBeenCalled();
});
it("deletes login access while retaining referenced history", async () => {
  expect((await POST(actionRequest("delete"))).status).toBe(303);
  expect(mocks.deleteAuth).toHaveBeenCalledWith("user", true);
});
it("reports deletion failures rather than success", async () => {
  mocks.deleteAuth.mockResolvedValue({ error: { message: "Deletion failed" } });
  const response = await POST(actionRequest("delete"));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "Deletion failed" });
});
