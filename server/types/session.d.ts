import 'express-session';

declare module 'express-session' {
  interface SessionData {
    adminId?: string;
    username?: string;
    csrfToken?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: string;
        username: string;
      };
    }
  }
}
