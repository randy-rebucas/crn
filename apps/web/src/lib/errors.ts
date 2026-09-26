import { isAxiosError } from 'axios';

/**
 * The message to show for a failed API call. NestJS validation failures
 * return `message` as an array of strings, so both shapes are handled —
 * reading it as a plain string drops those details and shows the fallback.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError<{ message?: string | string[] }>(err)) return fallback;
  const message = err.response?.data?.message;
  if (Array.isArray(message)) return message.length ? message.join('. ') : fallback;
  return message || fallback;
}
