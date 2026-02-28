import { redirect } from "next/navigation";

// Root page — redirect into the dashboard
export default function RootPage() {
  redirect("/dashboard");
}
