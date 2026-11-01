import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { isAuthenticated } from "@/lib/auth/session";
import { getStatusData } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Middleware handles the redirect in production; this is defence in depth for
  // direct server-side rendering and future route handlers.
  if (!(await isAuthenticated())) redirect("/login");

  const status = await getStatusData();

  return <AppShell status={status}>{children}</AppShell>;
}
