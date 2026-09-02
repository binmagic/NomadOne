import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getSessionUser } from "@/lib/auth/session";
import { countUsers } from "@/lib/auth/user-service";
import { isRegisterAllowed } from "@/lib/utils/env";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if ((await countUsers()) === 0) {
    redirect("/setup");
  }
  if (!isRegisterAllowed()) {
    redirect("/login");
  }
  if (await getSessionUser()) {
    redirect("/");
  }
  return <AuthForm mode="register" />;
}
