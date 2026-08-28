import { PrismaClient, type UserRole } from '@prisma/client';
import argon2 from 'argon2';
import { generateEmbedding } from '../src/lib/embeddings.js';

const prisma = new PrismaClient();

const DEFAULT_TAGS = [
  { name: 'python', category: 'tech-stack', color: '#3b82f6', icon: '🐍' },
  { name: 'typescript', category: 'tech-stack', color: '#3b82f6', icon: '🔷' },
  { name: 'javascript', category: 'tech-stack', color: '#facc15', icon: '📜' },
  { name: 'julia', category: 'tech-stack', color: '#22c55e', icon: '⬤' },
  { name: 'r', category: 'tech-stack', color: '#22c55e', icon: '📈' },
  { name: 'c', category: 'tech-stack', color: '#64748b', icon: '🔤' },
  { name: 'cpp', category: 'tech-stack', color: '#00599c', icon: '➕' },
  { name: 'java', category: 'tech-stack', color: '#e76f00', icon: '☕' },
  { name: 'rust', category: 'tech-stack', color: '#b7410e', icon: '🦀' },
  { name: 'go', category: 'tech-stack', color: '#00add8', icon: '🐹' },
  { name: 'competitive-programming', category: 'interest', color: '#f59e0b', icon: '🏆' },
  { name: 'machine-learning', category: 'interest', color: '#ec4899', icon: '🧠' },
  { name: 'data-visualisation', category: 'interest', color: '#f43f5e', icon: '📉' },
  { name: 'otimizacao', category: 'interest', color: '#f59e0b', icon: '⚙️' },
  { name: 'inteligencia-artificial', category: 'interest', color: '#ec4899', icon: '🤖' },
  { name: 'visao-computacional', category: 'interest', color: '#a855f7', icon: '👁️' },
  { name: 'analise-de-dados', category: 'interest', color: '#f43f5e', icon: '📊' },
  { name: 'ciberseguranca', category: 'interest', color: '#dc2626', icon: '🔒' },
  { name: 'desenvolvimento-web', category: 'interest', color: '#0ea5e9', icon: '🌐' },
  { name: 'backend', category: 'interest', color: '#0ea5e9', icon: '🗄️' },
  { name: 'frontend', category: 'interest', color: '#0ea5e9', icon: '🖥️' },
  { name: 'fullstack', category: 'interest', color: '#0ea5e9', icon: '🧩' },
  { name: 'design', category: 'interest', color: '#a855f7', icon: '🎨' },
  { name: 'engenharia-de-software', category: 'interest', color: '#6366f1', icon: '🏗️' },
  { name: 'compiladores', category: 'interest', color: '#6366f1', icon: '🛠️' },
  { name: 'desenvolvimento-de-sistemas', category: 'interest', color: '#64748b', icon: '💻' },
  { name: 'robotica', category: 'interest', color: '#22c55e', icon: '🦾' },
  { name: 'computacao-quantica', category: 'interest', color: '#8b5cf6', icon: '⚛️' },
  { name: 'academia-e-pesquisa', category: 'interest', color: '#0284c7', icon: '🎓' },
  { name: 'desenvolvimento-cientifico', category: 'interest', color: '#0284c7', icon: '🔬' },
  { name: 'codigo-de-baixo-nivel', category: 'interest', color: '#64748b', icon: '🧵' },
];

const DEFAULT_CONFIG: Record<string, unknown> = {
  REQUIRE_ADMIN_REQUEST_APPROVAL: false,
  REGISTRATION_ENABLED: true,
  DISCOVERY_ACTIVE: true,
  MAX_FRESHMAN_REQUESTS: 3,
  MAX_SENIOR_MENTEES: 3,
  EMAIL_NOTIFICATIONS_ENABLED: true,
};

const TEST_USERS: Array<{
  handle: string;
  email: string;
  role: UserRole;
  semester: number;
  password: string;
  socialName?: string;
  isDiscoverable?: boolean;
}> = [
  {
    handle: 'satanyahu',
    email: 'satanyahu@cs.uni.edu',
    role: 'senior',
    semester: 8,
    password: 'TestPassword123!',
    socialName: 'Satanyahu',
    isDiscoverable: true,
  },
  {
    handle: 'nycodemonius',
    email: 'nycodemonius@cs.uni.edu',
    role: 'senior',
    semester: 7,
    password: 'TestPassword123!',
    socialName: 'Nycodemonius',
    isDiscoverable: true,
  },
  {
    handle: 'joaopedrosasa',
    email: 'joaopedrosasa@cs.uni.edu',
    role: 'senior',
    semester: 2,
    password: 'TestPassword123!',
    socialName: 'Joaopedrosasa',
    isDiscoverable: false,
  },
  {
    handle: 'admin',
    email: 'admin@mathitis.dev',
    role: 'administrator',
    semester: 12,
    password: 'TestPassword123!',
    socialName: 'Administrator',
  },
  {
    handle: 'developer',
    email: 'developer@mathitis.dev',
    role: 'developer',
    semester: 12,
    password: 'TestPassword123!',
    socialName: 'Developer',
  },
];

async function seed() {
  console.log('Seeding default tags...');
  for (const tag of DEFAULT_TAGS) {
    const upserted = await prisma.tag.upsert({
      where: { name: tag.name },
      update: { icon: tag.icon },
      create: tag,
    });
    // Generate embedding if the tag doesn't have one yet.
    const row = await prisma.$queryRaw<{ has_embedding: boolean }[]>`
      SELECT embedding IS NOT NULL as has_embedding FROM tags WHERE id = ${upserted.id}::uuid
    `;
    if (!row[0]?.has_embedding) {
      const embedding = await generateEmbedding(tag.name);
      await prisma.$executeRaw`UPDATE tags SET embedding = ${embedding}::float[] WHERE id = ${upserted.id}::uuid`;
    }
  }

  console.log('Seeding system config...');
  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    await prisma.systemConfig.upsert({
      where: { key },
      update: {},
      create: { key, value: value as object },
    });
  }

  console.log('Seeding test users...');
  for (const user of TEST_USERS) {
    const passwordHash = await argon2.hash(user.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await prisma.user.upsert({
      where: { handle: user.handle },
      update: {},
      create: {
        handle: user.handle,
        email: user.email,
        passwordHash,
        role: user.role,
        semester: user.semester,
        status: 'active',
        profile: {
          create: {
            socialName: user.socialName,
            isDiscoverable: user.isDiscoverable ?? false,
          },
        },
      },
    });
  }

  console.log('Seed complete.');
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
