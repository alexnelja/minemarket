import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "./sidebar";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Personal dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 p-6 md:p-10 md:ml-56">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
