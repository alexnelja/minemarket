import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "./sidebar";
import { CommandPalette } from './components/command-palette';

export const metadata: Metadata = {
  title: "MineMarket — Deal Workspace for Commodity Traders",
  description: "Calculate margins, manage deals, track documents. Chrome, manganese, iron ore, and more. Free deal simulator.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link href="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css" rel="stylesheet" />
      </head>
      <body className="bg-gray-950 text-white min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 p-6 md:p-10 md:ml-56">
            {children}
          </main>
        </div>
        <CommandPalette />
      </body>
    </html>
  );
}
