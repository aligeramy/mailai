import type { Metadata } from "next";
import "@/app/globals.css";
import Script from "next/script";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Outlook add-in",
  description:
    "Smart Reply task pane for Outlook — AI-powered reply generation inside your inbox.",
  robots: { index: false, follow: false },
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
