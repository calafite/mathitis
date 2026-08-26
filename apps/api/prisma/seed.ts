import { PrismaClient, type UserRole } from '@prisma/client';
import argon2 from 'argon2';
import { generateEmbedding } from '../src/lib/embeddings.js';

const prisma = new PrismaClient();

const DEFAULT_TAGS = [
  { name: 'algebra', category: 'course', color: '#6366f1', icon: '🧮' },
  { name: 'calculus', category: 'course', color: '#6366f1', icon: '∫' },
  { name: 'linear-algebra', category: 'course', color: '#8b5cf6', icon: '📐' },
  { name: 'geometry', category: 'course', color: '#8b5cf6', icon: '📏' },
  { name: 'statistics', category: 'course', color: '#06b6d4', icon: '📊' },
  { name: 'number-theory', category: 'course', color: '#0ea5e9', icon: '#️⃣' },
  { name: 'python', category: 'tech-stack', color: '#3b82f6', icon: '🐍' },
  { name: 'typescript', category: 'tech-stack', color: '#3b82f6', icon: '🔷' },
  { name: 'julia', category: 'tech-stack', color: '#22c55e', icon: '⬤' },
  { name: 'r', category: 'tech-stack', color: '#22c55e', icon: '📈' },
  { name: 'competitive-programming', category: 'interest', color: '#f59e0b', icon: '🏆' },
  { name: 'machine-learning', category: 'interest', color: '#ec4899', icon: '🧠' },
  { name: 'data-visualisation', category: 'interest', color: '#f43f5e', icon: '📉' },
  { name: 'pure-mathematics', category: 'interest', color: '#a855f7', icon: '∑' },
  { name: 'olympiad', category: 'interest', color: '#f59e0b', icon: '🥇' },
  { name: 'latex', category: 'tech-stack', color: '#64748b', icon: '📜' },
  { name: 'matlab', category: 'tech-stack', color: '#64748b', icon: '🔢' },
  { name: 'group-theory', category: 'course', color: '#6366f1', icon: '🔗' },
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
    handle: 'ada_math',
    email: 'ada@cs.uni.edu',
    role: 'senior',
    semester: 8,
    password: 'TestPassword123!',
    socialName: 'Ada',
    isDiscoverable: true,
  },
  {
    handle: 'grace_curves',
    email: 'grace@cs.uni.edu',
    role: 'senior',
    semester: 7,
    password: 'TestPassword123!',
    socialName: 'Grace',
    isDiscoverable: true,
  },
  {
    handle: 'alan_loops',
    email: 'alan@cs.uni.edu',
    role: 'senior',
    semester: 2,
    password: 'TestPassword123!',
    socialName: 'Alan',
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
