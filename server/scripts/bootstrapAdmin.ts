import readline from 'readline';
import { bootstrapAdministrator, isAdminProvisioned } from '../auth/bootstrapService.ts';

/**
 * Prompts user on stdin for input, with optional hidden masking for sensitive passwords.
 */
function promptSecure(query: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (!hidden) {
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }

    // Hidden input mode: intercept keystrokes without echoing to stdout
    process.stdout.write(query);
    const stdin = process.stdin;
    const isRaw = stdin.isRaw;

    if (stdin.isTTY) {
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');

      let input = '';
      const onData = (char: string) => {
        // Handle Enter (Carriage return / line feed)
        if (char === '\n' || char === '\r' || char === '\u0004') {
          stdin.setRawMode(Boolean(isRaw));
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
          return;
        }

        // Handle Ctrl+C
        if (char === '\u0003') {
          stdin.setRawMode(Boolean(isRaw));
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          process.exit(130);
        }

        // Handle Backspace / Delete
        if (char === '\u0008' || char === '\x7f') {
          if (input.length > 0) {
            input = input.slice(0, -1);
          }
          return;
        }

        input += char;
      };

      stdin.on('data', onData);
    } else {
      // Non-interactive fallback (piped stdin)
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

export async function runCliBootstrap() {
  console.log('=== IT Asset Management: Administrator Account Bootstrap ===');

  try {
    const alreadyExists = await isAdminProvisioned();
    if (alreadyExists) {
      console.error('[Error] An administrator account already exists. Only exactly ONE administrator is allowed.');
      console.error('Aborting bootstrap.');
      process.exit(1);
    }

    // 1. Acquire username
    let username = process.env.ADMIN_BOOTSTRAP_USERNAME?.trim();
    if (!username) {
      username = await promptSecure('Enter administrator username (default: admin): ');
      if (!username) {
        username = 'admin';
      }
    }

    // 2. Acquire password securely (secret channel via environment or interactive masked prompt)
    let password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    if (password) {
      // Clear from process.env immediately to limit exposure
      delete process.env.ADMIN_BOOTSTRAP_PASSWORD;
    } else {
      password = await promptSecure('Enter administrator password (min 10 characters): ', true);
      const confirmPassword = await promptSecure('Confirm administrator password: ', true);

      if (password !== confirmPassword) {
        console.error('[Error] Passwords do not match. Aborting.');
        process.exit(1);
      }
    }

    // 3. Provision administrator
    const result = await bootstrapAdministrator({ username, password });

    if (!result.success) {
      console.error(`[Error] Bootstrap failed: ${result.error}`);
      process.exit(1);
    }

    console.log('[Success] Administrator account provisioned successfully.');
    console.log(`[Details] Admin ID: ${result.admin?.id}, Username: ${result.admin?.username}`);
    process.exit(0);
  } catch (err: any) {
    console.error('[Fatal Error] Administrator bootstrap failed:', err.message);
    process.exit(1);
  }
}

// Execute if run directly from CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  runCliBootstrap();
}
