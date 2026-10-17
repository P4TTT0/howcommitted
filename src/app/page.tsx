import { LandingHeader } from "@/features/search/LandingHeader";
import { Search } from "@/features/search/Search";
import { SignatureLine } from "@/features/search/SignatureLine";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-block-signal text-ink">
      <LandingHeader />
      <main className="flex flex-1 flex-col justify-center px-[clamp(1rem,4vw,3rem)] py-8">
        <Search />
      </main>
      <SignatureLine />
    </div>
  );
}
