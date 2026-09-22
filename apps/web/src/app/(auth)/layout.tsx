import Image from 'next/image';
import Link from 'next/link';

const FEATURES = [
  { label: 'Experienced Review Instructors', icon: IconUsers },
  { label: 'Comprehensive Review Materials', icon: IconBook },
  { label: 'Track Your Review Progress', icon: IconChart },
  { label: 'Learn Anywhere, Anytime', icon: IconLaptop },
];

const STATS = [
  { label: 'Excellent Reviews', icon: IconCap },
  { label: 'Proven Results', icon: IconRibbon },
  { label: 'Many Success Stories', icon: IconHeart },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden lg:flex-row">
      {/* Shared diagonal gold/maroon backdrop, spans the full layout */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'url(/16d4d771-8f01-44ac-8cbe-4bd690bbcd15.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      <aside
        className="relative flex flex-col justify-between px-8 pb-0 pt-10 text-brand-navy lg:w-1/2 lg:px-14 lg:pt-14"
        style={{ clipPath: 'polygon(0 0, 100% 0, 92% 100%, 0% 100%)' }}
      >
        {/* Legibility scrim so the quote/stats row always sits on a dark surface, regardless of how the shared backdrop lands on this viewport */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%]"
          style={{
            background: 'linear-gradient(to top, rgba(107,20,31,0.85) 0%, rgba(107,20,31,0.45) 55%, rgba(107,20,31,0) 100%)',
          }}
        />

        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[50%] items-end justify-end lg:flex xl:w-[54%]">
          <Image
            src="/022ce273-ca3d-4d8e-94c0-2c4e7431b7c7.png"
            alt="Smiling nursing students in uniform"
            width={1400}
            height={1148}
            className="h-full max-h-full w-full object-contain object-bottom drop-shadow-2xl"
            priority
          />
        </div>

        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/obias_crn_logo_transparent.png"
              alt="OBIAS CRN seal"
              width={311}
              height={236}
              className="h-12 w-16 shrink-0 object-contain drop-shadow-sm sm:h-14 sm:w-[4.5rem] lg:h-16 lg:w-20"
              priority
            />
            <div>
              <p className="font-heading text-2xl font-bold leading-none tracking-wide text-brand-maroon">
                OBIAS
              </p>
              <p className="mt-1 text-[11px] font-bold uppercase leading-tight tracking-wide text-brand-navy">
                Nursing &amp; Allied Courses
                <br />
                Review Center
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 pt-1 sm:flex">
            <p className="text-right text-[10px] font-bold uppercase leading-tight tracking-[0.15em] text-brand-navy">
              Your Success
              <br />
              Our Mission!
            </p>
            <Image
              src="/b9012f65-77dd-4c21-bd3a-f99efaead4a8.png"
              alt=""
              width={2172}
              height={724}
              className="h-4 w-10 object-contain md:h-5 md:w-12 lg:h-6 lg:w-16"
              aria-hidden
            />
          </div>
        </div>

        <div className="relative mt-6 lg:max-w-[64%]">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-navy/90">20+ Years of Excellence</p>

          <h1 className="mt-3 font-heading text-4xl font-bold uppercase leading-[1.05] text-brand-navy sm:text-5xl lg:text-6xl">
            Prepare.
            <br />
            Review.
            <br />
            <span className="text-brand-maroon">Pass.</span>
          </h1>

          <p className="font-script mt-4 text-3xl leading-snug text-brand-navy/90 sm:text-4xl">
            Your Partner in Passing.
            <br />
            Your Future in Healthcare.
          </p>

          <ul className="mt-7 space-y-3.5">
            {FEATURES.map(({ label, icon: Icon }) => (
              <li key={label} className="flex items-center gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-maroon text-white shadow-sm sm:h-11 sm:w-11">
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </span>
                <span className="text-sm font-semibold text-brand-navy">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-8 pb-8 lg:max-w-[64%]">
          <p className="border-l-4 border-white/70 pl-3 text-sm italic text-white/95">
            &ldquo;Empowering future healthcare professionals today.&rdquo;
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/30 pt-5 text-xs font-bold uppercase tracking-wide text-white">
            {STATS.map(({ label, icon: Icon }, i) => (
              <span key={label} className="flex shrink-0 items-center gap-3">
                {i > 0 && <span className="hidden h-4 w-px shrink-0 bg-white/40 sm:block" aria-hidden />}
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </span>
              </span>
            ))}
          </div>
        </div>
      </aside>

      <main className="relative flex flex-1 flex-col">
        <div className="flex justify-end px-6 py-5 lg:px-10">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-brand-maroon"
          >
            <span aria-hidden>&larr;</span> Back to Website
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-10">{children}</div>
        <p className="font-script hidden pb-8 pr-10 text-right text-4xl leading-tight text-brand-navy lg:block">
          Future Healthcare
          <br />
          <span className="relative inline-block text-brand-maroon">Starts Here.</span>
        </p>
      </main>
    </div>
  );
}

type IconProps = { className?: string };

function IconUsers({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBook({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2}>
      <path
        d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChart({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2}>
      <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 16v-4M12 16V8M17 16v-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLaptop({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M2 20h20" strokeLinecap="round" />
    </svg>
  );
}

function IconCap({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2}>
      <path d="m22 10-10-5-10 5 10 5 10-5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconRibbon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="8" r="6" />
      <path d="m9 13.5-2 8 5-3 5 3-2-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconHeart({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2}>
      <path
        d="M12 21s-7.5-4.6-10-9.3C.5 8.4 2 5 5.5 5c2 0 3.5 1.3 4.5 2.8C11 6.3 12.5 5 14.5 5 18 5 19.5 8.4 22 11.7 19.5 16.4 12 21 12 21Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
