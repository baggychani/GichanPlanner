import { useEffect, useState } from 'react';
import { Check, Copy, UserMinus, UserRound, X } from 'lucide-react';
import clsx from 'clsx';
import { acceptPartnerInvite, createPartnerInvite, listPartners, listPendingInvites, revokeInvite, unlinkPartner, type Partner, type PartnerInvite } from '../lib/partnerLink';
import { authErrorMessage, authInputClass } from './authUi';
import { Overlay } from './Overlay';
import { PartnerCalendarView } from './PartnerCalendarView';

export function PartnerLinkModal({ onClose }: { onClose: () => void }) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [invites, setInvites] = useState<PartnerInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingPartner, setViewingPartner] = useState<Partner | null>(null);

  const refresh = () => Promise.all([listPartners(), listPendingInvites()]).then(([nextPartners, nextInvites]) => {
    setPartners(nextPartners);
    setInvites(nextInvites);
  });

  useEffect(() => {
    setIsLoading(true);
    refresh().catch((caught: unknown) => setLoadError(authErrorMessage(caught))).finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const runAction = async (action: () => Promise<void>) => {
    setIsSubmitting(true);
    try {
      await action();
      await refresh();
    } catch (caught) {
      setToast(authErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setToast('코드를 복사했습니다.');
    } catch {
      setToast(code);
    }
  };

  return (
    <Overlay zClassName="z-[75]" onEscape={onClose} onBackdropClick={onClose}>
      <section aria-label="파트너 연결" className="w-full max-w-[400px] rounded-3xl border border-line bg-surface p-6 shadow-2xl">
        <div className="mb-6 flex items-center gap-1">
          <h2 className="flex-1 text-xl font-bold tracking-tight">파트너 연결</h2>
          <button onClick={onClose} aria-label="닫기" className="rounded-full p-2 text-fg-muted hover:bg-surface-hover"><X size={20} /></button>
        </div>

        {isLoading && <p className="py-6 text-center text-sm text-fg-muted">불러오는 중…</p>}
        {!isLoading && loadError && <p className="py-6 text-center text-sm text-red-600 dark:text-red-400">{loadError}</p>}

        {!isLoading && !loadError && (
          <>
            <div>
              <p className="text-[13px] font-medium text-fg-muted">연결된 파트너</p>
              {partners.length === 0 && <p className="mt-2 text-sm text-fg-faint">아직 연결된 파트너가 없습니다.</p>}
              <ul className="mt-2 space-y-1">
                {partners.map(partner => (
                  <li key={partner.id} className="flex items-center gap-1 rounded-xl hover:bg-surface-muted">
                    <button type="button" onClick={() => setViewingPartner(partner)} className="flex min-w-0 flex-1 items-center gap-3 px-1 py-2 text-left">
                      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        <UserRound size={18} />
                      </span>
                      <span className="min-w-0 truncate text-[15px] font-medium">{partner.nickname}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { void runAction(() => unlinkPartner(partner.id)); }}
                      disabled={isSubmitting}
                      aria-label={`${partner.nickname}님과 연결 해제`}
                      className="shrink-0 rounded-full p-2 text-fg-subtle hover:bg-surface-hover hover:text-fg disabled:opacity-40"
                    >
                      <UserMinus size={16} strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 border-t border-line pt-4">
              <p className="text-[13px] font-medium text-fg-muted">초대 코드 만들기</p>
              <p className="mt-1 text-sm text-fg-faint">코드를 만들어 상대방에게 전달하세요. 7일간 유효합니다.</p>
              <button
                type="button"
                onClick={() => { void runAction(async () => { await createPartnerInvite(); }); }}
                disabled={isSubmitting}
                className="mt-3 w-full rounded-xl border border-line-strong bg-surface-muted py-2.5 text-[15px] font-medium text-fg hover:bg-surface-hover disabled:opacity-40"
              >
                코드 만들기
              </button>
              {invites.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {invites.map(invite => (
                    <li key={invite.id} className="flex items-center gap-2 rounded-xl border border-line-strong bg-surface-muted px-3 py-2">
                      <span className="flex-1 font-mono text-[15px] tracking-wider">{invite.code}</span>
                      <button type="button" onClick={() => { void copyCode(invite.code); }} aria-label="코드 복사" className="rounded-full p-1.5 text-fg-subtle hover:bg-surface-hover hover:text-fg">
                        <Copy size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { void runAction(() => revokeInvite(invite.id)); }}
                        disabled={isSubmitting}
                        aria-label="코드 취소"
                        className="rounded-full p-1.5 text-fg-subtle hover:bg-surface-hover hover:text-fg disabled:opacity-40"
                      >
                        <X size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <form
              onSubmit={event => {
                event.preventDefault();
                if (!codeInput.trim()) return;
                void runAction(async () => {
                  await acceptPartnerInvite(codeInput);
                  setCodeInput('');
                  setToast('연결되었습니다.');
                });
              }}
              className="mt-6 border-t border-line pt-4"
            >
              <p className="text-[13px] font-medium text-fg-muted">코드로 연결하기</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={codeInput}
                  onChange={event => setCodeInput(event.target.value.toUpperCase())}
                  maxLength={8}
                  placeholder="8자리 코드"
                  className={clsx(authInputClass, 'font-mono tracking-wider')}
                />
                <button type="submit" disabled={isSubmitting || !codeInput.trim()} aria-label="코드로 연결하기" className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-on-ink disabled:opacity-40">
                  <Check size={18} />
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      {toast && (
        <p role="status" className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-on-ink shadow-lg">
          {toast}
        </p>
      )}

      {viewingPartner && <PartnerCalendarView partner={viewingPartner} onClose={() => setViewingPartner(null)} />}
    </Overlay>
  );
}
