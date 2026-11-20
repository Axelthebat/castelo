import type { SVGProps } from 'react';

export type IconName =
  | 'knight'
  | 'puzzle'
  | 'book'
  | 'trophy'
  | 'users'
  | 'history'
  | 'search'
  | 'menu'
  | 'close'
  | 'user'
  | 'gear'
  | 'logout'
  | 'flag'
  | 'clock'
  | 'crown'
  | 'chevron-down'
  | 'chevron-right'
  | 'check'
  | 'plus'
  | 'link'
  | 'arrow-left'
  | 'arrow-right'
  | 'board'
  | 'target'
  | 'copy'
  | 'download'
  | 'send'
  | 'bot'
  | 'shield'
  | 'handshake'
  | 'chart'
  | 'sun'
  | 'moon';

const PATHS: Record<IconName, string> = {
  knight:
    'M5 19h14M6 19l1.2-5.2a4 4 0 0 1 .6-1.4l3.4-4.9L8.8 5.9 7 7.5 5.5 6.2 6.7 4l4.6 1.6 2.2-2.1a3.2 3.2 0 0 1 3.9 4.6l-2.1 3.3 1.5 3.6M11.4 9.9l.7 1.6',
  puzzle:
    'M10 4h4v2.2a1.8 1.8 0 1 0 3.6 0V4h2.4v4.2h-2.2a1.8 1.8 0 1 0 0 3.6h2.2V20H14v-2.2a1.8 1.8 0 1 0-3.6 0V20H6.4v-4.2H4.2a1.8 1.8 0 1 1 0-3.6h2.2V4H10Z',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5v-15ZM4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5Z',
  trophy:
    'M7 4h10v5a5 5 0 0 1-10 0V4Zm0 2H4.5A2.5 2.5 0 0 0 7 8.5M17 6h2.5A2.5 2.5 0 0 1 17 8.5M10 14v3M14 14v3M7.5 20h9M9 17h6v3H9z',
  users:
    'M15.5 20v-1.5a3.5 3.5 0 0 0-3.5-3.5H6.5A3.5 3.5 0 0 0 3 18.5V20M9.25 11.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5ZM16.5 4.2a3.75 3.75 0 0 1 0 7.3M18 15.2a3.5 3.5 0 0 1 3 3.3V20',
  history:
    'M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5V10h5.5M12 7.5V12l3 1.8',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
  gear: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm8-3.2a8 8 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a8 8 0 0 0-2-1.2L15.2 3h-4l-.4 2.6a8 8 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a8 8 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 2 1.2l.4 2.6h4l.4-2.6a8 8 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.06-.4.1-.8.1-1.2Z',
  logout: 'M15 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2M10 12h11M18 9l3 3-3 3',
  flag: 'M5 21V4M5 5h11l-1.5 3.5L16 12H5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3.5 2',
  crown: 'M4 18h16M4 18l-1-9 5 3.5L12 5l4 7.5L21 9l-1 9',
  'chevron-down': 'M6 9.5 12 15l6-5.5',
  'chevron-right': 'M9.5 6 15 12l-5.5 6',
  check: 'M4.5 12.5 9.5 17.5 19.5 6.5',
  plus: 'M12 5v14M5 12h14',
  link: 'M10 13a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7l-1.3 1.3M14 11a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 1 0 5.7 5.7l1.3-1.3',
  'arrow-left': 'M19 12H5M11 6l-6 6 6 6',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  board: 'M4 4h16v16H4zM4 10h16M4 16h16M10 4v16M16 4v16',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0-3.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  copy: 'M9 9V5.5A1.5 1.5 0 0 1 10.5 4h8A1.5 1.5 0 0 1 20 5.5v8a1.5 1.5 0 0 1-1.5 1.5H15M5.5 9h8A1.5 1.5 0 0 1 15 10.5v8A1.5 1.5 0 0 1 13.5 20h-8A1.5 1.5 0 0 1 4 18.5v-8A1.5 1.5 0 0 1 5.5 9Z',
  download: 'M12 4v11M8 11l4 4 4-4M5 20h14',
  send: 'M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8 21 3Z',
  bot: 'M7 8h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2ZM12 8V5M9.5 12v1M14.5 12v1M9 19v2M15 19v2',
  shield: 'M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3Z',
  handshake:
    'M3 11l3-3 3 1 2-2 2 2 3-1 3 3M8 9l2 2 2-2 2 2M7 13l2 2 2-2 2 2 2-1M11 15l2 2',
  chart: 'M4 20V4M4 20h16M8 17v-5M12.5 17V8M17 17v-8',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z',
};

const FILLED = new Set<IconName>([]);

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 24, className, ...rest }: IconProps) {
  const filled = FILLED.has(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Logotipo do Castelo — torre estilizada. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <svg
        width="26"
        height="26"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M6 27h20v-3H6v3Zm1-3V12h4v3h4v-3h6v3h4v9H7Z"
          fill="var(--color-gold)"
        />
        <path
          d="M6 12h4V9H8V6h3v6h4V6h2v6h4V6h3v3h-2v3h-4v-3h-6v3h-4v-3H6Z"
          fill="var(--color-gold)"
        />
        <path
          d="M6 27h20v-3H6v3Z"
          fill="var(--color-gold-text)"
          opacity="0.55"
        />
      </svg>
      <span className="text-[1.35rem] font-bold tracking-tight">Castelo</span>
    </span>
  );
}
