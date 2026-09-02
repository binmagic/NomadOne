import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getSessionUser } from "@/lib/auth/session";
import { countUsers } from "@/lib/auth/user-service";
import { isRegisterAllowed } from "@/lib/utils/env";

export default async function LoginPage() {
  if ((await countUsers()) === 0) {
    redirect("/setup");
  }
  if (await getSessionUser()) {
    redirect("/");
  }
  return <AuthForm mode="login" allowRegister={isRegisterAllowed()} />;
}
