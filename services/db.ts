import { neon } from '@neondatabase/serverless';
import { Employee, SalaryHistoryEntry, EmployeeStatus, User, UserRole, Organization } from '../types';

const connectionString = process.env.DATABASE_URL || "";

if (!connectionString) {
  console.error("DATABASE_URL is not defined!");
}

const sql = neon(connectionString);

// Helper to format Date objects to YYYY-MM-DD using Local Time
// Fixes issue where toISOString() shifts date back by 1 day for UTC+ timezones
const toLocDate = (date: any): string => {
  if (date instanceof Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return date;
};

export const initDatabase = async () => {
  try {
    // 1. Create Organizations table
    await sql(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tax_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Create or Update Users table
    await sql(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL,
        view_dashboard BOOLEAN DEFAULT TRUE,
        view_employees BOOLEAN DEFAULT TRUE,
        view_reports BOOLEAN DEFAULT TRUE,
        can_edit BOOLEAN DEFAULT TRUE
      )
    `);

    // Migration for Users table (if columns missing)
    await sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS view_dashboard BOOLEAN DEFAULT TRUE`);
    await sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS view_employees BOOLEAN DEFAULT TRUE`);
    await sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS view_reports BOOLEAN DEFAULT TRUE`);
    await sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit BOOLEAN DEFAULT TRUE`);

    // 3. Create or Update Employees table
    await sql(`
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        employee_number TEXT,
        name TEXT NOT NULL,
        job_title TEXT,
        hire_date DATE NOT NULL,
        contract_end_date DATE,
        termination_date DATE,
        termination_reason TEXT,
        basic_salary NUMERIC DEFAULT 0,
        housing_allowance NUMERIC DEFAULT 0,
        transport_allowance NUMERIC DEFAULT 0,
        other_allowances NUMERIC DEFAULT 0,
        opening_balance NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'ACTIVE',
        manual_service_breakdown JSONB,
        payout_amount NUMERIC DEFAULT 0,
        payout_date DATE
      )
    `);

    // CRITICAL: Ensure organization_id exists (Migration step)
    await sql(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE`);
    await sql(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS payout_amount NUMERIC DEFAULT 0`);
    await sql(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS payout_date DATE`);

    // 4. User Organizations junction table
    await sql(`
      CREATE TABLE IF NOT EXISTS user_organizations (
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, org_id)
      )
    `);

    // 5. Salary History table
    await sql(`
      CREATE TABLE IF NOT EXISTS salary_history (
        id SERIAL PRIMARY KEY,
        employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        basic_salary NUMERIC,
        housing_allowance NUMERIC,
        transport_allowance NUMERIC,
        other_allowances NUMERIC,
        total NUMERIC,
        reason TEXT
      )
    `);

    // Ensure Default Organization exists for initial migration
    const orgCheck = await sql`SELECT * FROM organizations LIMIT 1`;
    let defaultOrgId = '';
    if (orgCheck.length === 0) {
      defaultOrgId = crypto.randomUUID();
      await sql`INSERT INTO organizations (id, name) VALUES (${defaultOrgId}, 'Default Establishment')`;
    } else {
      defaultOrgId = orgCheck[0].id;
    }

    // Ensure Admin user exists
    const adminCheck = await sql`SELECT * FROM users WHERE username = 'Admin'`;
    let adminId = '';
    if (adminCheck.length === 0) {
      adminId = crypto.randomUUID();
      await sql`
        INSERT INTO users (id, username, password, display_name, role, view_dashboard, view_employees, view_reports, can_edit)
        VALUES (${adminId}, 'Admin', '123456', 'Administrator', 'ADMIN', TRUE, TRUE, TRUE, TRUE)
      `;
    } else {
      adminId = adminCheck[0].id;
      await sql`UPDATE users SET can_edit = TRUE, role = 'ADMIN' WHERE id = ${adminId}`;
    }

    // Link Admin to Default Organization if not linked
    const linkCheck = await sql`SELECT * FROM user_organizations WHERE user_id = ${adminId} AND org_id = ${defaultOrgId}`;
    if (linkCheck.length === 0) {
      await sql`INSERT INTO user_organizations (user_id, org_id) VALUES (${adminId}, ${defaultOrgId})`;
    }

    // Migrate existing employees if they have no org_id
    await sql`UPDATE employees SET organization_id = ${defaultOrgId} WHERE organization_id IS NULL`;

  } catch (error) {
    console.error("Database initialization failed:", error);
  }
};

