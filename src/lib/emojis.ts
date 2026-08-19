import emojiKoreanSource from '../data/emojis-ko.json';

// 한국어 이모지 이름은 패키지 내부 경로가 아니라 여기 JSON을 쓴다.

type EmojiRecord = { u: string; n?: string[] };
type EmojiSource = { emojis: Record<string, EmojiRecord[]> };

export type EmojiSection = { id: string; label: string; emojis: string[] };
export type EmojiCategory = { id: string; icon: string; emojis: string[]; sections?: EmojiSection[] };

const toNativeEmoji = (unicode: string) => String.fromCodePoint(...unicode.split('-').map(part => Number.parseInt(part, 16)));
const allEmoji = (group: string) => ((emojiKoreanSource as EmojiSource).emojis[group] ?? []).map(emoji => toNativeEmoji(emoji.u));

export const flagCodeByEmoji: Record<string, string> = {
  '🇪🇺': 'eu',
  '🇺🇳': 'un',
};

export const getFlagCode = (emoji: string) => {
  if (flagCodeByEmoji[emoji]) return flagCodeByEmoji[emoji];
  const points = [...emoji].map(character => character.codePointAt(0) ?? 0);
  if (points.length !== 2 || !points.every(point => point >= 0x1F1E6 && point <= 0x1F1FF)) return null;
  return String.fromCharCode(...points.map(point => point - 0x1F1E6 + 65)).toLowerCase();
};

export const emojiAssetCode = (emoji: string) => [...emoji]
  .map(character => (character.codePointAt(0) ?? 0).toString(16))
  .filter(code => code !== 'fe0f')
  .join('-');

const koreanFlagRecords = ((emojiKoreanSource as EmojiSource).emojis.flags ?? []);
export const flagNameByEmoji = Object.fromEntries(koreanFlagRecords.map(record => {
  const sourceName = record.n?.find(item => item.startsWith('깃발:'))?.replace('깃발: ', '') ?? record.n?.at(-1) ?? '깃발';
  const name = sourceName.replace(/\s*\([^)]*\)/g, '');
  return [toNativeEmoji(record.u), name];
}));

const priorityFlagCodes = ['kr', 'us', 'jp', 'cn', 'tw', 'hk', 'in', 'tr', 'vn', 'th', 'sg', 'ph', 'au', 'nz', 'gb', 'ca', 'fr', 'de', 'it', 'es'];
const unsupportedFlagCodes = new Set(['ac', 'cp', 'dg', 'ea', 'ic', 'ta', 'un', 'xk']);
const continentGroups = [
  ['아시아', 'ae af am az bd bh bn bt cc cn cy ge hk id il in iq ir jo jp kg kh kp kr kw kz la lb lk mm mn mo mv my np om ph pk ps qa ru sa sg sy th tj tl tm tr tw uz vn ye'],
  ['유럽', 'ad al at ax ba be bg by ch cz de dk ee es fi fo fr gb gg gi gr hr hu ie im is it je li lt lu lv mc md me mk mt nl no pl pt ro rs se si sj sk sm ua va'],
  ['아메리카', 'ag ai ar aw bb bl bm bo bq br bs bz ca cl co cr cu cw dm do ec fk gd gf gl gp gt gy hn ht jm kn ky lc mf mq ms mx ni pa pe pm pr py sr sv tc tt us uy vc ve vg vi'],
  ['아프리카', 'ao bf bi bj bw cd cf cg ci cm cv dj dz eg eh er et ga gh gm gn gq gw ke km lr ls ly ma mg ml mr mu mw mz na ne ng re rw sc sd sh sl sn so ss st sz td tg tn tz ug yt za zm zw'],
  ['오세아니아', 'as au ck fj fm gu ki mh mp nc nf nr nu nz pf pg pn pw sb tk to tv um vu wf ws'],
] as const;
const continentByCode = new Map(continentGroups.flatMap(([continent, codes]) => codes.split(' ').map(code => [code, continent])));
const countryFlags = allEmoji('flags')
  .filter(emoji => {
    const code = getFlagCode(emoji);
    return code !== null && !unsupportedFlagCodes.has(code);
  });
const flagSortName = (emoji: string) => flagNameByEmoji[emoji] ?? getFlagCode(emoji) ?? '';
const sortedFlags = (flags: string[]) => [...flags].sort((left, right) => flagSortName(left).localeCompare(flagSortName(right), 'ko'));
const priorityFlags = priorityFlagCodes.map(code => countryFlags.find(emoji => getFlagCode(emoji) === code)).filter((emoji): emoji is string => Boolean(emoji));
const sortContinentFlags = (continent: string, flags: string[]) => [...flags].sort((left, right) => {
  if (continent === '아시아') {
    const leftIsKorea = getFlagCode(left) === 'kr';
    const rightIsKorea = getFlagCode(right) === 'kr';
    if (leftIsKorea !== rightIsKorea) return leftIsKorea ? -1 : 1;
  }
  return flagSortName(left).localeCompare(flagSortName(right), 'ko');
});
const flagSections: EmojiSection[] = [
  { id: 'pinned', label: '자주 쓰는 나라', emojis: priorityFlags },
  ...continentGroups.map(([continent]) => ({
    id: continent,
    label: continent,
    emojis: sortContinentFlags(continent, countryFlags.filter(emoji => continentByCode.get(getFlagCode(emoji) ?? '') === continent)),
  })),
  { id: 'other', label: '기타 지역', emojis: sortedFlags(countryFlags.filter(emoji => !continentByCode.has(getFlagCode(emoji) ?? ''))) },
  { id: 'special', label: '기타 깃발', emojis: ['🏁', '🚩', '🎌', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️'] },
].filter(section => section.emojis.length > 0);

// This is only the emoji dataset. The picker UI is rendered by this app in Korean.
export const emojiCategories: readonly EmojiCategory[] = [
  { id: '추천', icon: '⭐', emojis: '📁 📚 📝 ✅ 🎯 💡 💻 📌 🗓️ 🎨 🎵 📷 ☕ 🌱 ❤️ ✨ 🚀 🏆 🧠 🧘'.split(' ') },
  { id: '표정·사람', icon: '😀', emojis: allEmoji('smileys_people') },
  { id: '동물·자연', icon: '🌿', emojis: allEmoji('animals_nature') },
  { id: '음식·음료', icon: '🍎', emojis: allEmoji('food_drink') },
  { id: '여행·장소', icon: '✈️', emojis: allEmoji('travel_places') },
  { id: '활동', icon: '⚽', emojis: allEmoji('activities') },
  { id: '물건', icon: '💡', emojis: allEmoji('objects') },
  { id: '기호', icon: '🔣', emojis: allEmoji('symbols') },
  { id: '깃발', icon: '🇰🇷', emojis: flagSections.flatMap(section => section.emojis), sections: flagSections },
];
