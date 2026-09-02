import { supabase } from './supabase';

export type PartnerInvite = { id: string; code: string; createdAt: string; expiresAt: string };
export type Partner = { id: string; nickname: string; avatarPath: string | null };

async function requireUserId() {
  if (!supabase) throw new Error('로그인 설정이 되어 있지 않습니다.');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인한 뒤에 이용할 수 있습니다.');
  return user.id;
}

function randomInviteCode() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

export async function createPartnerInvite(): Promise<PartnerInvite> {
  const inviterId = await requireUserId();
  const { data, error } = await supabase!
    .from('partner_invites')
    .insert({ inviter_id: inviterId, code: randomInviteCode() })
    .select('id, code, created_at, expires_at')
    .single();
  if (error) throw error;
  return { id: data.id as string, code: data.code as string, createdAt: data.created_at as string, expiresAt: data.expires_at as string };
}

export async function listPendingInvites(): Promise<PartnerInvite[]> {
  await requireUserId();
  const { data, error } = await supabase!
    .from('partner_invites')
    .select('id, code, created_at, expires_at')
    .is('accepted_by', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string; code: string; created_at: string; expires_at: string }>)
    .map(row => ({ id: row.id, code: row.code, createdAt: row.created_at, expiresAt: row.expires_at }));
}

export async function revokeInvite(id: string) {
  await requireUserId();
  const { error } = await supabase!.from('partner_invites').delete().eq('id', id);
  if (error) throw error;
}

export async function acceptPartnerInvite(code: string) {
  if (!supabase) throw new Error('로그인 설정이 되어 있지 않습니다.');
  const { error } = await supabase.rpc('accept_partner_invite', { invite_code: code.trim().toUpperCase() });
  if (error) {
    if (/invalid_or_expired_code/.test(error.message)) throw new Error('코드가 올바르지 않거나 만료되었습니다.');
    if (/cannot_link_self/.test(error.message)) throw new Error('내가 만든 코드는 사용할 수 없습니다.');
    throw error;
  }
}

export async function listPartners(): Promise<Partner[]> {
  const userId = await requireUserId();
  const client = supabase!;
  const { data: links, error: linksError } = await client.from('partner_links').select('user_b').eq('user_a', userId);
  if (linksError) throw linksError;
  const partnerIds = ((links ?? []) as Array<{ user_b: string }>).map(row => row.user_b);
  if (partnerIds.length === 0) return [];
  const { data: profiles, error: profilesError } = await client.from('profiles').select('id, nickname, avatar_path').in('id', partnerIds);
  if (profilesError) throw profilesError;
  return ((profiles ?? []) as Array<{ id: string; nickname: string; avatar_path: string | null }>)
    .map(row => ({ id: row.id, nickname: row.nickname, avatarPath: row.avatar_path ?? null }));
}

export async function unlinkPartner(partnerId: string) {
  const userId = await requireUserId();
  const { error } = await supabase!
    .from('partner_links')
    .delete()
    .or(`and(user_a.eq.${userId},user_b.eq.${partnerId}),and(user_a.eq.${partnerId},user_b.eq.${userId})`);
  if (error) throw error;
}
