import { execSync } from 'child_process';
try {
  execSync('npx prisma db push', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/inventory_test?schema=public' }
  });
} catch (e) {
  console.error('Failed to run prisma db push', e);
}
