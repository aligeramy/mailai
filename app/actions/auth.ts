"use server";

import { signIn, signOut } from "@/auth";

/** Kick off the Microsoft Entra ID OAuth flow and redirect to the taskpane on success. */
export async function signInWithMicrosoft(_formData?: FormData) {
  await signIn("microsoft-entra-id", { redirectTo: "/taskpane" });
}

/** Sign out and return to the home page. */
export async function signOutAction(_formData?: FormData) {
  await signOut({ redirectTo: "/" });
}
