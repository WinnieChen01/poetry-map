import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poetry Map | Winnie Chen",
  description: "A location-based memory diary with AI-assisted poetry.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
