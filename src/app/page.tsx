import type { Metadata } from "next";
import { LandingHeader } from "@/features/search/LandingHeader";
import { Search } from "@/features/search/Search";
import { SignatureLine } from "@/features/search/SignatureLine";
import { SITE_NAME } from "@/og/metadata";
import { resolveSiteOrigin } from "@/og/origin";

const title = "How Committed: Watch your GitHub contributions play out";
const description =
  "Play your GitHub contribution history as sound and animation: streaks, weekly rhythm, languages, and versus for up to 5. Rhythm, not productivity.";

// Next merges metadata shallowly per top-level key, so openGraph and twitter
// repeat the site-wide fields from the root layout. The file-based
// opengraph-image and twitter-image still fill in `images`.
export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    siteName: SITE_NAME,
    type: "website",
    url: "/",
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: resolveSiteOrigin(process.env),
    description,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
  };
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-block-signal text-ink">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD, with "<" escaped so it cannot close the tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <LandingHeader />
      <main className="flex grow shrink-0 flex-col justify-center px-[clamp(1rem,4vw,3rem)] py-2">
        <Search />
      </main>
      <SignatureLine />
    </div>
  );
}
