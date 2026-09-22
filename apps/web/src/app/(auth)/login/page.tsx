'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { landingRouteForUser, useAuth } from '@/lib/auth-context';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    try {
      const user = await login(values.email, values.password);
      router.push(landingRouteForUser(user));
    } catch {
      setServerError('Invalid email or password.');
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email Address</label>
          <div className="relative">
            <IconMail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-brand-maroon focus:outline-none focus:ring-1 focus:ring-brand-maroon"
              {...register('email')}
            />
          </div>
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
          <div className="relative">
            <IconLock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type={showPassword ? 'text' : 'password'}
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
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-maroon" defaultChecked />
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

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Or</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <IconGoogle className="h-4 w-4" />
        Continue with Google
      </button>

      <div className="mt-4 text-center text-sm text-slate-500">
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

function IconGoogle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.82-.07-1.42-.22-2.05H12v3.72h6.5c-.13 1.02-.84 2.56-2.42 3.6l-.02.15 3.52 2.7.24.02c2.24-2.04 3.68-5.04 3.68-8.14Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.06 7.93-2.88l-3.78-2.9c-1.01.7-2.37 1.19-4.15 1.19-3.17 0-5.86-2.09-6.82-4.98l-.14.01-3.66 2.82-.05.13C3.31 21.3 7.33 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.18 14.42A7.2 7.2 0 0 1 4.8 12c0-.84.15-1.65.37-2.42L5.16 9.4 1.45 6.5l-.12.06A11.97 11.97 0 0 0 0 12c0 1.93.46 3.76 1.33 5.38l3.85-2.96Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c2.26 0 3.78.97 4.65 1.79l3.4-3.32C17.94 1.19 15.24 0 12 0 7.33 0 3.31 2.7 1.33 6.62l3.85 2.96C6.14 6.84 8.83 4.75 12 4.75Z"
      />
    </svg>
  );
}
