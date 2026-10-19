import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Experience } from "@/features/experience/Experience";
import { routeLogins } from "@/features/versus/routeLogins";
import { VersusExperience } from "@/features/versus/VersusExperience";
import { loadCachedPoster } from "@/og/load";
import { userMetadata } from "@/og/metadata";

type Props = { params: Promise<{ users: string[] }> };

/**
 * Profile and versus pages stay out of search results: there is one per
 * GitHub account, and only the landing is meant to be found. Links are still
 * followed, and link previews keep working.
 */
const NOT_INDEXED: Metadata["robots"] = { index: false, follow: true };

async function loginsFor(params: Props["params"]): Promise<string[]> {
  const { users } = await params;
  const logins = routeLogins(users);
  if (logins === null) notFound();
  return logins;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const logins = await loginsFor(params);
  const [login] = logins;
  if (logins.length > 1) {
    return {
      title: `${logins.map((name) => `@${name}`).join(" vs ")} | Committed`,
      robots: NOT_INDEXED,
    };
  }
  // Cache only: link previews must never trigger a GitHub request or the quota.
  return {
    ...userMetadata(login as string, await loadCachedPoster(login as string)),
    robots: NOT_INDEXED,
  };
}

export default async function UserPage({ params }: Props) {
  const logins = await loginsFor(params);
  const [login] = logins;
  if (logins.length > 1) {
    return <VersusExperience key={logins.join("/")} logins={logins} />;
  }
  // The key remounts the experience when the login changes, so state from one
  // profile can never leak into another.
  return <Experience key={login} login={login as string} />;
}
