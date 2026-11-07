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
  const host = process.env.HOST || '0.0.0.0';
  const nodeEnv = process.env.NODE_ENV || 'development';

  return {
    port: isNaN(port) ? 3000 : port,
    host,
    nodeEnv,
  };
}
