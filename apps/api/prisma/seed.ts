/**
 * Starter data for a fresh database: an organisation, two logins and some tasks. This is
 * real data committed to the database, not a mock: the app reads it back through the API
 * like anything else (brief: "all modifications must be committed to a remote database").
 *
 * Passwords come from the environment so none is ever committed:
 *   SEED_ADMIN_PASSWORD, SEED_VIEWER_PASSWORD
 *
 * Runs once: if any employee exists, it does nothing. Use `pnpm db:reset` to start again.
 * Writes are made without `app.current_user_id`, so the audit trail attributes them to the
 * system (ADR-0011).
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/auth/password.js';
import { PrismaClient, type TaskStatus } from '../src/generated/prisma/client.js';

try {
  process.loadEnvFile('.env');
} catch {
  // Use the process environment.
}

const { DATABASE_URL, SEED_ADMIN_PASSWORD, SEED_VIEWER_PASSWORD } = process.env;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required.');
if (!SEED_ADMIN_PASSWORD || SEED_ADMIN_PASSWORD.length < 12) {
  throw new Error('Set SEED_ADMIN_PASSWORD (12+ characters) before seeding.');
}
if (!SEED_VIEWER_PASSWORD || SEED_VIEWER_PASSWORD.length < 12) {
  throw new Error('Set SEED_VIEWER_PASSWORD (12+ characters) before seeding.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

// [number, first, last, position, manager number, salary, birth date]
type Row = [string, string, string, string, string | null, number, string];
const employees: Row[] = [
  ['E-0001', 'Thandi', 'Nkosi', 'Chief Executive Officer', null, 3_250_000, '1971-03-14'],
  ['E-0004', 'Pieter', 'van Wyk', 'Chief Technology Officer', 'E-0001', 2_480_000, '1976-08-02'],
  ['E-0005', 'Lerato', 'Dlamini', 'Chief Financial Officer', 'E-0001', 2_410_000, '1979-11-21'],
  ['E-0007', 'Naledi', 'Mokoena', 'Head of People', 'E-0001', 1_620_000, '1983-05-09'],
  ['E-0019', 'Aisha', 'Patel', 'Engineering Manager', 'E-0004', 1_340_000, '1986-01-30'],
  ['E-0021', 'Ruan', 'Pretorius', 'Engineering Manager', 'E-0004', 1_310_000, '1985-07-17'],
  ['E-0042', 'Johan', 'Botha', 'Senior Software Developer', 'E-0019', 960_000, '1990-04-03'],
  ['E-0043', 'Zanele', 'Khumalo', 'Software Developer', 'E-0019', 720_000, '1995-09-12'],
  ['E-0051', 'Kagiso', 'Molefe', 'Software Developer', 'E-0021', 705_000, '1996-02-25'],
  ['E-0052', 'Megan', 'Fourie', 'QA Engineer', 'E-0021', 640_000, '1993-12-08'],
  ['E-0030', 'Sipho', 'Ndlovu', 'Financial Controller', 'E-0005', 1_080_000, '1984-06-19'],
  ['E-0034', 'Chloe', 'Naidoo', 'Accountant', 'E-0030', 580_000, '1994-10-01'],
  ['E-0038', 'Bongani', 'Zulu', 'Payroll Specialist', 'E-0030', 520_000, '1991-03-27'],
  ['E-0060', 'Fatima', 'Abrahams', 'Talent Partner', 'E-0007', 610_000, '1992-08-15'],
  ['E-0061', 'David', 'Smit', 'HR Administrator', 'E-0007', 430_000, '1998-05-22'],
];

// [employee number, title, status, due date]
const tasks: [string, string, TaskStatus, string | null][] = [
  ['E-0001', 'Approve FY27 headcount plan', 'in_progress', '2026-10-24'],
  ['E-0004', 'Sign off Q4 engineering roadmap', 'in_progress', '2026-10-21'],
  ['E-0004', 'Review cloud cost report with Finance', 'todo', '2026-10-23'],
  ['E-0004', 'Quarterly architecture review', 'done', '2026-10-14'],
  ['E-0019', 'One-on-ones with Johan and Zanele', 'in_progress', '2026-10-22'],
  ['E-0019', 'Write onboarding guide for new developers', 'todo', '2026-11-01'],
  ['E-0021', 'Migrate CI pipelines to new runners', 'in_progress', '2026-10-28'],
  ['E-0021', 'Define QA regression checklist', 'todo', '2026-10-24'],
  ['E-0042', 'Refactor reporting-line service', 'in_progress', '2026-10-23'],
  ['E-0043', 'Build org chart search', 'in_progress', '2026-10-22'],
];

const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const email = (first: string, last: string) =>
  `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + '@example.com';

async function main() {
  if ((await prisma.employee.count()) > 0) {
    console.warn('Employees already exist; skipping seed. Run `pnpm db:reset` to start over.');
    return;
  }

  const ids = new Map<string, string>();
  // Rows are ordered managers-first, so each manager exists before their reports.
  for (const [number, first, last, position, managerNumber, salary, birthDate] of employees) {
    const created = await prisma.employee.create({
      data: {
        employeeNumber: number,
        firstName: first,
        lastName: last,
        email: email(first, last),
        position,
        salary,
        birthDate: date(birthDate),
        managerId: managerNumber ? ids.get(managerNumber)! : null,
      },
    });
    ids.set(number, created.id);
  }

  await prisma.user.create({
    data: {
      email: 'admin@example.com',
      passwordHash: await hashPassword(SEED_ADMIN_PASSWORD!),
      role: 'ADMIN',
      employeeId: ids.get('E-0004')!,
    },
  });
  await prisma.user.create({
    data: {
      email: 'viewer@example.com',
      passwordHash: await hashPassword(SEED_VIEWER_PASSWORD!),
      role: 'VIEWER',
      employeeId: ids.get('E-0019')!,
    },
  });

  await prisma.task.createMany({
    data: tasks.map(([number, title, status, due]) => ({
      employeeId: ids.get(number)!,
      title,
      status,
      dueDate: due ? date(due) : null,
    })),
  });

  console.warn(
    `Seeded ${employees.length} employees, 2 logins (admin@example.com, viewer@example.com) and ${tasks.length} tasks.`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
