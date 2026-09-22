import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Humor Study | Winnie Chen",
  description: "Memes and captions from Humor Study.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
