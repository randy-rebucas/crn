import { Icon, type IconName } from './icons';

// A contact detail with a maroon round icon — address, phones, email, etc.
export function InfoRow({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-maroon text-white [--icon-cutout:var(--brand-maroon)]">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h2 className="font-semibold text-brand-navy font-sans!">{title}</h2>
        <div className="mt-1 text-sm text-slate-600">{children}</div>
      </div>
    </div>
  );
}

// A mailto link that, when it must wrap, breaks after the "@" rather than
// mid-word — long addresses don't fit narrow columns on one line.
export function EmailLink({ email }: { email: string }) {
  const at = email.indexOf('@');
  return (
    <a href={`mailto:${email}`} className="hover:text-brand-maroon">
      {at > 0 ? (
        <>
          {email.slice(0, at + 1)}
          <wbr />
          {email.slice(at + 1)}
        </>
      ) : (
        email
      )}
    </a>
  );
}

// Phone numbers as tap-to-call links with maroon arrow bullets.
export function PhoneList({ phones }: { phones: string[] }) {
  return (
    <ul className="space-y-1">
      {phones.map((phone) => (
        <li key={phone} className="flex items-center gap-2.5">
          <span className="h-0 w-0 border-y-[4px] border-l-[6px] border-y-transparent border-l-brand-maroon" aria-hidden="true" />
          <a href={`tel:${phone.replace(/\s+/g, '')}`} className="hover:text-brand-maroon">
            {phone}
          </a>
        </li>
      ))}
    </ul>
  );
}
