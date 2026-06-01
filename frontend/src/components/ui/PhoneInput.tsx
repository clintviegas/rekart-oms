'use client';

import { PHONE_CODES, DEFAULT_PHONE_CODE } from '@/lib/phone-codes';

export function PhoneInput({
  countryCode,
  digits,
  onCountryCodeChange,
  onDigitsChange,
  className = ''
}: {
  countryCode: string;
  digits: string;
  onCountryCodeChange: (code: string) => void;
  onDigitsChange: (digits: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-2 ${className}`}>
      <select
        value={countryCode}
        onChange={e => onCountryCodeChange(e.target.value)}
        className="w-[110px] shrink-0 rounded-xl border border-navy/15 bg-white px-2 py-2.5 text-sm text-navy"
        aria-label="Country code"
      >
        {PHONE_CODES.map(c => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.code}
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="numeric"
        value={digits}
        onChange={e => onDigitsChange(e.target.value.replace(/\D/g, ''))}
        placeholder="501234567"
        className="min-w-0 flex-1 rounded-xl border border-navy/15 bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </div>
  );
}

export function fullPhone(countryCode: string, digits: string) {
  const code = countryCode || DEFAULT_PHONE_CODE;
  const d = digits.replace(/\D/g, '');
  return d ? `${code}${d}` : '';
}

export function parsePhone(full: string) {
  const match = PHONE_CODES.find(c => full.startsWith(c.code));
  if (match) return { countryCode: match.code, digits: full.slice(match.code.length).replace(/\D/g, '') };
  return { countryCode: DEFAULT_PHONE_CODE, digits: full.replace(/\D/g, '') };
}
