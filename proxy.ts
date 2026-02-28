import withAuth from "next-auth/middleware";

export const proxy = withAuth;

export const config = {
  matcher: [
    // Protect all dashboard routes; leave /login and /api/auth public
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
