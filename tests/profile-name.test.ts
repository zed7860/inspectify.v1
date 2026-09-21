import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn(), single: vi.fn() }));
vi.mock("@/lib/auth/guard", () => ({ requireUser: async () => ({ user: { id: "current-user" } }) }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => ({ from: () => ({ update: mock.update }) }) }));
import { POST } from "../app/api/auth/profile/route";
beforeEach(() => {
  vi.clearAllMocks();
  mock.update.mockReturnValue({ eq: mock.eq });
  mock.eq.mockReturnValue({ eq: () => ({ is: () => ({ select: () => ({ single: mock.single }) }) }) });
  mock.single.mockResolvedValue({ data: { id: "current-user" }, error: null });
});
it("only updates the signed-in user's name and ignores privilege fields", async () => {
  const form = new FormData(); form.set("name", "  New Name  "); form.set("id", "other-user"); form.set("role", "ADMIN");
  const response = await POST(new Request("https://example.com/api/auth/profile", { method: "POST", body: form }));
  expect(response.status).toBe(200);
  expect(mock.update).toHaveBeenCalledWith({ name: "New Name" });
  expect(mock.eq).toHaveBeenCalledWith("id", "current-user");
});
it("rejects blank names without writing", async () => {
  const form = new FormData(); form.set("name", "  ");
  expect((await POST(new Request("https://example.com/api/auth/profile", { method: "POST", body: form }))).status).toBe(400);
  expect(mock.update).not.toHaveBeenCalled();
});
