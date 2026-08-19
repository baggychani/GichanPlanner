import { useEffect, useState } from 'react';
import { Camera, Globe2, LogOut, Mail, UserRound, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { UserLogin } from 'dexie-cloud-addon';
import { AvatarCropDialog } from './AvatarCropDialog';
import { Overlay } from './Overlay';
import { db, isDexieCloudConfigured } from '../lib/db';
import { downloadPortablePlannerExport } from '../lib/portablePlannerExport';

export function ProfileModal({ user, onClose }: { user: UserLogin | undefined; onClose: () => void }) {
  const profile = useLiveQuery(() => db.profiles.get('#profile'));
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [croppingFile, setCroppingFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const isLoggedIn = Boolean(user?.isLoggedIn);
  const fallbackName = user?.name || user?.email?.split('@')[0] || '사용자';

  useEffect(() => { if (profile?.nickname) setNickname(profile.nickname); else if (isLoggedIn) setNickname(fallbackName); }, [profile?.nickname, isLoggedIn, fallbackName]);
  useEffect(() => {
    if (!profile?.avatar) { setAvatarUrl(null); return; }
    const url = URL.createObjectURL(profile.avatar); setAvatarUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [profile?.avatar]);

  useEffect(() => {
    if (!isLoggedIn || !user?.userId) return;
    const now = new Date().toISOString();
    void db.profiles.get('#profile').then(existing => db.profiles.put({
      id: '#profile',
      nickname: existing?.nickname || fallbackName,
      avatar: existing?.avatar ?? null,
      legacy_dexie_user_id: user.userId ?? null,
      email: user.email ?? null,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    }));
  }, [fallbackName, isLoggedIn, user?.email, user?.userId]);

  const saveProfile = async (avatar = profile?.avatar ?? null) => {
    if (!nickname.trim()) return;
    const now = new Date().toISOString();
    await db.profiles.put({
      id: '#profile',
      nickname: nickname.trim(),
      avatar,
      legacy_dexie_user_id: user?.userId ?? profile?.legacy_dexie_user_id ?? null,
      email: user?.email ?? profile?.email ?? null,
      created_at: profile?.created_at ?? now,
      updated_at: now,
    });
  };
  const loginWithEmail = async (event: React.FormEvent) => {
    event.preventDefault(); if (!email.trim()) return;
    setIsSubmitting(true); setNotice(null);
    try { await db.cloud.login({ email: email.trim(), grant_type: 'otp' }); setNotice('이메일로 전송된 일회용 코드를 확인하세요.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : '로그인을 시작하지 못했습니다.'); }
    finally { setIsSubmitting(false); }
  };
  const loginWithGoogle = async () => {
    setIsSubmitting(true); setNotice(null);
    try { await db.cloud.login({ provider: 'google' }); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Google 로그인을 시작하지 못했습니다.'); }
    finally { setIsSubmitting(false); }
  };

  return <Overlay zClassName="z-[70]">
    <section aria-label="프로필 및 계정" className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl">
      <div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-bold">프로필 및 계정</h2><button onClick={onClose} aria-label="프로필 닫기" className="rounded-full p-2 text-fg-muted hover:bg-surface-hover"><X size={20} /></button></div>
      {!isDexieCloudConfigured ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Dexie Cloud DB URL이 아직 없습니다. <code>.env.local</code>에 <code>VITE_DEXIE_CLOUD_URL</code>을 넣으면 이메일 코드와 Google 로그인을 사용할 수 있습니다.</div> : isLoggedIn ? <div className="space-y-5">
        <div className="flex items-center gap-4"><label className="relative grid h-16 w-16 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-indigo-100 text-indigo-700"><>{avatarUrl ? <img src={avatarUrl} alt="프로필 사진" className="h-full w-full object-cover" /> : <UserRound size={30} />}</><span className="absolute inset-x-0 bottom-0 grid h-6 place-items-center bg-black/40 text-white"><Camera size={13} /></span><input aria-label="프로필 사진 변경" type="file" accept="image/*" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 10 * 1024 * 1024) { setNotice('원본 사진은 10MB 이하만 선택할 수 있습니다.'); return; } setCroppingFile(file); event.currentTarget.value = ''; }} /></label><div className="min-w-0"><p className="truncate font-semibold">{profile?.nickname || fallbackName}</p><p className="truncate text-sm text-fg-muted">{user?.email || user?.userId}</p></div></div>
        <label className="block text-sm font-medium">닉네임<input value={nickname} onChange={event => setNickname(event.target.value)} maxLength={40} className="mt-1.5 w-full rounded-xl border border-line bg-surface-muted px-3 py-2.5 outline-none focus:border-indigo-500" /></label>
        {notice && <p role="status" className="rounded-xl bg-surface-muted p-3 text-sm text-fg-muted">{notice}</p>}
        <button onClick={() => { void saveProfile().then(() => setNotice('프로필을 저장했습니다.')); }} disabled={!nickname.trim()} className="w-full rounded-xl bg-ink py-3 font-semibold text-on-ink disabled:opacity-40">프로필 저장</button>
        <button onClick={() => { void downloadPortablePlannerExport().then(() => setNotice('사진을 포함한 이식용 백업을 내려받았습니다.')).catch(() => setNotice('백업을 만들지 못했습니다.')); }} className="w-full rounded-xl border border-line py-3 text-sm font-medium text-fg-muted hover:bg-surface-muted">내 데이터 백업 다운로드</button>
        <button onClick={() => { void db.cloud.logout(); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-sm font-medium text-fg-muted hover:bg-surface-muted"><LogOut size={16} />이 기기에서 로그아웃</button>
      </div> : <form onSubmit={event => { void loginWithEmail(event); }} className="space-y-4"><p className="text-sm leading-6 text-fg-muted">비밀번호를 저장하지 않는 이메일 일회용 코드 로그인입니다. Google 로그인도 사용할 수 있습니다.</p><label className="block text-sm font-medium">이메일<input value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" required className="mt-1.5 w-full rounded-xl border border-line bg-surface-muted px-3 py-2.5 outline-none focus:border-indigo-500" /></label>{notice && <p role="status" className="rounded-xl bg-surface-muted p-3 text-sm text-fg-muted">{notice}</p>}<button disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 font-semibold text-on-ink disabled:opacity-40"><Mail size={17} />이메일 코드 받기</button><button type="button" disabled={isSubmitting} onClick={() => { void loginWithGoogle(); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 font-medium hover:bg-surface-muted disabled:opacity-40"><Globe2 size={17} />Google로 계속하기</button></form>}
    </section>
    {croppingFile && <AvatarCropDialog file={croppingFile} onClose={() => setCroppingFile(null)} onSave={image => { setCroppingFile(null); void saveProfile(image).then(() => setNotice('프로필 사진을 저장했습니다.')); }} />}
  </Overlay>;
}
