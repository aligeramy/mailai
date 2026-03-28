"use server";

import { signIn, signOut } from "@/auth";

/** Kick off the Microsoft Entra ID OAuth flow; after success, guide users into Outlook. */
export async function signInWithMicrosoft(_formData?: FormData) {
  await signIn("microsoft-entra-id", { redirectTo: "/open-outlook" });
}

/** Sign out and return to the home page. */
export async function signOutAction(_formData?: FormData) {
  await signOut({ redirectTo: "/" });
}
