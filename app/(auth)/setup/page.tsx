import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getSessionUser } from "@/lib/auth/session";
import { countUsers } from "@/lib/auth/user-service";

export default async function SetupPage() {
  if ((await countUsers()) > 0) {
    redirect("/login");
  }
  if (await getSessionUser()) {
    redirect("/");
  }
  return <AuthForm mode="setup" />;
}
