import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Auth.js (NextAuth v5) sessions are available via the `auth()` helper in
// Server Components and API routes. Route protection can be added here later:
//
//   import { auth } from "@/auth";
//   const session = await auth();
//   if (!session && protectedPath) return NextResponse.redirect("/login");

/**
 * Office on the web loads ribbon/command PNGs via credentialed cross-origin requests.
 * A wildcard Access-Control-Allow-Origin breaks those fetches; echo allowed origins instead.
 *
 * @see https://github.com/OfficeDev/office-js/issues/2467
 * @see https://learn.microsoft.com/en-us/office/dev/add-ins/design/add-in-icons
 */
function isAllowedOfficeOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }
    return (
      hostname.endsWith(".office.com") ||
      hostname.endsWith(".office365.com") ||
      hostname.endsWith(".officeapps.live.com") ||
      /*
       * Some Outlook web entry points (e.g. consumer):
       * @see https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/use-outlook-rest-api
       */
      hostname === "outlook.live.com"
    );
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest): NextResponse {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS" && origin && isAllowedOfficeOrigin(origin)) {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Max-Age", "86400");
    return response;
  }

  const response = NextResponse.next();
  if (origin && isAllowedOfficeOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  /*
   * Microsoft recommends add-in image URLs be cacheable (avoid no-store) in production.
   */
  response.headers.set(
    "Cache-Control",
    "public, max-age=86400, stale-while-revalidate=604800"
  );
  return response;
}

export const config = {
  matcher: ["/assets/:path*", "/logo.png"],
};
