'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { apiClient } from '@/lib/api-client';
import { Button, Field, Input, Select } from '@/components/ui';

const PROGRAM_OPTIONS = [
  'Nursing (NLE)',
  'Midwifery',
  'Medical Technology',
  'Physical Therapy',
  'Seminar & Training',
  'Caregiving Course',
  'Foreign Language Skills',
];

function errorMessage(err: unknown, fallback: string) {
  return (isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined) ?? fallback;
}

export function EnrollmentForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    try {
      await apiClient.post('/v1/public/leads', {
        fullName: form.get('name') || undefined,
        phone: form.get('phone') || undefined,
        email: form.get('email') || undefined,
        programInterest: form.get('program') || undefined,
        message: form.get('message') || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(errorMessage(err, 'Could not send your inquiry. Please try again or call us directly.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-md bg-brand-gold/20 p-4 text-sm text-brand-maroon-dark">
        Thank you! Your inquiry has been received. Our team will contact you shortly.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Full name">
        <Input name="name" required />
      </Field>
      <Field label="Phone number">
        <Input name="phone" type="tel" required />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" />
      </Field>
      <Field label="Program of interest">
        <Select name="program" defaultValue="">
          <option value="" disabled>
            Select a program
          </option>
          {PROGRAM_OPTIONS.map((program) => (
            <option key={program} value={program}>
              {program}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Message (optional)">
        <textarea
          name="message"
          rows={3}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-red-600 focus:outline-none"
        />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={submitting} className="w-full justify-center py-2.5 text-base">
        {submitting ? 'Sending…' : 'Submit Enrollment Inquiry'}
      </Button>
    </form>
  );
}
