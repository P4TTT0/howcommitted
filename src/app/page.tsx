import { LandingHeader } from "@/features/search/LandingHeader";
import { Search } from "@/features/search/Search";
import { SignatureLine } from "@/features/search/SignatureLine";

export default function Home() {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-block-signal text-ink">
      <LandingHeader />
      <main className="flex grow shrink-0 flex-col justify-center px-[clamp(1rem,4vw,3rem)] py-2">
        <Search />
      </main>
      <SignatureLine />
    </div>
  );
}
