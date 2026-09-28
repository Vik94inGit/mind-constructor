import "express-session";

// The one thing this app stores in a session — see server.ts's session()
// setup and middleware/auth.ts's protect, which reads it back out.
declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}
