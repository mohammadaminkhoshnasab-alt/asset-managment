import dotenv from 'dotenv';

// Load environment variables from .env if present
dotenv.config();

export interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: string;
  sessionSecret: string;
  cookieSecure: boolean;
}

export function getServerConfig(): ServerConfig {
  const port = parseInt(process.env.PORT || '3000', 10);
  // Default host is strictly local loopback (127.0.0.1). Binding to 0.0.0.0 is an explicit opt-in.
  const host = process.env.HOST || '127.0.0.1';
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Session secret validation
  let sessionSecret = process.env.SESSION_SECRET || '';
  if (!sessionSecret) {
    if (nodeEnv === 'production') {
      throw new Error(
        '[Security Error] SESSION_SECRET must be set to a strong 32+ character secret in production.'
      );
    }
    // Safe non-production development default
    sessionSecret = 'development-default-session-secret-change-in-production-min32chars';
  } else if (nodeEnv === 'production' && sessionSecret.length < 32) {
    throw new Error(
      '[Security Error] In production, SESSION_SECRET must be at least 32 characters long.'
    );
  }

  // Cookie secure flag: explicit override or enabled automatically in production
  const cookieSecure = process.env.COOKIE_SECURE === 'true' 
    ? true 
    : (nodeEnv === 'production');

  return {
    port: isNaN(port) ? 3000 : port,
    host,
    nodeEnv,
    sessionSecret,
    cookieSecure,
  };
}
