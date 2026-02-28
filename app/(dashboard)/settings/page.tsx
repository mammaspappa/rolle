import { db } from "@/server/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { UserDialog } from "./UserDialog";
import { DeactivateUserButton } from "./DeactivateUserButton";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  WAREHOUSE_MANAGER: "Warehouse Manager",
  STORE_MANAGER: "Store Manager",
  ANALYST: "Analyst",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  WAREHOUSE_MANAGER: "bg-blue-100 text-blue-700",
  STORE_MANAGER: "bg-teal-100 text-teal-700",
  ANALYST: "bg-slate-100 text-slate-600",
};

async function getUsers() {
  return db.user.findMany({
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    include: { location: { select: { code: true, name: true } } },
  });
}

async function getLocations() {
  return db.location.findMany({
    where: { isActive: true },
    orderBy: [{ type: "desc" }, { code: "asc" }],
    select: { id: true, code: true, name: true },
  });
}

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const currentUserId = (session?.user as { id?: string })?.id;
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";

  const [users, locations] = await Promise.all([getUsers(), getLocations()]);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            {users.filter((u) => u.isActive).length} active users · {users.filter((u) => !u.isActive).length} inactive
          </p>
        </div>
        {isAdmin && <UserDialog mode="create" locations={locations} />}
      </div>

      <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500">Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500">Email</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500">Role</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500">Location</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-500">Status</th>
              {isAdmin && <th className="px-4 py-2.5"></th>}
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => (
              <tr
                key={user.id}
                className={`border-b border-slate-100 last:border-0 ${!user.isActive ? "opacity-50" : i % 2 === 0 ? "" : "bg-slate-50/50"}`}
              >
                <td className="px-4 py-3 font-medium text-slate-800">
                  {user.name}
                  {user.id === currentUserId && (
                    <span className="ml-2 text-xs text-slate-400">(you)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${ROLE_COLORS[user.role]}`}>
                    {ROLE_LABELS[user.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {user.location ? (
                    <span className="font-mono">{user.location.code}</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={user.isActive ? "text-green-600 border-green-200" : "text-slate-400 border-slate-200"}
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 flex items-center gap-1">
                    <UserDialog
                      mode="edit"
                      user={{
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        locationId: user.locationId,
                        isActive: user.isActive,
                      }}
                      locations={locations}
                    />
                    <DeactivateUserButton
                      userId={user.id}
                      isActive={user.isActive}
                      isSelf={user.id === currentUserId}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
