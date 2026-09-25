import { API_BASE_URL } from '@/lib/api-client';

// Mirrors GET /v1/public/settings — the contact block and enrollment status
// an admin edits under Settings.
export interface PublicSettings {
  organizationName: string;
  supportEmail: string | null;
  supportPhone: string | null;
  additionalPhones: string[];
  address: string | null;
  facebookPageName: string | null;
  facebookUrl: string | null;
  enrollmentOpen: boolean;
  enrollmentNotice: string | null;
  allowSelfEnrollment: boolean;
}

// The center's real details (PRODUCT.md). Used field-by-field when a setting
// is blank, and wholesale when the API can't be reached, so the public site
// never renders an empty contact block.
export const PUBLIC_SETTINGS_FALLBACK: PublicSettings = {
  organizationName: 'OBIAS Nursing & Allied Courses Review Center',
  supportEmail: 'centerofreviewfornursing@gmail.com',
  supportPhone: '0917 165 4780',
  additionalPhones: ['0939 126 2602', '0951 562 4048', '0923 812 2649'],
  address: 'Jinyang Bldg. #1, Manila Doctors Access Road, Almanza Uno, Las Piñas City',
  facebookPageName: 'Obias Nursing & Allied Courses Review Center',
  facebookUrl: null,
  enrollmentOpen: true,
  enrollmentNotice: 'Now Accepting Enrollees!',
  allowSelfEnrollment: false,
};

export function withFallbacks(raw: Partial<PublicSettings> | null | undefined): PublicSettings {
  if (!raw) return PUBLIC_SETTINGS_FALLBACK;
  const f = PUBLIC_SETTINGS_FALLBACK;
  const hasPhones = Boolean(raw.supportPhone) || (raw.additionalPhones?.length ?? 0) > 0;
  return {
    organizationName: raw.organizationName || f.organizationName,
    supportEmail: raw.supportEmail || f.supportEmail,
    supportPhone: hasPhones ? (raw.supportPhone ?? null) : f.supportPhone,
    additionalPhones: hasPhones ? (raw.additionalPhones ?? []) : f.additionalPhones,
    address: raw.address || f.address,
    facebookPageName: raw.facebookPageName || f.facebookPageName,
    facebookUrl: raw.facebookUrl || null,
    enrollmentOpen: raw.enrollmentOpen ?? f.enrollmentOpen,
    // An empty notice is a deliberate "no banner text", not a missing value.
    enrollmentNotice: raw.enrollmentNotice ?? null,
    allowSelfEnrollment: raw.allowSelfEnrollment ?? f.allowSelfEnrollment,
  };
}

export function phonesOf(settings: PublicSettings) {
  return [settings.supportPhone, ...settings.additionalPhones].filter((p): p is string => Boolean(p));
}

export async function fetchPublicSettings(): Promise<PublicSettings> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/public/settings`, { next: { revalidate: 60 } });
    if (!res.ok) return PUBLIC_SETTINGS_FALLBACK;
    return withFallbacks(await res.json());
  } catch {
    return PUBLIC_SETTINGS_FALLBACK;
  }
}
