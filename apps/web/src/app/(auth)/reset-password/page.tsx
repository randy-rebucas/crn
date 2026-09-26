'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { errorMessage } from '@/lib/errors';

const schema = z.object({
  newPassword: z.string().min(8, 'At least 8 characters'),
});
type FormValues = z.infer<typeof schema>;

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/auth/password-reset/confirm', { token, newPassword: values.newPassword });
      setDone(true);
    } catch (err) {
      setServerError(errorMessage(err, 'This reset link is invalid or has expired.'));
    }
  };

  if (!token) {
    return <p className="text-sm text-red-600">This reset link is missing its token. Please request a new one.</p>;
  }

  if (done) {
    return (
      <div className="space-y-3">
        <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          Your password has been reset. You can now sign in.
        </p>
        <Link href="/login" className="text-sm text-slate-700 hover:underline">
          Go to sign in →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="reset-new-password" className="mb-1 block text-sm font-medium text-slate-700">
          New password
        </label>
        <input
          id="reset-new-password"
          type="password"
          autoComplete="new-password"
          placeholder="Enter your new password"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-maroon focus:outline-none focus:ring-1 focus:ring-brand-maroon"
          {...register('newPassword')}
        />
        {errors.newPassword && <p className="mt-1 text-xs text-red-600">{errors.newPassword.message}</p>}
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-brand-maroon py-2.5 text-sm font-semibold text-white transition hover:bg-brand-maroon-dark disabled:opacity-50"
      >
        {isSubmitting ? 'Resetting…' : 'Reset password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-white/40 bg-white/80 p-8 shadow-2xl backdrop-blur-md">
      <h1 className="font-heading text-2xl font-bold text-slate-900">Set a new password</h1>
      <p className="mb-6 text-sm text-slate-500">Choose a new password for your account.</p>
      <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
