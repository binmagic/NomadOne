import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { ProviderCredentialFetchBridge } from "@/components/layout/provider-credential-fetch-bridge";
import { BackToTopButton } from "@/components/shared/back-to-top-button";
import { getSessionUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <ProviderCredentialFetchBridge />
      <AppShell user={user}>{children}</AppShell>
      <BackToTopButton />
    </>
  );
}
