import type { AuditEntry, Employee, Task, TaskStatus } from '@/features/employees/types';

/**
 * DESIGN FIXTURES ONLY. The brief forbids mocked data in the submitted solution: every value
 * must come from the remote database. This folder exists so the UI can be reviewed before
 * the API lands, and is deleted when the TanStack Query hooks replace `mocks/store.ts`.
 */

const e = (
  id: string,
  employeeNumber: string,
  firstName: string,
  lastName: string,
  position: string,
  managerId: string | null,
  salary: number,
  birthDate: string,
): Employee => ({
  id,
  employeeNumber,
  firstName,
  lastName,
  email: `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, '') + '@example.com',
  birthDate,
  salary,
  position,
  managerId,
  avatarUrl: null,
});

export const employeeFixtures: Employee[] = [
  e('e01', 'E-0001', 'Thandi', 'Nkosi', 'Chief Executive Officer', null, 3_250_000, '1971-03-14'),
  e(
    'e02',
    'E-0004',
    'Pieter',
    'van Wyk',
    'Chief Technology Officer',
    'e01',
    2_480_000,
    '1976-08-02',
  ),
  e(
    'e03',
    'E-0005',
    'Lerato',
    'Dlamini',
    'Chief Financial Officer',
    'e01',
    2_410_000,
    '1979-11-21',
  ),
  e('e04', 'E-0007', 'Naledi', 'Mokoena', 'Head of People', 'e01', 1_620_000, '1983-05-09'),
  e('e05', 'E-0019', 'Aisha', 'Patel', 'Engineering Manager', 'e02', 1_340_000, '1986-01-30'),
  e('e06', 'E-0021', 'Ruan', 'Pretorius', 'Engineering Manager', 'e02', 1_310_000, '1985-07-17'),
  e('e07', 'E-0042', 'Johan', 'Botha', 'Senior Software Developer', 'e05', 960_000, '1990-04-03'),
  e('e08', 'E-0043', 'Zanele', 'Khumalo', 'Software Developer', 'e05', 720_000, '1995-09-12'),
  e('e09', 'E-0051', 'Kagiso', 'Molefe', 'Software Developer', 'e06', 705_000, '1996-02-25'),
  e('e10', 'E-0052', 'Megan', 'Fourie', 'QA Engineer', 'e06', 640_000, '1993-12-08'),
  e('e11', 'E-0030', 'Sipho', 'Ndlovu', 'Financial Controller', 'e03', 1_080_000, '1984-06-19'),
  e('e12', 'E-0034', 'Chloe', 'Naidoo', 'Accountant', 'e11', 580_000, '1994-10-01'),
  e('e13', 'E-0038', 'Bongani', 'Zulu', 'Payroll Specialist', 'e11', 520_000, '1991-03-27'),
  e('e14', 'E-0060', 'Fatima', 'Abrahams', 'Talent Partner', 'e04', 610_000, '1992-08-15'),
  e('e15', 'E-0061', 'David', 'Smit', 'HR Administrator', 'e04', 430_000, '1998-05-22'),
  // A second root, so the multiple-roots warning has something to show (ADR-0009).
  e('e16', 'E-0099', 'Kyle', 'Jacobs', 'Contract Data Analyst', null, 690_000, '1997-01-11'),
];

export const auditFixtures: AuditEntry[] = [
  {
    id: 8,
    employeeId: 'e16',
    employeeName: 'Kyle Jacobs',
    action: 'CREATE',
    changedBy: 'admin@example.com',
    changedAt: '2026-10-16T14:22:00Z',
    summary: 'Created with no reporting manager',
  },
  {
    id: 7,
    employeeId: 'e10',
    employeeName: 'Megan Fourie',
    action: 'REPARENT',
    changedBy: 'admin@example.com',
    changedAt: '2026-10-16T09:05:00Z',
    summary: 'Manager changed from Aisha Patel to Ruan Pretorius',
  },
  {
    id: 6,
    employeeId: 'e08',
    employeeName: 'Zanele Khumalo',
    action: 'UPDATE',
    changedBy: 'admin@example.com',
    changedAt: '2026-10-15T16:41:00Z',
    summary: 'Position changed from Junior Developer to Software Developer',
  },
  {
    id: 5,
    employeeId: 'e17',
    employeeName: 'Grace Mahlangu',
    action: 'DELETE',
    changedBy: 'admin@example.com',
    changedAt: '2026-10-14T11:12:00Z',
    summary: 'Deleted; 0 direct reports',
  },
  {
    id: 4,
    employeeId: 'e15',
    employeeName: 'David Smit',
    action: 'CREATE',
    changedBy: 'admin@example.com',
    changedAt: '2026-10-13T08:30:00Z',
    summary: 'Created reporting to Naledi Mokoena',
  },
  {
    id: 3,
    employeeId: 'e07',
    employeeName: 'Johan Botha',
    action: 'UPDATE',
    changedBy: 'admin@example.com',
    changedAt: '2026-10-12T13:02:00Z',
    summary: 'Salary updated',
  },
  {
    id: 2,
    employeeId: 'e02',
    employeeName: 'Pieter van Wyk',
    action: 'UPDATE',
    changedBy: null,
    changedAt: '2026-10-10T07:00:00Z',
    summary: 'Email updated by seed script',
  },
  {
    id: 1,
    employeeId: 'e01',
    employeeName: 'Thandi Nkosi',
    action: 'CREATE',
    changedBy: null,
    changedAt: '2026-10-10T06:58:00Z',
    summary: 'Created by seed script',
  },
];

/** The employee the signed-in admin account is linked to. A manager, so the team view has content. */
export const CURRENT_EMPLOYEE_ID = 'e02';

let taskSeq = 0;
const t = (employeeId: string, title: string, status: TaskStatus, dueDate: string | null): Task => ({
  id: `t${++taskSeq}`,
  employeeId,
  title,
  status,
  dueDate,
});

export const taskFixtures: Task[] = [
  t('e01', 'Approve FY27 headcount plan', 'in_progress', '2026-10-24'),
  t('e01', 'Board pack for November meeting', 'todo', '2026-11-05'),
  t('e02', 'Sign off Q4 engineering roadmap', 'in_progress', '2026-10-21'),
  t('e02', 'Review cloud cost report with Finance', 'todo', '2026-10-23'),
  t('e02', 'Interview panel: senior platform engineer', 'todo', '2026-10-20'),
  t('e02', 'Quarterly architecture review', 'done', '2026-10-14'),
  t('e03', 'Close September management accounts', 'done', '2026-10-10'),
  t('e03', 'Draft FY27 budget assumptions', 'in_progress', '2026-10-30'),
  t('e04', 'Launch mid-year performance reviews', 'in_progress', '2026-10-25'),
  t('e04', 'Update leave policy for 2027', 'todo', '2026-11-15'),
  t('e05', 'Plan sprint 42', 'done', '2026-10-13'),
  t('e05', 'One-on-ones with Johan and Zanele', 'in_progress', '2026-10-22'),
  t('e05', 'Write onboarding guide for new developers', 'todo', '2026-11-01'),
  t('e06', 'Migrate CI pipelines to new runners', 'in_progress', '2026-10-28'),
  t('e06', 'Define QA regression checklist', 'todo', '2026-10-24'),
  t('e07', 'Refactor reporting-line service', 'in_progress', '2026-10-23'),
  t('e07', 'Code review: audit trail triggers', 'todo', '2026-10-20'),
  t('e08', 'Build org chart search', 'in_progress', '2026-10-22'),
  t('e09', 'Fix CSV import encoding bug', 'todo', '2026-10-21'),
  t('e10', 'Regression test release 3.4', 'todo', '2026-10-27'),
  t('e11', 'Reconcile payroll control account', 'in_progress', '2026-10-23'),
  t('e14', 'Shortlist graduate intake candidates', 'todo', '2026-10-31'),
];
