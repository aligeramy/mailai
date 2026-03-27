import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { SITE_NAME } from "@/lib/site-config";

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left — sign-in form */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link className="flex items-center gap-2 font-semibold" href="/">
            <Image
              alt={SITE_NAME}
              className="size-6 rounded-md object-contain"
              height={24}
              src="/logo.png"
              width={24}
            />
            {SITE_NAME}
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>
      </div>

      {/* Right — decorative panel */}
      <div className="relative hidden min-h-svh bg-muted lg:block">
        <Image
          alt=""
          className="object-cover dark:brightness-[0.2] dark:grayscale"
          fill
          priority={false}
          sizes="50vw"
          src="/logo.png"
        />
      </div>
    </div>
  );
}
