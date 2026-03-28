import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

const COMMON_ISSUER = "https://login.microsoftonline.com/common/v2.0";

/**
 * OIDC issuer for Entra. Default: `/common` (multi-tenant app in Azure).
 * Single-tenant: set AUTH_MICROSOFT_ENTRA_ID_ISSUER to
 * `https://login.microsoftonline.com/<TENANT_ID>/v2.0` (no trailing slash).
 *
 * Note: Auth.js’s Entra provider matches tenant with `(\w+)` only; UUID tenants
 * can break discovery unless you use `/common` or a non-GUID tenant alias.
 */
function microsoftEntraIssuer(): string | undefined {
  const raw = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim();
  if (!raw || raw.toLowerCase() === "common") {
    return COMMON_ISSUER;
  }
  return raw.replace(/\/$/, "");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID ?? "",
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ?? "",
      issuer: microsoftEntraIssuer(),
      authorization: {
        params: {
          // Request Mail.Read + User.Read so the access token can later be used
          // for Microsoft Graph mailbox history queries.
          scope: "openid profile email offline_access Mail.Read User.Read",
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account, profile }) {
      // Persist the Microsoft access token and provider account ID on first sign-in.
      if (account) {
        token.accessToken = account.access_token;
        token.microsoftId = account.providerAccountId;
      }
      return token;
    },

    async session({ session, token }) {
      // Expose the Microsoft access token to the client session.
      session.accessToken = token.accessToken as string | undefined;
      if (session.user) {
        session.user.id = token.sub ?? "";
        (session.user as { microsoftId?: string }).microsoftId =
          token.microsoftId as string | undefined;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});
