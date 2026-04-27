import React from 'react';

type OfficialDbotView = 'dashboard' | 'bot_builder' | 'charts' | 'tutorials';

interface Props {
  view: OfficialDbotView;
}

const VIEW_HASH: Record<OfficialDbotView, string> = {
  dashboard: 'dashboard',
  bot_builder: 'bot_builder',
  charts: 'charts',
  tutorials: 'tutorials',
};

export function OfficialDbotEmbed({ view }: Props) {
  const src = React.useMemo(() => `/official-dbot/official-dbot.html#${VIEW_HASH[view]}`, [view]);

  return (
    <div className="h-full w-full overflow-hidden bg-white">
      <iframe
        key={src}
        src={src}
        title="Official Deriv DBot"
        className="h-full w-full border-0"
        loading="eager"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
