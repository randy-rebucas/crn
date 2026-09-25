import { API_BASE_URL } from '@/lib/api-client';
import { fetchPublicSettings } from '@/lib/public-settings';
import { type FaqItem, HelpView } from './help-view';

// Help & Support. There's no support-ticketing API, so this routes students
// to the portal page that answers their question, or to the center's real
// contact channels (GET /v1/public/settings, with PRODUCT.md fallbacks), and
// adds the center's published FAQ (GET /v1/public/faq) under the
// portal-specific questions. Fetched here on the server; rendered by the
// client HelpView.

async function fetchFaq(): Promise<FaqItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/public/faq`, { next: { revalidate: 60 } });
    return res.ok ? ((await res.json()) as FaqItem[]) : [];
  } catch {
    return [];
  }
}

export default async function StudentHelpPage() {
  const [settings, centerFaq] = await Promise.all([fetchPublicSettings(), fetchFaq()]);
  return <HelpView settings={settings} centerFaq={centerFaq} />;
}
