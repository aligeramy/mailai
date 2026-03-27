import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    /** Microsoft Graph access token — available after sign-in. */
    accessToken?: string;
    user: {
      /** NextAuth subject (sub) mapped to user ID. */
      id: string;
      /** Microsoft account object ID. */
      microsoftId?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    microsoftId?: string;
  }
}
