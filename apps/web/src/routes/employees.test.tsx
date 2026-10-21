import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Employee } from '@/features/employees/types';
import { EmployeesTable } from './employees';

let isAdmin = true;
vi.mock('@/features/auth/session', () => ({ useIsAdmin: () => isAdmin }));

function employee(
  n: number,
  firstName: string,
  birthDate: string,
  salary: number | null,
): Employee {
  return {
    id: `00000000-0000-4000-8000-00000000000${n}`,
    employeeNumber: `E-000${n}`,
    firstName,
    lastName: 'Test',
    email: `${firstName.toLowerCase()}@example.com`,
    birthDate,
    salary,
    position: 'Developer',
    managerId: null,
    manager: null,
    directReportCount: 0,
    avatarUrl: null,
    hasUploadedAvatar: false,
  };
}

const staff = [
  employee(1, 'Amahle', '1985-03-14', 950_000),
  employee(2, 'Bongani', '1992-07-01', 620_000),
  employee(3, 'Carla', '1999-11-30', 410_000),
];

const shownNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).queryByText(/ Test$/)?.textContent)
    .filter(Boolean);

describe('EmployeesTable range filters', () => {
  beforeEach(() => {
    isAdmin = true;
  });

  it('filters by a birth date range, inclusive at both ends', async () => {
    render(<EmployeesTable employees={staff} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filter by birth date' }));
    fireEvent.change(screen.getByLabelText('Birth date from'), {
      target: { value: '1990-01-01' },
    });
    fireEvent.change(screen.getByLabelText('Birth date to'), { target: { value: '1999-11-30' } });

    expect(shownNames()).toEqual(['Bongani Test', 'Carla Test']);
    expect(screen.getByText('2 of 3 employees')).toBeVisible();
  });

  it('filters by salary with an open upper end', async () => {
    render(<EmployeesTable employees={staff} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filter by salary' }));
    fireEvent.change(screen.getByLabelText('Salary from'), { target: { value: '600000' } });

    expect(shownNames()).toEqual(['Amahle Test', 'Bongani Test']);
  });

  it('clears the range filters along with the others', async () => {
    render(<EmployeesTable employees={staff} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filter by salary' }));
    fireEvent.change(screen.getByLabelText('Salary to'), { target: { value: '500000' } });
    expect(shownNames()).toEqual(['Carla Test']);

    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(shownNames()).toHaveLength(3);
  });

  it('offers no salary filter to a viewer, whose salaries are masked', () => {
    isAdmin = false;
    render(<EmployeesTable employees={staff.map((e) => ({ ...e, salary: null }))} />);

    expect(screen.getByRole('button', { name: 'Filter by birth date' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Filter by salary' })).not.toBeInTheDocument();
  });
});

describe('EmployeesTable text filters, search and name sorting', () => {
  const people = [
    {
      ...employee(1, 'Amahle', '1985-03-14', 1),
      lastName: 'Zulu',
      position: 'Engineering Manager',
    },
    { ...employee(2, 'Bongani', '1992-07-01', 1), lastName: 'Mokoena', email: 'bm@corp.co.za' },
    { ...employee(3, 'Carla', '1999-11-30', 1), lastName: 'Adams' },
  ];
  const names = () =>
    screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelector('.font-medium')?.textContent)
      .filter(Boolean);

  beforeEach(() => {
    isAdmin = true;
  });

  it('searches email, which only shows under the name', async () => {
    render(<EmployeesTable employees={people} />);
    await userEvent.type(screen.getByLabelText('Search employees'), 'corp.co.za');
    expect(names()).toEqual(['Bongani Mokoena']);
  });

  it('needs every searched word to match, each in any field', async () => {
    render(<EmployeesTable employees={people} />);
    await userEvent.type(screen.getByLabelText('Search employees'), 'amahle manager');
    expect(names()).toEqual(['Amahle Zulu']);
    await userEvent.type(screen.getByLabelText('Search employees'), ' nobody');
    expect(names()).toEqual([]);
  });

  it('filters on surname, employee number and email separately', async () => {
    render(<EmployeesTable employees={people} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filter by name, number or email' }));

    fireEvent.change(screen.getByLabelText('Surname contains'), { target: { value: 'mok' } });
    expect(names()).toEqual(['Bongani Mokoena']);
    expect(
      screen.getByRole('button', { name: 'Filter by name, number or email' }),
    ).toHaveTextContent('Details (1)');

    fireEvent.change(screen.getByLabelText('Surname contains'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Employee number contains'), {
      target: { value: '0003' },
    });
    expect(names()).toEqual(['Carla Adams']);

    fireEvent.change(screen.getByLabelText('Employee number contains'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Email contains'), { target: { value: 'amahle@' } });
    expect(names()).toEqual(['Amahle Zulu']);
  });

  it('sorts by first name by default, and by surname on request', async () => {
    render(<EmployeesTable employees={people} />);
    expect(names()).toEqual(['Amahle Zulu', 'Bongani Mokoena', 'Carla Adams']);

    await userEvent.click(screen.getByRole('button', { name: 'Surname' }));
    expect(names()).toEqual(['Carla Adams', 'Bongani Mokoena', 'Amahle Zulu']);
  });

  it('never shows the columns that exist only for filtering', () => {
    render(<EmployeesTable employees={people} />);
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual([
      'First nameSurname',
      'Number',
      'Role',
      'Manager',
      'Birth date',
      'Salary',
      'Actions',
    ]);
  });
});
