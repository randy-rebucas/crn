'use client';

import { useEffect } from 'react';

// Last-resort boundary for errors in the root layout itself. It replaces the
// whole document, so it can't rely on globals.css or the app's fonts: the
// styles are inline and deliberately minimal.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f8fafc', color: '#0f172a' }}>
        <title>Something went wrong | OBIAS Review Center</title>
        <main style={{ maxWidth: 480, margin: '0 auto', padding: '96px 24px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: '#475569', lineHeight: 1.6 }}>
            The site couldn&apos;t load. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 16,
              padding: '10px 18px',
              border: 0,
              borderRadius: 6,
              background: '#b91c1c',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
