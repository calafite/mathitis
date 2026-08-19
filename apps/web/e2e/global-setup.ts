import { execSync } from 'node:child_process';

const PG_PORT = 5434;
const REDIS_PORT = 6381;
const DB_USER = 'mathitis_app';
const DB_PASS = 'test_password';
const DB_NAME = 'mathitis_e2e';
const PG_CONTAINER = 'mathitis-e2e-pg';
const REDIS_CONTAINER = 'mathitis-e2e-redis';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function globalSetup() {
  execSync(`docker rm -f ${PG_CONTAINER} ${REDIS_CONTAINER}`, { stdio: 'ignore' });
  execSync(
    `docker run -d --name ${PG_CONTAINER} -e POSTGRES_USER=${DB_USER} -e POSTGRES_PASSWORD=${DB_PASS} -e POSTGRES_DB=${DB_NAME} -p ${PG_PORT}:5432 postgres:16-alpine`,
    { stdio: 'ignore' },
  );
  execSync(`docker run -d --name ${REDIS_CONTAINER} -p ${REDIS_PORT}:6379 redis:7-alpine`, {
    stdio: 'ignore',
  });

  const deadline = Date.now() + 30_000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      execSync(`docker exec ${PG_CONTAINER} pg_isready -U ${DB_USER} -d ${DB_NAME} -h localhost`, {
        stdio: 'ignore',
      });
      execSync(`docker exec ${REDIS_CONTAINER} redis-cli ping`, { stdio: 'ignore' });
      ready = true;
      break;
    } catch {
      await sleep(500);
    }
  }
  if (!ready) {
    throw new Error('E2E PostgreSQL/Redis containers did not become ready in time');
  }

  const databaseUrl = `postgresql://${DB_USER}:${DB_PASS}@localhost:${PG_PORT}/${DB_NAME}`;
  execSync('pnpm --filter @mathitis/api db:deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
  execSync('pnpm --filter @mathitis/api db:seed', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
}
