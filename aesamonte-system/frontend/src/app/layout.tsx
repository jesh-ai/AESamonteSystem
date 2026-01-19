import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../css/global.css"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AE Samonte Merchandise",
  description: "An Inventory and Sales System for AE Samonte Merchandise",
  icons: {
    icon: "/ae-logo.png", // or "/logo.png" if that's your file name in the public folder
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}