import { useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { authErrorMessage, PasswordField, TextField } from './authUi';

type AuthView = 'login' | 'signup' | 'forgot-email' | 'forgot-code' | 'forgot-new';

export function AuthPanel({ onSuccess }: { onSuccess: () => void }) {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const go = (next: AuthView) => {
    setView(next);
    setError(null);
    setPassword('');
    setPasswordConfirm('');
    setCode('');
  };

  const sendResetCode = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!supabase) {
      setError('로그인 설정이 되어 있지 않습니다.');
      return;
    }
    if (!email.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (resetError) throw resetError;
      setCode('');
      setView('forgot-code');
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      setError('로그인 설정이 되어 있지 않습니다.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (view === 'signup') {
        if (password.length < 6) throw new Error('비밀번호는 6자 이상이어야 합니다.');
        if (password !== passwordConfirm) throw new Error('비밀번호 확인이 일치하지 않습니다.');
        const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (signUpError) throw signUpError;
        if (data.user && !data.session) {
          setError('가입되었습니다. 이메일 인증 후 로그인하세요.');
          return;
        }
        onSuccess();
        return;
      }

      if (view === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
        onSuccess();
        return;
      }

      if (view === 'forgot-code') {
        const token = code.replace(/\s/g, '');
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token,
          type: 'recovery',
        });
        if (verifyError) throw verifyError;
        setPassword('');
        setPasswordConfirm('');
        setView('forgot-new');
        return;
      }

      if (view === 'forgot-new') {
        if (password.length < 6) throw new Error('비밀번호는 6자 이상이어야 합니다.');
        if (password !== passwordConfirm) throw new Error('비밀번호 확인이 일치하지 않습니다.');
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        onSuccess();
      }
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = {
    login: '로그인',
    signup: '회원가입',
    'forgot-email': '비밀번호 찾기',
    'forgot-code': '비밀번호 찾기',
    'forgot-new': '새 비밀번호',
  }[view];

  return (
    <form noValidate autoComplete="off" onSubmit={event => { void (view === 'forgot-email' ? sendResetCode(event) : submit(event)); }}>
      <div className="pointer-events-none absolute h-0 w-0 overflow-hidden" aria-hidden>
        <input type="email" name="email" tabIndex={-1} defaultValue="" />
        <input type="password" name="password" tabIndex={-1} defaultValue="" />
      </div>
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>

      <div className="mt-6 space-y-4">
        {!isSupabaseConfigured && (
          <p className="text-sm text-fg-muted">로그인 설정이 되어 있지 않습니다.</p>
        )}

        {(view === 'login' || view === 'signup' || view === 'forgot-email') && (
          <TextField
            label="이메일"
            value={email}
            onChange={setEmail}
            type="email"
            name="gp-email"
            autoComplete="off"
            lockAutofill
          />
        )}

        {view === 'forgot-code' && (
          <>
            <p className="text-sm text-fg-muted">{email}로 보낸 메일을 확인하세요. 코드가 있으면 아래에 입력하고, 링크가 있으면 그 링크를 누르면 됩니다.</p>
            <TextField
              label="인증 코드"
              value={code}
              onChange={value => setCode(value.replace(/[^\d]/g, '').slice(0, 8))}
              name="gp-otp"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={8}
            />
          </>
        )}

        {(view === 'login' || view === 'signup' || view === 'forgot-new') && (
          <PasswordField
            label={view === 'forgot-new' ? '새 비밀번호' : '비밀번호'}
            value={password}
            onChange={setPassword}
            name="gp-password"
            autoComplete="new-password"
            lockAutofill
          />
        )}

        {(view === 'signup' || view === 'forgot-new') && (
          <PasswordField
            label="비밀번호 확인"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            name="gp-password-confirm"
            autoComplete="new-password"
            lockAutofill
          />
        )}
      </div>

      {view === 'login' && (
        <button
          type="button"
          onClick={() => go('forgot-email')}
          className="mt-3 text-sm text-fg-muted hover:text-fg"
        >
          비밀번호를 잊으셨나요?
        </button>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button disabled={isSubmitting} className="mt-10 w-full rounded-xl bg-ink py-3 font-semibold text-on-ink disabled:opacity-40">
        {isSubmitting
          ? '처리 중…'
          : view === 'signup' ? '가입하기'
            : view === 'forgot-email' ? '인증 코드 보내기'
              : view === 'forgot-code' ? '확인'
                : view === 'forgot-new' ? '비밀번호 변경'
                  : '로그인'}
      </button>

      <p className="mt-4 text-center text-sm text-fg-muted">
        {view === 'signup' && (
          <>
            이미 계정이 있나요?{' '}
            <button type="button" onClick={() => go('login')} className="font-semibold text-fg underline-offset-2 hover:underline">로그인</button>
          </>
        )}
        {view === 'login' && (
          <>
            계정이 없나요?{' '}
            <button type="button" onClick={() => go('signup')} className="font-semibold text-fg underline-offset-2 hover:underline">회원가입</button>
          </>
        )}
        {(view === 'forgot-email' || view === 'forgot-code') && (
          <button type="button" onClick={() => go('login')} className="font-semibold text-fg underline-offset-2 hover:underline">로그인으로</button>
        )}
        {view === 'forgot-code' && (
          <>
            <span className="px-2 text-fg-faint">·</span>
            <button type="button" onClick={() => { void sendResetCode(); }} className="font-semibold text-fg underline-offset-2 hover:underline">다시 보내기</button>
          </>
        )}
      </p>
    </form>
  );
}

export function RecoveryPasswordDialog({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      onDone();
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form noValidate autoComplete="off" onSubmit={event => { void submit(event); }}>
      <h2 className="text-xl font-bold tracking-tight">새 비밀번호</h2>
      <div className="mt-6 space-y-4">
        <PasswordField label="새 비밀번호" value={password} onChange={setPassword} name="gp-recovery-password" autoComplete="new-password" lockAutofill />
        <PasswordField label="비밀번호 확인" value={passwordConfirm} onChange={setPasswordConfirm} name="gp-recovery-password-confirm" autoComplete="new-password" lockAutofill />
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button disabled={isSubmitting} className="mt-10 w-full rounded-xl bg-ink py-3 font-semibold text-on-ink disabled:opacity-40">
        {isSubmitting ? '변경 중…' : '비밀번호 변경'}
      </button>
    </form>
  );
}
