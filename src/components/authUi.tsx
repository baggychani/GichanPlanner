import { useState, type HTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';

export const authInputClass = 'w-full rounded-xl border border-line-strong bg-surface-muted px-3 py-2.5 text-[15px] outline-none transition-[border-color] focus:border-indigo-500';

export function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid login credentials/i.test(message)) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (/already registered/i.test(message)) return '이미 가입된 이메일입니다.';
  if (/password/i.test(message) && /at least/i.test(message)) return '비밀번호는 6자 이상이어야 합니다.';
  if (/email not confirmed/i.test(message)) return '이메일 인증이 끝나지 않았습니다.';
  if (/same as the existing/i.test(message)) return '새 비밀번호가 현재와 같습니다.';
  if (/otp_expired|token has expired|expired otp|invalid otp|invalid token|email otp/i.test(message)) {
    return '인증 코드가 올바르지 않거나 만료되었습니다.';
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return '서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.';
  }
  return message || '요청을 처리하지 못했습니다.';
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  name,
  required = true,
  inputMode,
  maxLength,
  lockAutofill = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete: string;
  name?: string;
  required?: boolean;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number;
  lockAutofill?: boolean;
}) {
  const [locked, setLocked] = useState(lockAutofill);

  return (
    <label className="block">
      <span className="text-[13px] font-medium text-fg-muted">{label}</span>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        type={type}
        name={name}
        autoComplete={lockAutofill ? 'off' : autoComplete}
        required={required}
        inputMode={inputMode}
        maxLength={maxLength}
        readOnly={locked}
        onFocus={() => setLocked(false)}
        className={clsx(authInputClass, 'mt-1.5')}
      />
    </label>
  );
}

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  name,
  required = true,
  lockAutofill = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  name?: string;
  required?: boolean;
  lockAutofill?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [locked, setLocked] = useState(lockAutofill);
  const hide = () => setVisible(false);

  return (
    <label className="block">
      <span className="text-[13px] font-medium text-fg-muted">{label}</span>
      <span className="relative mt-1.5 block">
        <input
          value={value}
          onChange={event => onChange(event.target.value)}
          type={visible ? 'text' : 'password'}
          name={name}
          autoComplete={lockAutofill ? 'new-password' : autoComplete}
          required={required}
          readOnly={locked}
          onFocus={() => setLocked(false)}
          className={clsx(authInputClass, 'pr-11')}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="누르는 동안 비밀번호 보기"
          onPointerDown={event => {
            event.preventDefault();
            setVisible(true);
          }}
          onPointerUp={hide}
          onPointerCancel={hide}
          onPointerLeave={hide}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-fg-subtle hover:text-fg"
        >
          {visible ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
        </button>
      </span>
    </label>
  );
}
