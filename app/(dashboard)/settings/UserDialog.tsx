"use client";

import { useState, useTransition } from "react";
import { createUser, updateUser } from "@/server/actions/users";
import { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";

type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: Role;
  locationId: string | null;
  isActive: boolean;
};

type Location = { id: string; code: string; name: string };

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  WAREHOUSE_MANAGER: "Warehouse Manager",
  STORE_MANAGER: "Store Manager",
  ANALYST: "Analyst",
};

const ROLES_NEEDING_LOCATION: Role[] = ["WAREHOUSE_MANAGER", "STORE_MANAGER"];

interface Props {
  mode: "create" | "edit";
  user?: UserRecord;
  locations: Location[];
}

export function UserDialog({ mode, user, locations }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [role, setRole] = useState<Role>(user?.role ?? Role.STORE_MANAGER);
  const [locationId, setLocationId] = useState(user?.locationId ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;

    startTransition(async () => {
      try {
        if (mode === "create") {
          const password = get("password");
          if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
          }
          await createUser({
            email: get("email"),
            name: get("name"),
            password,
            role,
            locationId: ROLES_NEEDING_LOCATION.includes(role) ? locationId || undefined : undefined,
          });
        } else if (user) {
          await updateUser(user.id, {
            name: get("name"),
            role,
            locationId: ROLES_NEEDING_LOCATION.includes(role) ? locationId || null : null,
          });
        }
        setOpen(false);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  const trigger =
    mode === "create" ? (
      <Button size="sm" className="gap-1.5">
        <Plus className="w-4 h-4" /> New User
      </Button>
    ) : (
      <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-500">
        <Pencil className="w-3.5 h-3.5" />
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New User" : "Edit User"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full Name *</Label>
            <Input id="name" name="name" defaultValue={user?.name} placeholder="Jane Dupont" required />
          </div>
          {mode === "create" && (
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" placeholder="jane@rolle.com" required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Role *</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {ROLES_NEEDING_LOCATION.includes(role) && (
            <div className="space-y-1.5">
              <Label>Assigned Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a location..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.code} — {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {mode === "create" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Password *</Label>
              <Input id="password" name="password" type="password" placeholder="min. 8 characters" required />
            </div>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : mode === "create" ? "Create User" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
