export type Format = {
  brand: string;
  length: number;
  alphabet: string;
  hasCheckDigit: boolean;
  label: string;
};

// Amazon: 14 chars, no published check digit. Alphabet has no I or O.
export const AMAZON: Format = {
  brand: "amazon",
  length: 14,
  alphabet: "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ",
  hasCheckDigit: false,
  label: "Amazon claim code",
};

// Apple: 16 chars, Luhn-mod-36 check digit in final position. VERIFY with real codes.
export const APPLE: Format = {
  brand: "apple",
  length: 16,
  alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  hasCheckDigit: true,
  label: "Apple gift card",
};

// Xbox: 25 chars, base-32 vowel-free alphabet. Check digit unconfirmed upstream.
export const XBOX: Format = {
  brand: "xbox",
  length: 25,
  alphabet: "0123456789BCDFGHJKMPQRTVWXY",
  hasCheckDigit: true,
  label: "Xbox / Microsoft",
};

export const FORMATS: Record<string, Format> = {
  amazon: AMAZON,
  apple: APPLE,
  xbox: XBOX,
};

export const getFormat = (brand: string): Format => {
  const f = FORMATS[brand];
  if (!f) throw new Error(`unknown brand: ${brand}`);
  return f;
};
