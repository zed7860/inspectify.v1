import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/guard", () => ({ requireUser: async () => ({ user: { id: "admin" } }) }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
import { POST as save } from "../app/api/admin/master/route";
import { POST as upload } from "../app/api/admin/categories/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ upsert: mocks.upsert });
  mocks.upsert.mockReturnValue({ throwOnError: async () => ({ error: null }) });
  mocks.rpc.mockResolvedValue({ error: null });
});
function request(fields: Record<string, string>) {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.set(key, value));
  return new Request("https://example.com/api/admin/master", { method: "POST", body: form });
}
it("overwrites matching categories and removes repeated names within a submission", async () => {
  const response = await save(request({ kind: "category", names: "Civil, Civil\nElectrical\n Civil " }));
  expect(response.status).toBe(303);
  expect(mocks.from).toHaveBeenCalledWith("categories");
  expect(mocks.upsert).toHaveBeenCalledWith([{ name: "Civil", is_active: true }, { name: "Electrical", is_active: true }], { onConflict: "name" });
});
it("matches subcategories by both parent and name", async () => {
  await save(request({ kind: "subcategory", categoryId: "parent", names: "Wiring\nWiring,Switches" }));
  expect(mocks.from).toHaveBeenCalledWith("subcategories");
  expect(mocks.upsert).toHaveBeenCalledWith([{ category_id: "parent", name: "Wiring", is_active: true }, { category_id: "parent", name: "Switches", is_active: true }], { onConflict: "category_id,name" });
});
it("does not report success when an override fails", async () => {
  mocks.upsert.mockReturnValue({ throwOnError: async () => { throw new Error("Database unavailable"); } });
  const response = await save(request({ kind: "category", names: "Civil" }));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "Database unavailable" });
});
it("deduplicates repeated CSV mappings before the atomic override", async () => {
  const form = new FormData();
  form.set("file", new File(["Category,Subcategory\nCivil,Concrete\nCivil,Concrete\nElectrical,Wiring"], "mapping.csv"));
  const response = await upload(new Request("https://example.com/api/admin/categories", { method: "POST", body: form }));
  expect(response.status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("import_category_mapping", { p_rows: [{ category: "Civil", subcategory: "Concrete" }, { category: "Electrical", subcategory: "Wiring" }] });
});
