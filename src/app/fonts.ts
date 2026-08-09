import { Archivo, Chivo, Martian_Mono } from "next/font/google";

/**
 * Three families, deliberately chosen to avoid the default-sans look.
 *
 * Constraints verified against next/font's own font-data.json — get these
 * wrong and the build throws rather than degrading:
 *
 *   - `axes` is only legal when `weight` is omitted. Never pass both.
 *   - Never list "wght" in `axes`; it is implicit in a variable font.
 *   - Chivo has no `wdth` axis. Requesting one is a build error.
 *   - Martian Mono has no italic. Never ask for one.
 *
 * Width is applied downstream via font-variation-settings in globals.css,
 * never font-stretch — the two silently conflict and variation-settings wins.
 */

export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});

// No `axes` here: Chivo is weight-only.
export const chivo = Chivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-chivo",
});

export const martianMono = Martian_Mono({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-martian-mono",
});

export const fontVariables = [
  archivo.variable,
  chivo.variable,
  martianMono.variable,
].join(" ");
