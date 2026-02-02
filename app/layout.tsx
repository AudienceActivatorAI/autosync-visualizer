import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Visualizer & Lease-to-Own — Brought to you by Autosync",
  description:
    "Visualize tires & wheels on your vehicle, then see Lease-to-Own options brought to you by Autosync.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
