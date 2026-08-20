import { emojiAssetCode, getFlagCode } from '../lib/emojis';

const TWEMOJI_VERSION = '15.1.0';

export function emojiImageUrl(emoji: string) {
  const flagCode = getFlagCode(emoji);
  if (flagCode) return `https://flagcdn.com/w80/${flagCode}.png`;
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${TWEMOJI_VERSION}/assets/svg/${emojiAssetCode(emoji)}.svg`;
}

const prefetched = new Set<string>();

export function prefetchEmojiImages(emojis: readonly string[]) {
  for (const emoji of emojis) {
    const url = emojiImageUrl(emoji);
    if (prefetched.has(url)) continue;
    prefetched.add(url);
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
  }
}

type EmojiIconProps = {
  emoji: string;
  className?: string;
};

export function EmojiIcon({ emoji, className = 'h-4 w-5' }: EmojiIconProps) {
  return (
    <span className={`inline-flex items-center justify-center ${className}`}>
      <img
        src={emojiImageUrl(emoji)}
        alt=""
        loading="eager"
        decoding="async"
        className="h-full w-full object-contain"
        onError={(event) => {
          event.currentTarget.classList.add('hidden');
          event.currentTarget.nextElementSibling?.classList.remove('hidden');
        }}
      />
      <span className="hidden text-inherit leading-none">{emoji}</span>
    </span>
  );
}
