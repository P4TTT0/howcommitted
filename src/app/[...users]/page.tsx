import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Experience } from "@/features/experience/Experience";
import { parseSoloLogin } from "@/features/experience/parseSoloLogin";
import { loadCachedPoster } from "@/og/load";
import { userMetadata } from "@/og/metadata";
import { parseVersusLogins } from "@/features/versus/parseVersusLogins";
import { VersusExperience } from "@/features/versus/VersusExperience";
import { isVersusEnabled } from "@/features/versus/versusGate";

type Props = { params: Promise<{ users: string[] }> };

/** One login is solo; two to five are versus, outside production only. */
async function routeLogins(params: Props["params"]): Promise<string[]> {
  const { users } = await params;
  const solo = parseSoloLogin(users);
  if (solo !== null) return [solo];
  if (isVersusEnabled(process.env)) {
    const logins = parseVersusLogins(users);
    if (logins !== null) return logins;
  }
  notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const logins = await routeLogins(params);
  const [login] = logins;
  if (logins.length > 1) {
    return {
      title: `${logins.map((name) => `@${name}`).join(" vs ")} | Committed`,
    };
  }
  // Cache only: link previews must never trigger a GitHub request or the quota.
  return userMetadata(login as string, await loadCachedPoster(login as string));
}

export default async function UserPage({ params }: Props) {
  const logins = await routeLogins(params);
  const [login] = logins;
  if (logins.length > 1) {
    return <VersusExperience key={logins.join("/")} logins={logins} />;
  }
  // The key remounts the experience when the login changes, so state from one
  // profile can never leak into another.
  return <Experience key={login} login={login as string} />;
}
