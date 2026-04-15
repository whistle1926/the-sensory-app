import { Role } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: Role;
    impersonatedBy?: string | null;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      impersonatedBy?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    impersonatedBy?: string | null;
  }
}
