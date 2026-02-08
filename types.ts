
export type Language = 'en' | 'ar';

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  TERMINATED = 'TERMINATED'
}

export enum TerminationReason {
  RESIGNATION = 'RESIGNATION',
  MUTUAL_AGREEMENT = 'MUTUAL_AGREEMENT',
  TERMINATION_BY_EMPLOYER = 'TERMINATION_BY_EMPLOYER'
}

export type UserRole = 'ADMIN' | 'USER';

export interface Organization {
  id: string;
  name: string;
  taxId?: string;
  createdAt?: string;
}

export interface UserPermissions {
  viewDashboard: boolean;
  viewEmployees: boolean;
  viewReports: boolean;
  canEdit: boolean;
  accessibleOrganizations?: string[]; // IDs of organizations the user can access
}

export interface User {
  id: string;
  username: string;
  password?: string;
  displayName: string;
  role: UserRole;
  permissions: UserPermissions;
}

export interface SalaryHistoryEntry {
  date: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  total: number;
  reason?: string;
}

export interface ServiceBreakdown {
  years: number;
  months: number;
  days: number;
}

export interface Employee {
  id: string;
  organizationId: string; // Linked to Organization
  employeeNumber: string;
  name: string;
  jobTitle: string;
  hireDate: string;
  contractEndDate?: string;
  terminationDate?: string;
  terminationReason?: TerminationReason;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  openingBalance: number;
  status: EmployeeStatus;
  salaryHistory: SalaryHistoryEntry[];
  manualServiceBreakdown?: ServiceBreakdown;
  payoutAmount?: number;
  payoutDate?: string;
}

export interface ESBCalculation {
  employeeId: string;
  totalServiceDays: number;
  totalServiceYears: number;
  accruedBenefit: number;
  monthlyProvision: number;
  totalLiability: number;
  reductionRatio: number;
  remainingLiability: number;
}
