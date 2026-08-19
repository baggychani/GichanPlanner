import { emojiAssetCode, getFlagCode } from '../lib/emojis';

type EmojiIconProps = {
  emoji: string;
  className?: string;
};

export function EmojiIcon({ emoji, className = 'h-4 w-5' }: EmojiIconProps) {
  const flagCode = getFlagCode(emoji);
  const imageSource = flagCode
    ? `https://flagcdn.com/w80/${flagCode}.png`
    : `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/${emojiAssetCode(emoji)}.svg`;

  return (
    <span className={`inline-flex items-center justify-center ${className}`}>
      <img
        src={imageSource}
        alt=""
        loading="lazy"
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
