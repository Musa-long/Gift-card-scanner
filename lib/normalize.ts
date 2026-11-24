const TRANSLIT: Record<string, string> = { O: "0", Q: "0", I: "1", L: "1", S: "5", B: "8", Z: "2" };

export function normalize(raw: string, brand: string): string {
  const base = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
  // Amazon and Xbox alphabets contain no I/O, so fold the ambiguous ones.
  if (brand === "amazon" || brand === "xbox") {
    return base.replace(/[OQ]/g, "0").replace(/[IL]/g, "1");
  }
  return base;
}
