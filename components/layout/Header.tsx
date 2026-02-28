"use client";

import { signOut } from "next-auth/react";
import { Bell, LogOut, Menu, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface HeaderProps {
  userName: string;
  userRole: string;
  alertCount?: number;
  onMenuToggle?: () => void;
}

export function Header({ userName, userRole, alertCount = 0, onMenuToggle }: HeaderProps) {
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const roleLabel: Record<string, string> = {
    ADMIN: "Admin",
    WAREHOUSE_MANAGER: "Warehouse Manager",
    STORE_MANAGER: "Store Manager",
    ANALYST: "Analyst",
  };

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-4 lg:px-6 shrink-0">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>
      {/* Desktop spacer */}
      <div className="hidden lg:block" />
      <div className="flex items-center gap-3">
        {/* Alert bell */}
        <Link href="/alerts">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-4 h-4" />
            {alertCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                {alertCount > 9 ? "9+" : alertCount}
              </span>
            )}
          </Button>
        </Link>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 h-9 px-2">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-slate-200 text-slate-700 text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-left hidden sm:block">
                <div className="text-sm font-medium leading-none">{userName}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {roleLabel[userRole] ?? userRole}
                </div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <div className="font-medium">{userName}</div>
              <div className="text-xs text-slate-500">{roleLabel[userRole]}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/users" className="cursor-pointer">
                <User className="w-4 h-4 mr-2" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 cursor-pointer"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
