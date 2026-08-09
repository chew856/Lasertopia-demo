import type { Metadata } from "next";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Book — Lasertopia Winnipeg",
  description:
    "Book laser tag games and birthday parties at Lasertopia, 1140 Waverley Street, Winnipeg.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-CA" className={`${fontVariables} h-full`}>
      <body className="min-h-full flex flex-col bg-canvas text-text">
        {children}
      </body>
    </html>
  );
}
