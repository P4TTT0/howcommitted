import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidLogin } from "@/domain/login";
import { Experience } from "@/features/experience/Experience";

type Props = { params: Promise<{ users: string[] }> };

/** One segment is the solo experience; versus (several) comes later. */
async function soloLogin(params: Props["params"]): Promise<string> {
  const { users } = await params;
  const [segment] = users;
  if (users.length !== 1 || segment === undefined) notFound();
  let login: string;
  try {
    login = decodeURIComponent(segment);
  } catch {
    notFound();
  }
  if (!isValidLogin(login)) notFound();
  return login;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const login = await soloLogin(params);
  return { title: `@${login} | Committed` };
}

export default async function UserPage({ params }: Props) {
  return <Experience login={await soloLogin(params)} />;
}
