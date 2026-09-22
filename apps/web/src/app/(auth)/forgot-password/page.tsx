'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';

const schema = z.object({ email: z.string().email() });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    // The API always responds the same way whether or not the email is
    // registered (prevents account enumeration), so there's no error
    // branch here to show — only the confirmation state.
    await apiClient.post('/v1/auth/password-reset/request', values).catch(() => undefined);
    setSent(true);
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/40 bg-white/80 p-8 shadow-2xl backdrop-blur-md">
      <h1 className="font-heading text-2xl font-bold text-slate-900">Reset your password</h1>
      <p className="mb-6 text-sm text-slate-500">We&apos;ll send you a link to reset your password.</p>

      {sent ? (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          If an account exists for that email, a reset link has been sent.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-maroon focus:outline-none focus:ring-1 focus:ring-brand-maroon"
              {...register('email')}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-brand-maroon py-2.5 text-sm font-semibold text-white transition hover:bg-brand-maroon-dark disabled:opacity-50"
          >
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}

      <div className="mt-4 text-center text-sm text-slate-500">
        <Link href="/login" className="font-semibold text-brand-maroon hover:underline">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
