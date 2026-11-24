export function checkChar(body: string, alphabet: string): string {
  const n = alphabet.length;
  let factor = 2;
  let sum = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    let addend = factor * alphabet.indexOf(body[i]);
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / n) + (addend % n);
    sum += addend;
  }
  return alphabet[(n - (sum % n)) % n];
}

export function isChecksumValid(code: string, alphabet: string): boolean {
  if (code.length < 2) return false;
  return code.at(-1) === checkChar(code.slice(0, -1), alphabet);
}
