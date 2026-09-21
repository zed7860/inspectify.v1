import { describe, expect, it } from "vitest";
import { parseCategoryMapping } from "../lib/admin/category-mapping";
import { publicAppUrl, inspectionReturnPath } from "../lib/notifications/app-url";

describe("category CSV mapping", () => {
  it("maps repeated parents, quoted commas and deduplicates pairs", () => {
    expect(parseCategoryMapping('\uFEFFCategory,Subcategory\r\nCivil,"Concrete, reinforced"\r\nCivil,Brickwork\r\nCivil,Brickwork\r\n')).toEqual([{ category: "Civil", subcategory: "Concrete, reinforced" }, { category: "Civil", subcategory: "Brickwork" }]);
  });
  it("rejects invalid mappings before any writes", () => {
    for (const text of ['Category,Subcategory\nCivil,', 'Parent,Child\nA,B', 'Category,Subcategory\nA,"B', 'Category,Subcategory\nA,B,C']) expect(() => parseCategoryMapping(text)).toThrow();
  });
});
describe("email links", () => {
  it("accepts any public HTTPS domain", () => expect(publicAppUrl("https://inspect.example.com/")).toBe("https://inspect.example.com"));
  it("rejects missing and local URLs", () => {
    for (const value of ["", "http://localhost:3000", "https://localhost", "https://127.0.0.1", "https://10.1.1.1", "https://user:pass@example.com", "https://example.com/path"]) expect(() => publicAppUrl(value)).toThrow();
  });
  it("only permits inspection paths after login", () => {
    expect(inspectionReturnPath("/inspections/12345678-1234-1234-1234-123456789abc")).toContain("/inspections/");
    for (const value of ["//evil.example", "https://evil.example", "/\\evil.example", "/admin"]) expect(inspectionReturnPath(value)).toBe("");
  });
});
