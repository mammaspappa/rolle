import { NextAuthOptions, User as NextAuthUser } from "next-auth";
import { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/server/db";

interface AppUser extends NextAuthUser {
  role: string;
  locationId: string | null;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            role: true,
            locationId: true,
            isActive: true,
          },
        });

        if (!user || !user.isActive || !user.password) return null;

        // Support both bcrypt hashes (production) and sha256 (seed data)
        let passwordValid = false;
        if (user.password.startsWith("$2")) {
          passwordValid = await compare(credentials.password, user.password);
        } else {
          // sha256 fallback for seeded dev passwords
          const { createHash } = await import("crypto");
          const hash = createHash("sha256")
            .update(credentials.password)
            .digest("hex");
          passwordValid = hash === user.password;
        }

        if (!passwordValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          locationId: user.locationId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const appUser = user as AppUser;
        token.id = appUser.id;
        token.role = appUser.role;
        token.locationId = appUser.locationId;
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as JWT & { id: string; role: string; locationId: string | null };
      if (session.user) {
        const u = session.user as AppUser;
        u.id = t.id;
        u.role = t.role;
        u.locationId = t.locationId;
      }
      return session;
    },
  },
};
