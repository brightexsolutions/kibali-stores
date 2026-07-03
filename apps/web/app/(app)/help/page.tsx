import { getSessionMember } from "@/lib/auth";
import { HelpChat } from "./help-chat";

export default async function HelpPage() {
  const member = await getSessionMember();
  return <HelpChat role={member?.role ?? "manager"} />;
}
