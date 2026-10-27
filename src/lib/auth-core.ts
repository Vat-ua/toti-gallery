import { betterAuth } from "better-auth/minimal";
import { APIError, createAuthMiddleware, addOAuthServerContext, getOAuthState } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, authSessions, rateLimits, users, verifications } from "@/db/schema";
import { admitGoogleIdentity, inspectAccessLink } from "./access-links";
import { allowAttempt } from "./auth-rate-limit";
import { authSettings } from "./auth-settings";

function createAuth() {
  const settings = authSettings();
  return betterAuth({
    appName: "Toti Gallery",
    baseURL: settings.baseURL,
    secret: settings.secret,
    trustedOrigins: [settings.baseURL],
    database: drizzleAdapter(db, { provider: "pg", transaction: true, schema: { user: users, account: accounts, session: authSessions, verification: verifications, rateLimit: rateLimits } }),
    emailAndPassword: { enabled: true, disableSignUp: true, requireEmailVerification: true, minPasswordLength: 15, maxPasswordLength: 128, revokeSessionsOnPasswordReset: true },
    socialProviders: settings.google ? { google: { ...settings.google, disableSignUp: true, prompt: "select_account", overrideUserInfoOnSignIn: false } } : {},
    user: {
      additionalFields: {
        role: { type: "string", required: true, defaultValue: "user", input: false },
        status: { type: "string", required: true, defaultValue: "pending", input: false },
        isDemo: { type: "boolean", required: true, defaultValue: false, input: false, returned: false },
      },
      async validateUserInfo({ user, source }) {
        const context = (await getOAuthState())?.serverContext;
        const activation = typeof context?.activationUserId === "string" && typeof context?.activationGrantId === "string" ? { userId: context.activationUserId, grantId: context.activationGrantId } : undefined;
        if (source.action === "create-user" || source.method !== "oauth" || source.oauth?.providerId !== "google" || !await admitGoogleIdentity(user, activation)) return { error: activation ? "activation_account_mismatch" : "access_not_allowed", errorDescription: "Use a conta Google cadastrada pela administração." };
      },
      changeEmail: { enabled: false },
      deleteUser: { enabled: false },
    },
    account: {
      // Only admin-provisioned rows exist. A verified Google email may activate
      // that pending row; the validation gate rejects all demo/unapproved users.
      accountLinking: { enabled: true, requireLocalEmailVerified: false, allowDifferentEmails: false, updateUserInfoOnLink: false },
      encryptOAuthTokens: true,
    },
    session: { expiresIn: 30 * 24 * 60 * 60, cookieCache: { enabled: false } },
    verification: { storeIdentifier: "hashed" },
    advanced: { cookiePrefix: "toti_gallery", useSecureCookies: settings.baseURL.startsWith("https:"), ipAddress: { ipAddressHeaders: ["x-real-ip"] } },
    // Include the custom password route's window so Better Auth's shared-table
    // cleanup cannot prematurely remove our 15-minute password-change counters.
    rateLimit: { enabled: true, storage: "database", window: 60, max: 100, customRules: { "/sign-in/email": { window: 60, max: 10 }, "/sign-in/social": { window: 60, max: 20 }, "/change-password": { window: 900, max: 10 } } },
    databaseHooks: {
      user: { create: { before: async () => false } },
      session: { create: { before: async session => {
        const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
        if (!user || user.isDemo || user.status !== "active" || !user.emailVerified) throw new APIError("FORBIDDEN", { message: "Esta conta não tem acesso. Fale com a administração." });
        return { data: session };
      } } },
    },
    hooks: { before: createAuthMiddleware(async ctx => {
      if (ctx.path === "/sign-in/social" && ctx.body?.additionalData?.activationToken !== undefined) {
        try {
          if (ctx.body.provider !== "google" || ctx.body.idToken) throw new Error();
          const grant = await inspectAccessLink(ctx.body.additionalData.activationToken);
          if (grant.purpose !== "activation") throw new Error();
          await addOAuthServerContext({ activationUserId: grant.userId, activationGrantId: grant.grantId });
          // Persist only server-validated IDs in OAuth state, never the bearer token.
          ctx.body.additionalData = {};
          ctx.body.loginHint = grant.email;
        } catch { throw new APIError("BAD_REQUEST", { message: "Abra um link de ativação válido ou entre pela página de acesso." }); }
      }
      if (ctx.path === "/sign-in/email") {
        if (typeof ctx.body?.email === "string") ctx.body.email = ctx.body.email.trim().toLowerCase();
        if (!await allowAttempt("login-account", String(ctx.body?.email || ""), 15, 60)) throw new APIError("TOO_MANY_REQUESTS", { message: "Muitas tentativas. Aguarde um minuto." });
      }
    }) },
    onAPIError: { errorURL: `${settings.baseURL}/entrar` },
    logger: { level: "error" },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return instance ??= createAuth(); }
