import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ---- Create admin user ----
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@aklms.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@AK2024!';
  const adminName = process.env.ADMIN_NAME || 'Platform Admin';

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  
  if (!existingAdmin) {
    const passwordHash = await argon2.hash(adminPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await prisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        passwordHash,
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log(`✅ Admin account created: ${adminEmail}`);
  } else {
    console.log(`ℹ️  Admin account already exists: ${adminEmail}`);
  }

  // ---- Create default categories ----
  const categories = [
    { name: 'Web Development', slug: 'web-development', color: '#3B82F6', description: 'Build modern web applications' },
    { name: 'Mobile Development', slug: 'mobile-development', color: '#8B5CF6', description: 'Create mobile apps for iOS and Android' },
    { name: 'Data Science', slug: 'data-science', color: '#10B981', description: 'Analyze data and build ML models' },
    { name: 'Digital Marketing', slug: 'digital-marketing', color: '#F59E0B', description: 'Master online marketing strategies' },
    { name: 'Graphic Design', slug: 'graphic-design', color: '#EF4444', description: 'Create stunning visual designs' },
    { name: 'Business', slug: 'business', color: '#6366F1', description: 'Develop business and entrepreneurship skills' },
  ];

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    await prisma.category.upsert({
      where: { slug: cat.slug },
      create: { ...cat, order: i },
      update: { color: cat.color, description: cat.description },
    });
  }
  console.log(`✅ ${categories.length} categories seeded`);

  // ---- Create platform settings ----
  const settings = [
    { key: 'platform_name', value: 'AK Learning', description: 'Platform display name' },
    { key: 'platform_tagline', value: 'Master Your Skills, Transform Your Future', description: 'Platform tagline' },
    { key: 'upi_id', value: 'admin@upi', description: 'UPI ID for payments' },
    { key: 'upi_display_name', value: 'AK Learning Platform', description: 'UPI display name' },
    { key: 'support_email', value: adminEmail, description: 'Support email address' },
  ];

  for (const setting of settings) {
    await prisma.platformSettings.upsert({
      where: { key: setting.key },
      create: setting,
      update: {},
    });
  }
  console.log(`✅ Platform settings initialized`);

  console.log('\n🎉 Seed completed successfully!');
  console.log(`\n📧 Admin login: ${adminEmail}`);
  console.log(`🔑 Admin password: ${adminPassword}`);
  console.log(`\n⚠️  IMPORTANT: Change the admin password after first login!`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
