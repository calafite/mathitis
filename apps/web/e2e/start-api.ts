import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DB_USER = 'mathitis_app';
const DB_PASS = 'test_password';
const DB_NAME = 'mathitis_e2e';
const PG_CONTAINER = 'mathitis-e2e-pg';
const REDIS_CONTAINER = 'mathitis-e2e-redis';
const API_DIR = fileURLToPath(new URL('../../api', import.meta.url));
const apiBin = (name: string) => join(API_DIR, 'node_modules', '.bin', name);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function docker(args: string[], options?: { stdio?: 'ignore' | 'pipe' }): string {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: options?.stdio ?? 'pipe',
  });
}

function publishedPort(container: string, internalPort: number): number {
  const output = docker(['port', container, `${internalPort}/tcp`]);
  const match = output.match(/:(\d+)\s*$/m);
  if (!match) throw new Error(`Could not determine published port for ${container}`);
  return Number(match[1]);
}

async function main() {
  try {
    docker(['rm', '-f', PG_CONTAINER, REDIS_CONTAINER], { stdio: 'ignore' });
  } catch {
    // The containers may not exist on a clean runner.
  }
  docker([
    'run',
    '-d',
    '--name',
    PG_CONTAINER,
    '-e',
    `POSTGRES_USER=${DB_USER}`,
    '-e',
    `POSTGRES_PASSWORD=${DB_PASS}`,
    '-e',
    `POSTGRES_DB=${DB_NAME}`,
    '-p',
    '0:5432',
    'postgres:16-alpine',
  ]);
  try {
    docker(['run', '-d', '--name', REDIS_CONTAINER, '-p', '0:6379', 'redis:7-alpine']);
  } catch (error) {
    docker(['rm', '-f', PG_CONTAINER], { stdio: 'ignore' });
    throw error;
  }

  const pgPort = publishedPort(PG_CONTAINER, 5432);
  const redisPort = publishedPort(REDIS_CONTAINER, 6379);
  const databaseUrl = `postgresql://${DB_USER}:${DB_PASS}@localhost:${pgPort}/${DB_NAME}`;
  const redisUrl = `redis://localhost:${redisPort}`;

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      docker(
        ['exec', PG_CONTAINER, 'pg_isready', '-U', DB_USER, '-d', DB_NAME, '-h', 'localhost'],
        {
          stdio: 'ignore',
        },
      );
      docker(['exec', REDIS_CONTAINER, 'redis-cli', 'ping'], { stdio: 'ignore' });
      break;
    } catch {
      await sleep(500);
    }
  }
  if (Date.now() >= deadline) {
    throw new Error('E2E PostgreSQL/Redis containers did not become ready in time');
  }

  const env = {
    ...process.env,
    NODE_ENV: 'development',
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
  };
  execFileSync(apiBin('prisma'), ['migrate', 'deploy'], {
    cwd: API_DIR,
    env,
    stdio: 'inherit',
  });
  execFileSync(apiBin('tsx'), ['prisma/seed.ts'], { cwd: API_DIR, env, stdio: 'inherit' });

  const api: ChildProcess = spawn(apiBin('tsx'), ['src/main.ts'], {
    cwd: API_DIR,
    env,
    stdio: 'inherit',
  });
  const cleanup = () => {
    api.kill('SIGTERM');
    try {
      docker(['rm', '-f', PG_CONTAINER, REDIS_CONTAINER], { stdio: 'ignore' });
    } catch {
      // Cleanup is best effort after the API process exits.
    }
  };
  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);

  api.once('exit', (code, signal) => {
    cleanup();
    process.exit(code ?? (signal ? 1 : 0));
  });
}

main().catch((error) => {
  try {
    docker(['rm', '-f', PG_CONTAINER, REDIS_CONTAINER], { stdio: 'ignore' });
  } catch {
    // Cleanup is best effort when startup fails.
  }
  console.error(error);
  process.exit(1);
});
