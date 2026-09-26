/** "PAYMENT_PENDING" / "audit_logs" / "auth.login.failed" → "Payment pending" / "Audit logs" / "Auth login failed". */
export function humanize(value: string): string {
  const text = value.replace(/[_.-]+/g, ' ').toLowerCase().trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * A date as the center's visitors read it. Locale and time zone are pinned so
 * server-rendered output doesn't depend on the host's settings.
 */
export function formatDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
): string {
  return new Date(value).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', ...options });
}
