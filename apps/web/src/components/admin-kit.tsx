'use client';

import { icons as baseIcons } from '@/components/student-ui';

// List-page controls shared by the admin screens (finance, exams, ...).

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative block sm:w-64">
      <span className="sr-only">{placeholder}</span>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{baseIcons.search}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-red-600 focus:outline-none"
      />
    </label>
  );
}

export interface FilterChipOption<T extends string> {
  id: T;
  label: string;
  count?: number;
  /** Highlights a non-zero count, e.g. items waiting on the viewer. */
  alert?: boolean;
}

export function FilterChips<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: FilterChipOption<T>[];
  label: string;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1" role="group" aria-label={label}>
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
              active ? 'bg-red-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={`ml-1.5 tabular-nums ${
                  active ? 'text-red-100' : o.alert && o.count > 0 ? 'font-semibold text-red-700' : 'text-slate-400'
                }`}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>;
}
