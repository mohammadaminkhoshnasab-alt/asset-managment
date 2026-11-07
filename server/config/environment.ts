import dotenv from 'dotenv';

// Load environment variables from .env if present
dotenv.config();

export interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: string;
}

export function getServerConfig(): ServerConfig {
  const port = parseInt(process.env.PORT || '3000', 10);
  // Default host is strictly local loopback (127.0.0.1). Binding to 0.0.0.0 is an explicit opt-in.
  const host = process.env.HOST || '127.0.0.1';
  const nodeEnv = process.env.NODE_ENV || 'development';

  return {
    port: isNaN(port) ? 3000 : port,
    host,
    nodeEnv,
  };
}
