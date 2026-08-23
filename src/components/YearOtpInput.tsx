import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import clsx from 'clsx';

type YearOtpInputProps = {
  value: number | null;
  onChange: (value: number | null) => void;
};

function digitsFromYear(value: number | null) {
  if (value == null) return ['', '', '', ''];
  const text = String(value).padStart(4, '0').slice(-4);
  return text.split('');
}

export function YearOtpInput({ value, onChange }: YearOtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = digitsFromYear(value);

  const commitDigits = (nextDigits: string[]) => {
    if (nextDigits.every(digit => digit === '')) {
      onChange(null);
      return;
    }
    const joined = nextDigits.map(digit => digit || '0').join('');
    const parsed = Number.parseInt(joined, 10);
    onChange(Number.isNaN(parsed) ? null : parsed);
  };

  const setDigit = (index: number, digit: string) => {
    const next = [...digits];
    next[index] = digit;
    commitDigits(next);
  };

  const handleInput = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    setDigit(index, digit);
    if (digit && index < 3) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;
    const next = ['', '', '', ''];
    for (let index = 0; index < pasted.length; index += 1) next[index] = pasted[index] ?? '';
    commitDigits(next);
    refs.current[Math.min(pasted.length, 3)]?.focus();
  };

  return (
    <div className="flex items-center justify-center gap-2.5">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={element => { refs.current[index] = element; }}
          value={digit}
          inputMode="numeric"
          maxLength={1}
          aria-label={`기준 연도 ${index + 1}번째 자리`}
          onChange={event => handleInput(index, event.target.value)}
          onKeyDown={event => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={event => event.target.select()}
          className={clsx(
            'h-12 w-11 rounded-xl border text-center text-lg font-semibold tabular-nums outline-none transition-colors',
            digit ? 'border-line-strong bg-surface text-fg' : 'border-line bg-surface-muted text-fg-muted',
            'focus:border-fg-subtle focus:bg-surface',
          )}
        />
      ))}
    </div>
  );
}
