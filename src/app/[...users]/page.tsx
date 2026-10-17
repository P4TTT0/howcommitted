import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Experience } from "@/features/experience/Experience";
import { parseSoloLogin } from "@/features/experience/parseSoloLogin";

type Props = { params: Promise<{ users: string[] }> };

async function soloLogin(params: Props["params"]): Promise<string> {
  const { users } = await params;
  const login = parseSoloLogin(users);
  if (login === null) notFound();
  return login;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const login = await soloLogin(params);
  return { title: `@${login} | Committed` };
}

export default async function UserPage({ params }: Props) {
  const login = await soloLogin(params);
  // The key remounts the experience when the login changes, so state from one
  // profile can never leak into another.
  return <Experience key={login} login={login} />;
}
