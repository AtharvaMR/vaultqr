import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VERIMASK — Verify Without Revealing",
  description: "Privacy-first digital identity, document wallet and credential verification platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-[#F5F7FB] text-[#101C35] font-sans min-h-screen selection:bg-blue-100 selection:text-blue-900">
        {children}
      </body>
    </html>
  );
}
