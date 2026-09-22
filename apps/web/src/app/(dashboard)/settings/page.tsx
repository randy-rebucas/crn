'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, ErrorState, Field, Input, LoadingState, PageHeader } from '@/components/ui';

interface Settings {
  id: string;
  supportEmail: string | null;
  supportPhone: string | null;
  timezone: string | null;
  allowSelfEnrollment: boolean;
  notifyOnEnrollment: boolean;
  notifyOnPaymentVerified: boolean;
}

function errorMessage(err: unknown, fallback: string) {
  return (isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined) ?? fallback;
}

const settingsSchema = z.object({
  supportEmail: z.union([z.literal(''), z.string().email()]).optional(),
  supportPhone: z.string().optional(),
  timezone: z.string().optional(),
  allowSelfEnrollment: z.boolean(),
  notifyOnEnrollment: z.boolean(),
  notifyOnPaymentVerified: z.boolean(),
});
type SettingsValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const canManage = hasPermission('settings.manage');

  const settingsQuery = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: async () => (await apiClient.get('/v1/settings')).data,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<SettingsValues>({ resolver: zodResolver(settingsSchema) });

  useEffect(() => {
    if (settingsQuery.data) {
      reset({
        supportEmail: settingsQuery.data.supportEmail ?? '',
        supportPhone: settingsQuery.data.supportPhone ?? '',
        timezone: settingsQuery.data.timezone ?? '',
        allowSelfEnrollment: settingsQuery.data.allowSelfEnrollment,
        notifyOnEnrollment: settingsQuery.data.notifyOnEnrollment,
        notifyOnPaymentVerified: settingsQuery.data.notifyOnPaymentVerified,
      });
    }
  }, [settingsQuery.data, reset]);

  const onSubmit = async (values: SettingsValues) => {
    setServerError(null);
    setSaved(false);
    try {
      await apiClient.patch('/v1/settings', {
        supportEmail: values.supportEmail || undefined,
        supportPhone: values.supportPhone || undefined,
        timezone: values.timezone || undefined,
        allowSelfEnrollment: values.allowSelfEnrollment,
        notifyOnEnrollment: values.notifyOnEnrollment,
        notifyOnPaymentVerified: values.notifyOnPaymentVerified,
      });
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    } catch (err) {
      setServerError(errorMessage(err, 'Could not save settings.'));
    }
  };

  return (
    <div>
      <PageHeader title="Settings" description="Organization-wide contact details, timezone, and notification preferences." />

      {settingsQuery.isLoading && <LoadingState />}
      {settingsQuery.isError && <ErrorState message="Could not load settings." />}

      {settingsQuery.data && (
        <Card className="max-w-2xl p-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Support email">
                <Input type="email" disabled={!canManage} {...register('supportEmail')} />
              </Field>
              <Field label="Support phone">
                <Input disabled={!canManage} {...register('supportPhone')} />
              </Field>
              <Field label="Timezone">
                <Input placeholder="Asia/Manila" disabled={!canManage} {...register('timezone')} />
              </Field>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Preferences</p>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" disabled={!canManage} {...register('allowSelfEnrollment')} />
                Allow self-enrollment
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" disabled={!canManage} {...register('notifyOnEnrollment')} />
                Notify on enrollment
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" disabled={!canManage} {...register('notifyOnPaymentVerified')} />
                Notify when a payment is verified
              </label>
            </div>

            {canManage && (
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving…' : 'Save settings'}
                </Button>
                {saved && <p className="text-sm text-emerald-600">Saved.</p>}
                {serverError && <p className="text-sm text-red-600">{serverError}</p>}
              </div>
            )}
          </form>
        </Card>
      )}
    </div>
  );
}