export const fetchOrganizations = async (): Promise<Organization[]> => {
  const rows = await sql`SELECT * FROM organizations ORDER BY name ASC`;
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    taxId: r.tax_id,
    createdAt: r.created_at
  }));
};

export const fetchUserOrganizations = async (userId: string): Promise<Organization[]> => {
  const rows = await sql`
    SELECT o.* FROM organizations o
    JOIN user_organizations uo ON o.id = uo.org_id
    WHERE uo.user_id = ${userId}
    ORDER BY o.name ASC
  `;
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    taxId: r.tax_id
  }));
};

export const dbAddOrganization = async (org: Organization) => {
  await sql`INSERT INTO organizations (id, name, tax_id) VALUES (${org.id}, ${org.name}, ${org.taxId || null})`;
};

export const dbUpdateOrganization = async (id: string, org: Partial<Organization>) => {
  const fields: string[] = [];
  const values: any[] = [];
  let i = 1;

  if (org.name !== undefined) {
    fields.push(`name = $${i++}`);
    values.push(org.name);
  }
  if (org.taxId !== undefined) {
    fields.push(`tax_id = $${i++}`);
    values.push(org.taxId);
  }

  if (fields.length > 0) {
    values.push(id);
    await sql(`UPDATE organizations SET ${fields.join(', ')} WHERE id = $${i}`, values);
  }
};

export const dbLinkUserToOrg = async (userId: string, orgId: string) => {
  await sql`INSERT INTO user_organizations (user_id, org_id) VALUES (${userId}, ${orgId}) ON CONFLICT DO NOTHING`;
};

export const loginUser = async (username: string, password: string): Promise<User | null> => {
  try {
    const rows = await sql`SELECT * FROM users WHERE username = ${username} AND password = ${password}`;
    if (rows.length === 0) return null;
    const row = rows[0];

    // Fetch orgs user can access
    const orgs = await sql`SELECT org_id FROM user_organizations WHERE user_id = ${row.id}`;

    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role as UserRole,
      permissions: {
        viewDashboard: row.view_dashboard,
        viewEmployees: row.view_employees,
        viewReports: row.view_reports,
        canEdit: row.can_edit,
        accessibleOrganizations: orgs.map(o => o.org_id)
      }
    };
  } catch (error) {
    return null;
  }
};

export const fetchUsers = async (): Promise<User[]> => {
  const rows = await sql`SELECT * FROM users ORDER BY role ASC, username ASC`;
  const users: User[] = [];
  for (const row of rows) {
    const orgs = await sql`SELECT org_id FROM user_organizations WHERE user_id = ${row.id}`;
    users.push({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role as UserRole,
      permissions: {
        viewDashboard: row.view_dashboard,
        viewEmployees: row.view_employees,
        viewReports: row.view_reports,
        canEdit: row.can_edit,
        accessibleOrganizations: orgs.map(o => o.org_id)
      }
    });
  }
  return users;
};

export const dbUpsertUser = async (user: User) => {
  const existing = await sql`SELECT id FROM users WHERE id = ${user.id}`;
  if (existing.length > 0) {
    if (user.password) {
      await sql`UPDATE users SET username=${user.username}, password=${user.password}, display_name=${user.displayName}, role=${user.role}, view_dashboard=${user.permissions.viewDashboard}, view_employees=${user.permissions.viewEmployees}, view_reports=${user.permissions.viewReports}, can_edit=${user.permissions.canEdit} WHERE id=${user.id}`;
    } else {
      await sql`UPDATE users SET username=${user.username}, display_name=${user.displayName}, role=${user.role}, view_dashboard=${user.permissions.viewDashboard}, view_employees=${user.permissions.viewEmployees}, view_reports=${user.permissions.viewReports}, can_edit=${user.permissions.canEdit} WHERE id=${user.id}`;
    }
  } else {
    await sql`INSERT INTO users (id, username, password, display_name, role, view_dashboard, view_employees, view_reports, can_edit) VALUES (${user.id}, ${user.username}, ${user.password || '123456'}, ${user.displayName}, ${user.role}, ${user.permissions.viewDashboard}, ${user.permissions.viewEmployees}, ${user.permissions.viewReports}, ${user.permissions.canEdit})`;
  }

  // Update org links
  if (user.permissions.accessibleOrganizations) {
    await sql`DELETE FROM user_organizations WHERE user_id = ${user.id}`;
    for (const orgId of user.permissions.accessibleOrganizations) {
      await sql`INSERT INTO user_organizations (user_id, org_id) VALUES (${user.id}, ${orgId})`;
    }
  }
};

