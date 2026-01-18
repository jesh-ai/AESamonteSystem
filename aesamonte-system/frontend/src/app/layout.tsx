import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../css/global.css"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AE Samonte Merchandise",
  description: "An Inventory and Sales System for AE Samonte Merchandise ",
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