'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { landingRouteForUser, useAuth } from '@/lib/auth-context';
import { DEMO_PASSWORD, DEMO_USERS } from '@/lib/demo-users';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
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

  const loginAsDemo = async (email: string) => {
    setValue('email', email);
    setValue('password', DEMO_PASSWORD);
    setServerError(null);
    try {
      const user = await login(email, DEMO_PASSWORD);
      router.push(landingRouteForUser(user));
    } catch {
      setServerError('Invalid email or password.');
    }
  };

  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">OBIAS Review Center</h1>
        <p className="mb-6 text-sm text-slate-500">Sign in to your account</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              {...register('email')}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              {...register('password')}
            />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
          </div>

          {serverError && <p className="text-sm text-red-600">{serverError}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <Link href="/forgot-password" className="hover:text-slate-700 hover:underline">
            Forgot password?
          </Link>
          <Link href="/register" className="hover:text-slate-700 hover:underline">
            Create a student account
          </Link>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="mb-2 text-xs font-medium text-slate-500">Demo accounts (password: {DEMO_PASSWORD})</p>
          <div className="flex flex-wrap gap-2">
            {DEMO_USERS.map((demoUser) => (
              <button
                key={demoUser.id}
                type="button"
                onClick={() => loginAsDemo(demoUser.email)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
                title={demoUser.email}
              >
                {demoUser.roles[0]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
