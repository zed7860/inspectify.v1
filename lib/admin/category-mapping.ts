export function parseCategoryMapping(source: string) {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const text = source.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === "," || char === "\n" || char === "\r")) {
      row.push(cell.trim()); cell = "";
      if (char !== ",") { if (row.some(Boolean)) rows.push(row); row = []; if (char === "\r" && text[i + 1] === "\n") i++; }
    } else cell += char;
  }
  if (quoted) throw new Error("Unclosed quote in CSV file.");
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  const header = rows.shift();
  if (header?.length !== 2 || header[0].toLowerCase() !== "category" || header[1].toLowerCase() !== "subcategory") throw new Error("Use the template columns: Category,Subcategory.");
  if (!rows.length || rows.length > 2000) throw new Error("Include between 1 and 2,000 mapping rows.");
  const mappings = rows.map((values, index) => {
    if (values.length !== 2 || values.some((value) => !value || value.length > 200)) throw new Error(`Row ${index + 2}: provide a category and subcategory, each up to 200 characters.`);
    return { category: values[0], subcategory: values[1] };
  });
  return [...new Map(mappings.map((mapping) => [JSON.stringify(mapping), mapping])).values()];
}
