import { useEffect, useState } from 'react';
import { Camera, ChevronLeft, LogOut, UserRound, X, Calendar as CalendarIcon } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { AvatarCropDialog } from './AvatarCropDialog';
import { Overlay } from './Overlay';
import { db } from '../lib/db';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { runPlannerWrite, signOutPlanner } from '../lib/supabaseSync';
import { AuthPanel } from './AuthScreen';
import { BirthdayPickerModal } from './BirthdayPickerModal';
import { authErrorMessage, authInputClass, PasswordField } from './authUi';

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const { session, isLoading } = useAuth();
  const [openedLoggedIn, setOpenedLoggedIn] = useState<boolean | null>(() => (isLoading ? null : Boolean(session)));
  const profile = useLiveQuery(() => db.profiles.get('#profile'));
  const [view, setView] = useState<'profile' | 'password'>('profile');
  const [nickname, setNickname] = useState('');
  const [birthdayMonth, setBirthdayMonth] = useState<number | null>(null);
  const [birthdayDay, setBirthdayDay] = useState<number | null>(null);
  const [isBirthdayPickerOpen, setIsBirthdayPickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(1);
  const [pickerDay, setPickerDay] = useState(1);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [croppingFile, setCroppingFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const supabaseUser = session?.user ?? null;
  const accountEmail = supabaseUser?.email || profile?.email || '';
  const fallbackName = accountEmail.split('@')[0] || '사용자';

  useEffect(() => {
    if (isLoading || openedLoggedIn !== null) return;
    setOpenedLoggedIn(Boolean(session));
  }, [isLoading, openedLoggedIn, session]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (profile?.nickname) setNickname(profile.nickname);
    else setNickname(fallbackName);
    setBirthdayMonth(profile?.birthday_month ?? null);
    setBirthdayDay(profile?.birthday_day ?? null);
  }, [profile?.nickname, profile?.birthday_month, profile?.birthday_day, fallbackName]);

  useEffect(() => {
    if (!profile?.avatar) { setAvatarUrl(null); return; }
    const url = URL.createObjectURL(profile.avatar);
    setAvatarUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [profile?.avatar]);

  useEffect(() => {
    if (!openedLoggedIn) return;
    void db.profiles.get('#profile').then(existing => {
      if (!existing) return;
      const email = accountEmail || existing.email || null;
      if (existing.email === email) return;
      return runPlannerWrite(() => db.profiles.put({ ...existing, email }));
    });
  }, [accountEmail, openedLoggedIn]);

  const saveProfile = async (avatar = profile?.avatar ?? null) => {
    if (!nickname.trim()) return;
    const now = new Date().toISOString();
    await runPlannerWrite(() => db.profiles.put({
      id: '#profile',
      nickname: nickname.trim(),
      avatar,
      legacy_dexie_user_id: profile?.legacy_dexie_user_id ?? null,
      email: accountEmail || profile?.email || null,
      birthday_month: birthdayMonth,
      birthday_day: birthdayDay,
      created_at: profile?.created_at ?? now,
      updated_at: now,
    }));
  };

  const submitPasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: accountEmail,
        password: currentPassword,
      });
      if (verifyError) throw new Error('현재 비밀번호가 올바르지 않습니다.');
      if (newPassword.length < 6) throw new Error('비밀번호는 6자 이상이어야 합니다.');
      if (newPassword !== newPasswordConfirm) throw new Error('비밀번호 확인이 일치하지 않습니다.');
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
      setView('profile');
      setToast('비밀번호를 변경했습니다.');
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = async () => {
    await signOutPlanner();
    onClose();
  };

  const title = view === 'password' ? '비밀번호 변경' : '프로필';

  return (
    <Overlay
      zClassName="z-[70]"
      onEscape={() => {
        if (view === 'password') {
          setView('profile');
          setError(null);
          return;
        }
        if (isBirthdayPickerOpen) {
          setIsBirthdayPickerOpen(false);
          return;
        }
        onClose();
      }}
    >
      <section aria-label="프로필 및 계정" className="w-full max-w-[400px] rounded-3xl border border-line bg-surface p-6 shadow-2xl">
        {openedLoggedIn === null && (
          <div className="flex justify-end">
            <button onClick={onClose} aria-label="닫기" className="-mr-2 rounded-full p-2 text-fg-muted hover:bg-surface-hover"><X size={20} /></button>
          </div>
        )}
        {openedLoggedIn === false && (
          <>
            <div className="mb-2 flex justify-end">
              <button onClick={onClose} aria-label="닫기" className="-mr-2 rounded-full p-2 text-fg-muted hover:bg-surface-hover"><X size={20} /></button>
            </div>
            <AuthPanel onSuccess={() => setOpenedLoggedIn(true)} />
          </>
        )}
        {openedLoggedIn === true && (
          <>
        <div className="mb-6 flex items-center gap-1">
          {view === 'password' && (
            <button
              type="button"
              onClick={() => { setView('profile'); setError(null); }}
              aria-label="프로필로 돌아가기"
              className="-ml-2 rounded-full p-2 text-fg hover:bg-surface-hover"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <h2 className="flex-1 text-xl font-bold tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="닫기" className="rounded-full p-2 text-fg-muted hover:bg-surface-hover"><X size={20} /></button>
        </div>

        {view === 'profile' && (
          <div>
            <div className="flex items-center gap-4">
              <label className="relative grid h-16 w-16 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {avatarUrl ? <img src={avatarUrl} alt="프로필 사진" className="h-full w-full object-cover" /> : <UserRound size={30} />}
                <span className="absolute inset-x-0 bottom-0 grid h-6 place-items-center bg-black/40 text-white"><Camera size={13} /></span>
                <input
                  aria-label="프로필 사진 변경"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.size > 10 * 1024 * 1024) { setToast('원본 사진은 10MB 이하만 선택할 수 있습니다.'); return; }
                    setCroppingFile(file);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
              <div className="min-w-0">
                <p className="truncate text-[17px] font-semibold">{profile?.nickname || fallbackName}</p>
                <p className="truncate text-sm text-fg-muted">{accountEmail}</p>
              </div>
            </div>

            <label className="mt-6 block">
              <span className="text-[13px] font-medium text-fg-muted">닉네임</span>
              <input value={nickname} onChange={event => setNickname(event.target.value)} maxLength={40} className={clsx(authInputClass, 'mt-1.5')} />
            </label>
            <div className="mt-4">
              <span className="text-[13px] font-medium text-fg-muted">생일</span>
              <div className="mt-1.5 flex items-center justify-between rounded-xl border border-line-strong bg-surface-muted px-3 py-2.5">
                <span className="text-[15px] text-fg-muted">
                  {birthdayMonth && birthdayDay ? `${birthdayMonth}월 ${birthdayDay}일` : '생일 없음'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPickerMonth(birthdayMonth ?? 1);
                    setPickerDay(birthdayDay ?? 1);
                    setIsBirthdayPickerOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-fg shadow-sm hover:bg-surface-hover"
                >
                  <CalendarIcon size={14} /> 생일 설정
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                void saveProfile()
                  .then(() => setToast('프로필을 저장했습니다.'))
                  .catch(caught => setToast(authErrorMessage(caught)));
              }}
              disabled={!nickname.trim()}
              className="mt-4 w-full rounded-xl bg-ink py-3 font-semibold text-on-ink disabled:opacity-40"
            >
              저장
            </button>

            <div className="mt-6 border-t border-line pt-2">
              <button
                type="button"
                onClick={() => { setView('password'); setError(null); }}
                className="flex w-full items-center justify-between rounded-xl px-1 py-3 text-[15px] font-medium text-fg hover:bg-surface-muted"
              >
                비밀번호 변경
                <ChevronLeft size={18} className="rotate-180 text-fg-subtle" />
              </button>
              <button
                type="button"
                onClick={() => { void logout(); }}
                className="mt-1 flex w-full items-center gap-2 rounded-xl px-1 py-3 text-[15px] font-medium text-fg hover:bg-surface-muted"
              >
                <LogOut size={16} strokeWidth={1.75} />
                로그아웃
              </button>
            </div>
          </div>
        )}

        {view === 'password' && (
          <form noValidate onSubmit={event => { void submitPasswordChange(event); }} className="space-y-4">
            <PasswordField label="현재 비밀번호" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
            <PasswordField label="새 비밀번호" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
            <PasswordField label="새 비밀번호 확인" value={newPasswordConfirm} onChange={setNewPasswordConfirm} autoComplete="new-password" />
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button disabled={isSubmitting} className="w-full rounded-xl bg-ink py-3 font-semibold text-on-ink disabled:opacity-40">
              {isSubmitting ? '변경 중…' : '비밀번호 변경'}
            </button>
          </form>
        )}
          </>
        )}
      </section>

      {toast && (
        <p role="status" className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-on-ink shadow-lg">
          {toast}
        </p>
      )}

      {croppingFile && (
        <AvatarCropDialog
          file={croppingFile}
          onClose={() => setCroppingFile(null)}
          onSave={image => {
            setCroppingFile(null);
            void saveProfile(image).then(
              () => setToast('프로필 사진을 저장했습니다.'),
              caught => setToast(authErrorMessage(caught)),
            );
          }}
        />
      )}
      {isBirthdayPickerOpen && (
        <BirthdayPickerModal
          month={pickerMonth}
          day={pickerDay}
          onMonthChange={setPickerMonth}
          onDayChange={setPickerDay}
          onClose={() => setIsBirthdayPickerOpen(false)}
          onClear={() => {
            setBirthdayMonth(null);
            setBirthdayDay(null);
            setIsBirthdayPickerOpen(false);
          }}
          onConfirm={() => {
            setBirthdayMonth(pickerMonth);
            setBirthdayDay(pickerDay);
            setIsBirthdayPickerOpen(false);
          }}
        />
      )}
    </Overlay>
  );
}
