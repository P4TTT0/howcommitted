import { actionClass } from "@/ui/classes";

/**
 * "Sign in with GitHub", shown only once the free runs are used. A plain link
 * (full navigation): the OAuth flow is server side and leaves the app. The
 * visitor comes back to `returnTo`, where Play starts the run with their own quota.
 */
export function SignInLink({ returnTo }: { returnTo: string }) {
  return (
    <a
      href={`/api/auth/github?returnTo=${encodeURIComponent(returnTo)}`}
      className={`${actionClass} bg-ink text-paper`}
    >
      Sign in with GitHub
    </a>
  );
}
