import type { Auth } from "@horaya/auth";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Client Better Auth : passe par /api/auth, donc par la limitation de tentatives. */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>()],
});