export const fetchEmployees = async (orgId: string): Promise<Employee[]> => {
  try {
    const emps = await sql`SELECT * FROM employees WHERE organization_id = ${orgId} ORDER BY name ASC`;
    const histories = await sql`
      SELECT h.* FROM salary_history h
      JOIN employees e ON h.employee_id = e.id
      WHERE e.organization_id = ${orgId}
      ORDER BY h.date ASC
    `;

    return emps.map((row: any) => ({
      id: row.id,
      organizationId: row.organization_id,
      employeeNumber: row.employee_number,
      name: row.name,
      jobTitle: row.job_title,
      hireDate: toLocDate(row.hire_date),
      contractEndDate: row.contract_end_date ? toLocDate(row.contract_end_date) : undefined,
      terminationDate: row.termination_date ? toLocDate(row.termination_date) : undefined,
      terminationReason: row.termination_reason,
      basicSalary: parseFloat(row.basic_salary || 0),
      housingAllowance: parseFloat(row.housing_allowance || 0),
      transportAllowance: parseFloat(row.transport_allowance || 0),
      otherAllowances: parseFloat(row.other_allowances || 0),
      openingBalance: parseFloat(row.opening_balance || 0),
      status: row.status as EmployeeStatus,
      manualServiceBreakdown: row.manual_service_breakdown,
      payoutAmount: parseFloat(row.payout_amount || 0),
      payoutDate: row.payout_date ? toLocDate(row.payout_date) : undefined,
      salaryHistory: histories
        .filter((h: any) => h.employee_id === row.id)
        .map((h: any) => ({
          date: toLocDate(h.date),
          basicSalary: parseFloat(h.basic_salary || 0),
          housingAllowance: parseFloat(h.housing_allowance || 0),
          transportAllowance: parseFloat(h.transport_allowance || 0),
          otherAllowances: parseFloat(h.other_allowances || 0),
          total: parseFloat(h.total || 0),
          reason: h.reason
        }))
    }));
  } catch (error) {
    console.error("Failed to fetch employees:", error);
    return [];
  }
};

export const dbAddEmployee = async (emp: Employee) => {
  const basic = isNaN(emp.basicSalary) ? 0 : emp.basicSalary;
  const housing = isNaN(emp.housingAllowance) ? 0 : emp.housingAllowance;
  const transport = isNaN(emp.transportAllowance) ? 0 : emp.transportAllowance;
  const other = isNaN(emp.otherAllowances) ? 0 : emp.otherAllowances;
  const opening = isNaN(emp.openingBalance) ? 0 : emp.openingBalance;
  const payout = isNaN(emp.payoutAmount || 0) ? 0 : (emp.payoutAmount || 0);

  await sql`
    INSERT INTO employees (
      id, organization_id, employee_number, name, job_title, hire_date, contract_end_date, 
      basic_salary, housing_allowance, transport_allowance, other_allowances, 
      opening_balance, status, payout_amount, payout_date
    )
    VALUES (
      ${emp.id}, ${emp.organizationId}, ${emp.employeeNumber}, ${emp.name}, ${emp.jobTitle}, ${emp.hireDate}, ${emp.contractEndDate || null}, 
      ${basic}, ${housing}, ${transport}, ${other}, 
      ${opening}, ${emp.status}, ${payout}, ${emp.payoutDate || null}
    )
  `;

  if (emp.salaryHistory && emp.salaryHistory.length > 0) {
    for (const h of emp.salaryHistory) {
      const hTotal = isNaN(h.total) ? 0 : h.total;
      await sql`
        INSERT INTO salary_history (
          employee_id, date, basic_salary, housing_allowance, transport_allowance, other_allowances, total, reason
        ) 
        VALUES (
          ${emp.id}, ${h.date}, ${h.basicSalary || 0}, ${h.housingAllowance || 0}, ${h.transportAllowance || 0}, ${h.otherAllowances || 0}, ${hTotal}, ${h.reason || null}
        )
      `;
    }
  }
};

