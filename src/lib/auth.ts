import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import pg from "pg";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        let client: pg.Client | null = null;
        try {
          client = new pg.Client({
            connectionString: process.env.DATABASE_URL!,
            ssl: { rejectUnauthorized: false },
          });
          await client.connect();

          const result = await client.query(
            'SELECT id, email, name, "passwordHash", role FROM "User" WHERE email = $1 LIMIT 1',
            [credentials.email]
          );

          if (result.rows.length === 0) return null;

          const user = result.rows[0];
          const passwordMatch = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );

          if (!passwordMatch) return null;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          };
        } catch (error) {
          console.error("[AUTH] DB error:", error);
          return null;
        } finally {
          if (client) await client.end().catch(() => {});
        }
      },
    }),
  ],
});
