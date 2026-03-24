import type { Metadata } from "next";
import "../globals.css";
import Script from "next/script";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "MailAI - Smart Email Assistant",
  description: "AI-powered email reply generation",
};

export default function TaskpaneLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Script
        src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"
        strategy="afterInteractive"
      />
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </>
  );
}
