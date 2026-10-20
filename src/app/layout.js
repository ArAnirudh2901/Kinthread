import { Fraunces, Geist, Geist_Mono } from 'next/font/google';
import Providers from '@/components/Providers';
import SiteFooter from '@/components/layout/SiteFooter';
import SiteHeader from '@/components/layout/SiteHeader';
import './globals.css';

// Fonts are downloaded at build time and served from this site: no runtime font requests.
const fraunces = Fraunces({ subsets: ['latin'], axes: ['SOFT', 'opsz'], style: ['normal', 'italic'], variable: '--font-fraunces', display: 'swap' });
const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

export const metadata = {
  metadataBase: new URL(process.env.SITE_URL || 'https://kinthread.pages.dev'),
  title: { default: 'Kinthread — blood-relation puzzles, solved step by step', template: '%s · Kinthread' },
  description:
    'Give Kinthread a family story and it traces how two people are related, step by step. Two small AI models, trained from scratch, run entirely in your browser.',
  applicationName: 'Kinthread',
  openGraph: { type: 'website', siteName: 'Kinthread', title: 'Kinthread — blood-relation puzzles, solved step by step', description: 'Find the thread that connects them. A from-scratch AI that runs in your browser.' },
};

export const viewport = { themeColor: '#0f1423', colorScheme: 'dark light' };

// Dark is the default; a stored choice of light is applied before first paint so it never flashes.
// light theme before paint, with the browser chrome (status bar) to match
const THEME = `try{if(localStorage.getItem('kinthread-theme')==='light'){document.documentElement.dataset.theme='light';var m=document.querySelector('meta[name=theme-color]');if(m)m.content='#f4efe4'}}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
      </head>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <Providers>
          <SiteHeader />
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
