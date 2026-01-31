import "./globals.css";
import { VirtualViewportProvider } from "@/components/virtual/VirtualViewportProvider";

// layout.tsx bleibt eine Server-Komponente (kein 'use client')
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <VirtualViewportProvider>{children}</VirtualViewportProvider>
      </body>
    </html>
  );
}
