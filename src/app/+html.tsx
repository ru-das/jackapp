import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Baked in at export time from app.json experiments.baseUrl (e.g. "/jackapp"), "" at root.
const base = process.env.EXPO_BASE_URL ?? '';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#F7F3EC" />
        <link rel="manifest" href={`${base}/manifest.webmanifest`} />
        <link rel="apple-touch-icon" href={`${base}/icons/icon-192.png`} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
