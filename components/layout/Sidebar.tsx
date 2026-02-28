"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ArrowLeftRight,
  ShoppingCart,
  TrendingUp,
  GitFork,
  Bell,
  BarChart2,
  MapPin,
  Truck,
  Settings,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Inventory", href: "/inventory", icon: Warehouse },
  { label: "Products", href: "/products", icon: Package },
  { label: "Transfer Orders", href: "/transfer-orders", icon: ArrowLeftRight },
  { label: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart },
  { label: "Forecasts", href: "/forecasts", icon: TrendingUp },
  { label: "Allocation", href: "/allocation", icon: GitFork },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "Reports", href: "/reports", icon: BarChart2 },
  { label: "Locations", href: "/locations", icon: MapPin },
  { label: "Suppliers", href: "/suppliers", icon: Truck },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Setup Guide", href: "/setup", icon: Sparkles },
];

interface Props {
  userRole?: string;
}

export function Sidebar({ userRole }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-slate-900 text-slate-100 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-800">
        <div className="w-7 h-7 bg-white rounded flex items-center justify-center shrink-0">
          <span className="text-slate-900 font-bold text-xs">R</span>
        </div>
        <div>
          <div className="font-semibold text-white text-sm tracking-wide uppercase">
            Rolle
          </div>
          <div className="text-slate-400 text-xs">Inventory</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <ul className="space-y-0.5">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    active
                      ? "bg-slate-700 text-white font-medium"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
          {userRole === "ADMIN" && (
            <li>
              <Link
                href="/admin"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  pathname.startsWith("/admin")
                    ? "bg-slate-700 text-white font-medium"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                )}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                Admin
              </Link>
            </li>
          )}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-500">
        1 warehouse · 20 stores
      </div>
    </aside>
  );
}
