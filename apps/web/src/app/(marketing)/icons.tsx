// The marketing site's glyph set: solid shapes at 24px, drawn in currentColor
// so each icon takes the color of its badge or text. Stroke-only details use
// the shared `line` props so weights stay consistent across icons.

const line = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const GLYPHS = {
  arrowRight: <path {...line} d="M4.5 12h15M13.5 6l6 6-6 6" />,
  stethoscope: (
    <>
      <path {...line} d="M5 2.5H4a1.5 1.5 0 0 0-1.5 1.5v4.5a5.5 5.5 0 0 0 11 0V4A1.5 1.5 0 0 0 12 2.5h-1" />
      <path {...line} d="M8 14v1a6 6 0 0 0 12 0v-2.5" />
      <circle cx={20} cy={10.5} r={2.5} fill="currentColor" />
    </>
  ),
  midwifery: (
    <>
      <circle cx={9} cy={4.5} r={2.75} fill="currentColor" />
      <path fill="currentColor" d="M9 8.5c-3 0-5 2.4-5 5.5v7.5h10v-3.2c-2.4-.5-4.2-1.9-5.1-3.9L9 8.5Z" />
      <circle cx={15.5} cy={11} r={2.25} fill="currentColor" />
      <path fill="currentColor" d="M9.8 13.4c1.3 2.7 4.2 4.1 7.6 3.5 1.8-.3 3.1-1.3 3.4-2.6.2-.9-.6-1.6-1.5-1.2-1.5.7-3.7 1.2-5.8.6-1.3-.4-2.5-1.1-3.1-2l-.6 1.7Z" />
    </>
  ),
  microscope: (
    <>
      <path fill="currentColor" d="M9.2 2.3a1 1 0 0 1 1.3-.4l2.6 1.5a1 1 0 0 1 .4 1.3L9.8 11a1 1 0 0 1-1.3.4L5.9 9.9a1 1 0 0 1-.4-1.3l3.7-6.3Z" />
      <path {...line} d="M8.6 11.8 7.4 14" />
      <path {...line} d="M14 8.5a6 6 0 0 1 1 11.3" />
      <path fill="currentColor" d="M3 19.5h18a1 1 0 0 1 1 1v.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-.5a1 1 0 0 1 1-1ZM6 16h7a1 1 0 0 1 1 1v1.5H5V17a1 1 0 0 1 1-1Z" />
    </>
  ),
  therapy: (
    <>
      <circle cx={8} cy={3.75} r={2.25} fill="currentColor" />
      <path fill="currentColor" d="M6.3 7.2c.9-.8 2.4-.6 3 .5l2.4 4.1 3.3.3a1.1 1.1 0 0 1-.1 2.2l-4-.3a1.3 1.3 0 0 1-1-.6L8.8 11 7.7 14.5H5.4l.2-5.6c0-.7.3-1.3.7-1.7Z" />
      <circle cx={19} cy={13.25} r={1.75} fill="currentColor" />
      <path fill="currentColor" d="M2.5 15.5h19a1 1 0 0 1 1 1v.5a1 1 0 0 1-1 1h-19a1 1 0 0 1-1-1v-.5a1 1 0 0 1 1-1ZM4 18h2v3.5H4ZM18 18h2v3.5h-2Z" />
    </>
  ),
  people: (
    <>
      <circle cx={12} cy={6.5} r={3} fill="currentColor" />
      <circle cx={5.25} cy={8.5} r={2.25} fill="currentColor" />
      <circle cx={18.75} cy={8.5} r={2.25} fill="currentColor" />
      <path fill="currentColor" d="M6.5 20.5V18a5.5 5.5 0 0 1 11 0v2.5ZM1 20.5v-1.8a4 4 0 0 1 6.3-3.3A7 7 0 0 0 5.3 20v.5ZM23 20.5v-1.8a4 4 0 0 0-6.3-3.3 7 7 0 0 1 2 4.6v.5Z" />
    </>
  ),
  book: (
    <path
      fill="currentColor"
      d="M1.5 5.2C4.6 3.6 8.3 3.8 11 5.9v14.3c-2.7-1.7-6.3-1.9-9.5-.6ZM22.5 5.2c-3.1-1.6-6.8-1.4-9.5.7v14.3c2.7-1.7 6.3-1.9 9.5-.6Z"
    />
  ),
  target: (
    <>
      <path {...line} d="M20.3 9.3a9 9 0 1 1-5.6-5.6" />
      <path {...line} d="M16.3 11a4.5 4.5 0 1 1-3.3-3.3" />
      <circle cx={12} cy={12} r={1.75} fill="currentColor" />
      <path {...line} d="m12 12 7-7M16 3.5 19 5l1.5 3" />
    </>
  ),
  peso: (
    <>
      <path {...line} strokeWidth={2.4} d="M8 20V4h4.5a4.5 4.5 0 0 1 0 9H8" />
      <path {...line} strokeWidth={2} d="M5 7.5h14M5 10h14" />
    </>
  ),
  graduationCap: (
    <>
      <path fill="currentColor" d="M12 3 .5 8.5 12 14l9.5-4.55v6.05h2v-7Z" />
      <path fill="currentColor" d="M5 11.9v4.3c0 1.9 3.1 3.8 7 3.8s7-1.9 7-3.8v-4.3L12 15.3Z" />
    </>
  ),
  chart: (
    <>
      <path fill="currentColor" d="M2 16h3.5v5.5H2ZM7.5 13H11v8.5H7.5ZM13 14.5h3.5v7H13ZM18.5 10H22v11.5h-3.5Z" />
      <path {...line} d="m3 11 5-4.5 4 3L19 3" />
      <path {...line} d="M15 3h4v4" />
    </>
  ),
  heart: (
    <path
      fill="currentColor"
      d="M12 21.2S2 15.4 2 8.8A5.2 5.2 0 0 1 7.3 3.5c2 0 3.6 1 4.7 2.6a5.6 5.6 0 0 1 4.7-2.6A5.2 5.2 0 0 1 22 8.8c0 6.6-10 12.4-10 12.4Z"
    />
  ),
  megaphone: (
    <>
      <path fill="currentColor" d="M2 9.5a1.5 1.5 0 0 1 1.5-1.5H7l8.5-4.5v17L7 16H3.5A1.5 1.5 0 0 1 2 14.5Z" />
      <path fill="currentColor" d="M6.5 16.5h3l1.2 4.2a.8.8 0 0 1-.8 1H8.4a.8.8 0 0 1-.8-.6Z" />
      <path {...line} d="M18.5 8.5 21 7M19 12h3M18.5 15.5 21 17" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx={12} cy={12} r={10.5} fill="currentColor" />
      <path fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" d="m7.3 12.3 3.1 3.1 6.3-6.6" />
    </>
  ),
  quote: (
    <path
      fill="currentColor"
      d="M3 20v-6.4C3 8.2 5.6 4.9 10 4l.9 2C8.3 7 7.1 9 7 11.5h3.5V20ZM13.5 20v-6.4c0-5.4 2.6-8.7 7-9.6l.9 2c-2.6 1-3.8 3-3.9 5.5H21V20Z"
    />
  ),
  phone: (
    <path
      fill="currentColor"
      d="M6.6 2.2c.7-.2 1.4.1 1.8.7l2 3.4c.4.7.3 1.5-.3 2L8.4 9.8a12 12 0 0 0 5.8 5.8l1.5-1.7c.5-.6 1.3-.7 2-.3l3.4 2c.6.4.9 1.1.7 1.8l-.7 2.6c-.2.8-1 1.3-1.8 1.3A18 18 0 0 1 2.7 4.7c0-.8.5-1.6 1.3-1.8Z"
    />
  ),
  mapPin: (
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 1.5a8 8 0 0 0-8 8c0 6 8 13 8 13s8-7 8-13a8 8 0 0 0-8-8Zm0 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
    />
  ),
  facebook: (
    <path
      fill="currentColor"
      d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.5 2.9h-2.3v7A10 10 0 0 0 22 12Z"
    />
  ),
  mail: (
    <>
      <circle cx={12} cy={12} r={10.5} fill="currentColor" />
      <path fill="var(--icon-cutout, #0f1e3d)" d="M6.5 8h11a1 1 0 0 1 1 1v.3L12 13.1 5.5 9.3V9a1 1 0 0 1 1-1Zm-1 3.2 6.5 3.8 6.5-3.8V15a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1Z" />
    </>
  ),
  trophy: (
    <>
      <path fill="currentColor" d="M6 2.5h12v6.5a6 6 0 0 1-12 0Z" />
      <path {...line} d="M6 4.5H3v1.5a4 4 0 0 0 3.6 4M18 4.5h3v1.5a4 4 0 0 1-3.6 4" />
      <path fill="currentColor" d="M10.5 14.5h3v3.5h-3ZM7 19h10a1 1 0 0 1 1 1v1.5H6V20a1 1 0 0 1 1-1Z" />
    </>
  ),
  presentation: (
    <>
      <path fill="currentColor" d="M2 2.5h20a1 1 0 0 1 1 1V5H1V3.5a1 1 0 0 1 1-1Z" />
      <path {...line} d="M3 5v8.5a1 1 0 0 0 1 1h8.5M21 5v8.5a1 1 0 0 1-1 1h-3" />
      <path {...line} d="M7.5 8.5h6M7.5 11h3.5" />
      <circle cx={17} cy={9.5} r={2.25} fill="currentColor" />
      <path fill="currentColor" d="M12.5 21.5V18a4.5 4.5 0 0 1 9 0v3.5Z" />
    </>
  ),
  chat: (
    <>
      <path fill="currentColor" d="M3.5 2.5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3.5v-3.5H3.5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z" />
      <path {...line} d="M18.5 8.5h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H19v3l-3.5-3H11a2 2 0 0 1-2-2v-1.5" />
    </>
  ),
  heartbeat: <path {...line} strokeWidth={1.6} d="M1 12h6.5l1.8-4 2.6 9 2.4-13 2.3 8h6.4" />,
} as const;

export type IconName = keyof typeof GLYPHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      {GLYPHS[name]}
    </svg>
  );
}

// A solid maroon disc with a fine inner ring — the program and feature badge.
export function IconBadge({ name, className = 'h-[72px] w-[72px]', iconClassName = 'h-9 w-9' }: {
  name: IconName;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={`relative flex shrink-0 items-center justify-center rounded-full bg-brand-maroon text-white ${className}`}>
      <span className="absolute inset-[3px] rounded-full border-[1.5px] border-white/85" aria-hidden="true" />
      <Icon name={name} className={iconClassName} />
    </span>
  );
}
