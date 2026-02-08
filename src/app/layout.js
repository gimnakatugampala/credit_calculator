import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: 'NIBM - Coventry Credit Calculator | Track Your Degree Classification',
  description: 'Calculate your weighted credit average and UK degree classification for NIBM Coventry courses. Track your modules, marks, and semester performance in real-time.',
  keywords: 'NIBM, Coventry University, Credit Calculator, Degree Classification, UK Honours, GPA Calculator, Module Tracker',
  authors: [{ name: 'NIBM' }],
  
  // Open Graph / Facebook
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://nibm-credit-calculator.vercel.app/',
    siteName: 'NIBM Credit Calculator',
    title: 'NIBM - Coventry Credit Calculator | Track Your Degree Classification',
    description: 'Calculate your weighted credit average and UK degree classification for NIBM Coventry courses. Track your modules, marks, and semester performance in real-time.',
    images: [
      {
        url: '/assets/img/logo.jpg',
        width: 1200,
        height: 630,
        alt: 'NIBM - Coventry Credit Calculator',
      },
    ],
  },
  
  // Twitter
  twitter: {
    card: 'summary_large_image',
    title: 'NIBM - Coventry Credit Calculator | Track Your Degree Classification',
    description: 'Calculate your weighted credit average and UK degree classification for NIBM Coventry courses. Track your modules, marks, and semester performance in real-time.',
    images: ['/assets/img/logo.jpg'],
  },
  
  // Canonical URL
  alternates: {
    canonical: 'https://nibm-credit-calculator.vercel.app/',
  },
  
  // Icons
  icons: {
    icon: '/assets/img/logo.jpg',
    apple: '/assets/img/logo.jpg',
  },
  
  // Viewport
  viewport: {
    width: 'device-width',
    initialScale: 1,
  },
  
  // Theme color
  themeColor: '#1e40af',
  
  // Apple Web App
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NIBM Calculator',
  },
}


export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}