export const dbUpdateEmployee = async (id: string, updatedEmp: Partial<Employee>) => {
  const fieldsToUpdate: any = {};
  if (updatedEmp.employeeNumber !== undefined) fieldsToUpdate.employee_number = updatedEmp.employeeNumber;
  if (updatedEmp.name !== undefined) fieldsToUpdate.name = updatedEmp.name;
  if (updatedEmp.jobTitle !== undefined) fieldsToUpdate.job_title = updatedEmp.jobTitle;
  if (updatedEmp.hireDate !== undefined) fieldsToUpdate.hire_date = updatedEmp.hireDate;
  if (updatedEmp.contractEndDate !== undefined) fieldsToUpdate.contract_end_date = updatedEmp.contractEndDate;
  if (updatedEmp.terminationDate !== undefined) fieldsToUpdate.termination_date = updatedEmp.terminationDate;
  if (updatedEmp.terminationReason !== undefined) fieldsToUpdate.termination_reason = updatedEmp.terminationReason;
  if (updatedEmp.basicSalary !== undefined) fieldsToUpdate.basic_salary = updatedEmp.basicSalary;
  if (updatedEmp.housingAllowance !== undefined) fieldsToUpdate.housing_allowance = updatedEmp.housingAllowance;
  if (updatedEmp.transportAllowance !== undefined) fieldsToUpdate.transport_allowance = updatedEmp.transportAllowance;
  if (updatedEmp.otherAllowances !== undefined) fieldsToUpdate.other_allowances = updatedEmp.otherAllowances;
  if (updatedEmp.openingBalance !== undefined) fieldsToUpdate.opening_balance = updatedEmp.openingBalance;
  if (updatedEmp.status !== undefined) fieldsToUpdate.status = updatedEmp.status;
  if (updatedEmp.manualServiceBreakdown !== undefined) fieldsToUpdate.manual_service_breakdown = updatedEmp.manualServiceBreakdown;
  if (updatedEmp.payoutAmount !== undefined) fieldsToUpdate.payout_amount = updatedEmp.payoutAmount;
  if (updatedEmp.payoutDate !== undefined) fieldsToUpdate.payout_date = updatedEmp.payoutDate;

  const keys = Object.keys(fieldsToUpdate);
  if (keys.length > 0) {
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = Object.values(fieldsToUpdate);
    await sql(`UPDATE employees SET ${setClause} WHERE id = $1`, [id, ...values]);
  }

  if (updatedEmp.salaryHistory) {
    await sql`DELETE FROM salary_history WHERE employee_id = ${id}`;
    for (const h of updatedEmp.salaryHistory) {
      const hTotal = isNaN(h.total) ? 0 : h.total;
      await sql`
        INSERT INTO salary_history (
          employee_id, date, basic_salary, housing_allowance, transport_allowance, other_allowances, total, reason
        ) 
        VALUES (
          ${id}, ${h.date}, ${h.basicSalary || 0}, ${h.housingAllowance || 0}, ${h.transportAllowance || 0}, ${h.otherAllowances || 0}, ${hTotal}, ${h.reason || null}
        )
      `;
    }
  }
};

export const dbDeleteEmployee = async (id: string) => {
  await sql`DELETE FROM employees WHERE id = ${id}`;
};

export const dbDeleteUser = async (id: string) => {
  await sql`DELETE FROM users WHERE id = ${id}`;
};

export const dbDeleteOrganization = async (id: string) => {
  await sql`DELETE FROM organizations WHERE id = ${id}`;
};
