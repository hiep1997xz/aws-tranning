import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db, closeDb } from '../config/db.js';
import { users } from './schema/index.js';

const SEED_EMAIL = process.env['SEED_EMAIL'] ?? 'admin@example.com';
const SEED_PASSWORD = process.env['SEED_PASSWORD'] ?? 'admin123456';
const SEED_NAME = process.env['SEED_NAME'] ?? 'Admin';

async function seed() {
  console.log('🌱 Seeding database...');

  const [existing] = await db.select().from(users).where(eq(users.email, SEED_EMAIL));

  if (existing) {
    console.log(`✓ User "${SEED_EMAIL}" already exists — skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  await db.insert(users).values({
    id: uuidv4(),
    email: SEED_EMAIL,
    passwordHash,
    name: SEED_NAME,
  });

  console.log(`✓ Created user: ${SEED_EMAIL} / ${SEED_PASSWORD}`);
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => closeDb());
