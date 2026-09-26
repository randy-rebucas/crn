'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { landingRouteForUser, useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/errors';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  rememberMe: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Only a 401 means the credentials were wrong. Calling a throttled request,
// an outage or a dropped connection "invalid password" sends people off to
// reset a password that was fine.
function loginErrorMessage(err: unknown): string {
  if (!isAxiosError(err)) return 'Something went wrong. Please try again.';
  const status = err.response?.status;
  if (!status) return 'Couldn’t reach the server. Check your connection and try again.';
  if (status === 401) return 'Invalid email or password.';
  if (status === 429) return 'Too many sign-in attempts. Wait a minute, then try again.';
  if (status === 403) return errorMessage(err, 'This account can’t sign in right now. Contact the center for help.');
  return 'Something went wrong on our side. Please try again in a moment.';
}

// Registration sends people here when its automatic sign-in didn't go
// through, so they know the account itself was created.
function RegisteredNotice() {
  const registered = useSearchParams().get('registered');
  if (!registered) return null;
  return (
    <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
      Your account was created. Sign in to continue.
    </p>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: true },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    try {
      const user = await login(values.email, values.password, values.rememberMe);
      router.replace(landingRouteForUser(user));
    } catch (err) {
      setServerError(loginErrorMessage(err));
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/40 bg-white/80 p-8 shadow-2xl backdrop-blur-md">
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        <span className="rounded-md bg-brand-maroon py-2 text-center text-sm font-semibold text-white shadow-sm">
          Login
        </span>
        <Link
          href="/register"
          className="rounded-md py-2 text-center text-sm font-semibold text-slate-500 hover:text-slate-700"
        >
          Sign Up
        </Link>
      </div>

      <h1 className="font-heading text-2xl font-bold text-slate-900">Welcome Back!</h1>
      <p className="mb-6 text-sm text-slate-500">Sign in to your Obias review account.</p>

      <Suspense fallback={null}>
        <RegisteredNotice />
      </Suspense>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-slate-700">
            Email Address
          </label>
          <div className="relative">
            <IconMail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-brand-maroon focus:outline-none focus:ring-1 focus:ring-brand-maroon"
              {...register('email')}
            />
          </div>
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative">
            <IconLock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-10 text-sm focus:border-brand-maroon focus:outline-none focus:ring-1 focus:ring-brand-maroon"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 accent-brand-maroon"
              {...register('rememberMe')}
            />
            Remember me
          </label>
          <Link href="/forgot-password" className="font-medium text-brand-maroon hover:underline">
            Forgot password?
          </Link>
        </div>

        {serverError && <p className="text-sm text-red-600">{serverError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-maroon py-2.5 text-sm font-semibold text-white transition hover:bg-brand-maroon-dark disabled:opacity-50"
        >
          {isSubmitting ? 'Signing in…' : 'Sign In'}
          {!isSubmitting && <span aria-hidden>&rarr;</span>}
        </button>
      </form>

      <div className="mt-5 text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-semibold text-brand-maroon hover:underline">
          Create one
        </Link>
      </div>
    </div>
  );
}

function IconMail({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6 8.5 7 8.5-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2}>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2}>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2}>
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M9.36 5.32A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a13.3 13.3 0 0 1-3.15 3.9M6.6 6.6C4.1 8.2 2 12 2 12s3.5 7 10 7a9.9 9.9 0 0 0 3.4-.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
