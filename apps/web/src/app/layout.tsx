import type { Metadata } from "next";
import { Geist_Mono, Oswald, Poppins } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "@/lib/providers";
import { SITE_URL } from "@/lib/site-url";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const brittanySignature = localFont({
  variable: "--font-script",
  src: "../../public/fonts/brittany-signature-script-cufonfonts-webfont/BrittanySignatureScript.woff",
  weight: "400",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    siteName: "OBIAS Nursing & Allied Courses Review Center",
    locale: "en_PH",
  },
  title: {
    default: "OBIAS Nursing & Allied Courses Review Center",
    template: "%s | OBIAS Review Center",
  },
  description:
    "20+ years preparing nursing and allied-health graduates for their board licensure exams in Las Piñas City.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${oswald.variable} ${brittanySignature.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
