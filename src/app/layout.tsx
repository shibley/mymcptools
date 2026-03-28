import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MyMCPTools - MCP Server Directory | Find & Compare Model Context Protocol Servers",
  description: "The most comprehensive directory of MCP (Model Context Protocol) servers. Discover 200+ servers for Claude, Cursor, VS Code, and more. Compare, install, and integrate AI tools.",
  keywords: "MCP servers, Model Context Protocol, Claude, Cursor, VS Code, AI tools, LLM tools, AI integrations",
  openGraph: {
    title: "MyMCPTools - MCP Server Directory",
    description: "Discover 200+ Model Context Protocol servers for AI assistants",
    type: "website",
    url: "https://mymcptools.com",
    siteName: "MyMCPTools",
  },
  twitter: {
    card: "summary_large_image",
    title: "MyMCPTools - MCP Server Directory",
    description: "Discover 200+ Model Context Protocol servers for AI assistants",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white text-gray-900 min-h-screen flex flex-col`}>
        <Header />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
