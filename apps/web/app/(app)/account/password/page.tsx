import { requireMember } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export default async function PasswordPage() {
  const member = await requireMember({ allowPasswordChange: true });

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="mb-1 text-2xl font-bold">
        {member.mustChangePassword ? "Set your own password" : "Change password"}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {member.mustChangePassword
          ? "You are using a temporary password. Choose your own to continue."
          : "Choose a new password for your account."}
      </p>
      <PasswordForm />
    </div>
  );
}
