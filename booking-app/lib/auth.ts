import NextAuth from "next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    {
      id: "nyu-sso",
      name: "NYU SSO",
      type: "oidc",
      issuer: process.env.OIDC_ISSUER,
      clientId: process.env.OIDC_CLIENT_ID,
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
    },
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, profile }) {
      if (profile) {
        token.email = profile.email as string;
        // NYU SSO may return netId as "username", "uid", or "preferred_username"
        token.netId =
          (profile as Record<string, unknown>).username ??
          (profile as Record<string, unknown>).uid ??
          profile.preferred_username ??
          (profile.email as string)?.split("@")[0];
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        (session.user as unknown as Record<string, unknown>).netId =
          token.netId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
});
