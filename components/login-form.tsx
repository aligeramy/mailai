import { signInWithMicrosoft } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

/** Microsoft OAuth sign-in form. Submitting triggers the Entra ID flow. */
export function LoginForm() {
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-bold text-2xl tracking-tight">Sign in to MailAI</h1>
        <p className="max-w-xs text-balance text-muted-foreground text-sm">
          Use your Microsoft 365 or Outlook account to continue
        </p>
      </div>

      {/* Microsoft sign-in */}
      <form action={signInWithMicrosoft}>
        <Button className="w-full gap-2" size="lg" type="submit">
          {/* Official Microsoft "M" mark */}
          <svg
            aria-hidden="true"
            height="18"
            viewBox="0 0 21 21"
            width="18"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect fill="#f25022" height="9" width="9" x="1" y="1" />
            <rect fill="#00a4ef" height="9" width="9" x="11" y="1" />
            <rect fill="#7fba00" height="9" width="9" x="1" y="11" />
            <rect fill="#ffb900" height="9" width="9" x="11" y="11" />
          </svg>
          Continue with Microsoft
        </Button>
      </form>

      {/* Fine print */}
      <p className="text-balance text-center text-muted-foreground text-xs">
        By signing in you agree to our{" "}
        <a className="underline underline-offset-4 hover:text-foreground" href="/terms">
          Terms
        </a>{" "}
        and{" "}
        <a className="underline underline-offset-4 hover:text-foreground" href="/privacy">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
