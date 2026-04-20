import { Geist, Geist_Mono } from 'next/font/google';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://forgentic.io'),
  title: {
    default: 'Forgentic — Brand intelligence, on autopilot',
    template: '%s · Forgentic',
  },
  description:
    'Forgentic orchestrates brand intelligence across every channel — continuously observing the market, interpreting signals, and acting on opportunities while your team sleeps.',
  applicationName: 'Forgentic',
  authors: [{ name: 'Forgentic' }],
  creator: 'Forgentic',
  category: 'technology',
  keywords: ['brand intelligence', 'marketing automation', 'competitive analysis'],
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
  openGraph: {
    title: 'Forgentic — Brand intelligence, on autopilot',
    description:
      'Forgentic orchestrates brand intelligence across every channel — continuously observing the market, interpreting signals, and acting on opportunities while your team sleeps.',
    url: 'https://forgentic.io',
    siteName: 'Forgentic',
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Forgentic' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Forgentic — Brand intelligence, on autopilot',
    description:
      'Forgentic orchestrates brand intelligence across every channel — continuously observing the market, interpreting signals, and acting on opportunities while your team sleeps.',
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: dark)', color: '#000000' }],
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
