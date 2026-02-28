import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { db } from "@/server/db";

interface SessionUser {
  name?: string | null;
  email?: string | null;
  role?: string;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const alertCount = await db.alert.count({
    where: { isResolved: false },
  });

  const userName = (session.user as SessionUser).name ?? session.user.email ?? "";
  const userRole = (session.user as SessionUser).role ?? "ANALYST";

  return (
    <SessionProvider>
      <AppShell userName={userName} userRole={userRole} alertCount={alertCount}>
        {children}
      </AppShell>
    </SessionProvider>
  );
}
