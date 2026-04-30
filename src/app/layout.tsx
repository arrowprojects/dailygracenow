import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Daily Grace Now',
  description: 'A beautiful Bible reader',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Crimson+Pro:ital,wght@0,300;0,400;1,300;1,400&family=EB+Garamond:ital,wght@0,400;1,400&family=Gentium+Book+Plus:ital,wght@0,400;1,400&family=Libre+Baskerville:ital,wght@0,400;1,400&family=Lora:ital,wght@0,400;1,400&family=Merriweather:ital,wght@0,300;1,300&family=Playfair+Display:ital,wght@0,400;1,400&family=Source+Serif+4:ital,wght@0,300;0,400;1,300;1,400&family=Vollkorn:ital,wght@0,400;1,400&family=UnifrakturMaguntia&family=Inter:wght@300;400&family=Noto+Sans:ital,wght@0,300;1,300&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
