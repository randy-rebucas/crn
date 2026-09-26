'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { landingRouteForUser, useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/errors';

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email(),
  password: z.string().min(8, 'At least 8 characters'),
  phone: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/public/register', values);
    } catch (err) {
      setServerError(errorMessage(err, 'Could not create your account.'));
      return;
    }
    // Registration doesn't return a session — sign the new account in
    // immediately so it isn't a dead end. The account exists by now, so a
    // failure here must not read as "couldn't create it": a retry would only
    // hit "email already registered".
    try {
      const user = await login(values.email, values.password);
      router.replace(landingRouteForUser(user));
    } catch {
      router.replace('/login?registered=1');
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/40 bg-white/80 p-8 shadow-2xl backdrop-blur-md">
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        <Link
          href="/login"
          className="rounded-md py-2 text-center text-sm font-semibold text-slate-500 hover:text-slate-700"
        >
          Login
        </Link>
        <span className="rounded-md bg-brand-maroon py-2 text-center text-sm font-semibold text-white shadow-sm">
          Sign Up
        </span>
      </div>

      <h1 className="font-heading text-2xl font-bold text-slate-900">Create a student account</h1>
      <p className="mb-6 text-sm text-slate-500">Register to start your enrollment.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="register-first-name" className="mb-1 block text-sm font-medium text-slate-700">
              First name
            </label>
            <input
              id="register-first-name"
              autoComplete="given-name"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-maroon focus:outline-none focus:ring-1 focus:ring-brand-maroon"
              {...register('firstName')}
            />
            {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>}
          </div>
          <div>
            <label htmlFor="register-last-name" className="mb-1 block text-sm font-medium text-slate-700">
              Last name
            </label>
            <input
              id="register-last-name"
              autoComplete="family-name"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-maroon focus:outline-none focus:ring-1 focus:ring-brand-maroon"
              {...register('lastName')}
            />
            {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="register-email" className="mb-1 block text-sm font-medium text-slate-700">
            Email Address
          </label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-maroon focus:outline-none focus:ring-1 focus:ring-brand-maroon"
            {...register('email')}
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="register-phone" className="mb-1 block text-sm font-medium text-slate-700">
            Phone (optional)
          </label>
          <input
            id="register-phone"
            type="tel"
            autoComplete="tel"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-maroon focus:outline-none focus:ring-1 focus:ring-brand-maroon"
            {...register('phone')}
          />
        </div>

        <div>
          <label htmlFor="register-password" className="mb-1 block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            placeholder="Enter your password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-maroon focus:outline-none focus:ring-1 focus:ring-brand-maroon"
            {...register('password')}
          />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        {serverError && <p className="text-sm text-red-600">{serverError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-brand-maroon py-2.5 text-sm font-semibold text-white transition hover:bg-brand-maroon-dark disabled:opacity-50"
        >
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className="mt-4 text-center text-sm text-slate-500">
        <Link href="/login" className="font-semibold text-brand-maroon hover:underline">
          Already have an account? Sign in
        </Link>
      </div>
    </div>
  );
}
