import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 text-center px-4">
      <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center">
        <MapPin className="w-7 h-7 text-slate-400" />
      </div>
      <div>
        <h1 className="text-5xl font-bold text-slate-800 mb-2">404</h1>
        <h2 className="text-lg font-semibold text-slate-700">Page not found</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-xs">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>
      <Link href="/dashboard">
        <Button size="sm">Back to dashboard</Button>
      </Link>
    </div>
  );
}
