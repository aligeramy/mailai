import Image from "next/image";
import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/**
 * Server component — reads the NextAuth session and renders either:
 *   • Signed in  → user avatar + display name + Sign out button
 *   • Signed out → "Sign in" link button
 *
 * Drop this next to <ThemeToggle /> in any server-rendered header.
 */
export async function HeaderAuth() {
  const session = await auth();

  if (!session?.user) {
    return (
      <Link
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "gap-1.5"
        )}
        href="/login"
      >
        {/* Microsoft "M" squares */}
        <svg
          aria-hidden="true"
          height="13"
          viewBox="0 0 21 21"
          width="13"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect fill="#f25022" height="9" width="9" x="1" y="1" />
          <rect fill="#00a4ef" height="9" width="9" x="11" y="1" />
          <rect fill="#7fba00" height="9" width="9" x="1" y="11" />
          <rect fill="#ffb900" height="9" width="9" x="11" y="11" />
        </svg>
        Sign in
      </Link>
    );
  }

  const { user } = session;
  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-2">
      {/* Avatar */}
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted font-semibold text-[0.65rem] text-muted-foreground"
      >
        {user.image ? (
          <Image
            alt={user.name ?? ""}
            className="size-full object-cover"
            height={28}
            src={user.image}
            width={28}
          />
        ) : (
          initials
        )}
      </span>

      {/* Name — hidden on small screens */}
      <span className="hidden max-w-[120px] truncate font-medium text-sm leading-none sm:block">
        {user.name ?? user.email}
      </span>

      {/* Sign out */}
      <form action={signOutAction}>
        <Button size="sm" type="submit" variant="ghost">
          Sign out
        </Button>
      </form>
    </div>
  );
}
