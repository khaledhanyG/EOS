
import { Employee, ESBCalculation, TerminationReason, EmployeeStatus, ServiceBreakdown } from '../types';

export const getSalaryAtDate = (employee: Employee, targetDate: Date): number => {
  const dateStr = targetDate.toISOString().split('T')[0];
  const sortedHistory = [...(employee.salaryHistory || [])].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // If there is no history, use current salary
  if (sortedHistory.length === 0) {
    return employee.basicSalary + employee.housingAllowance + employee.transportAllowance + employee.otherAllowances;
  }

  // If target date is AFTER the latest history entry, use current salary (Manual Edit Override)
  // This assumes manual edits in the "Edit" form represent the most current state, 
  // replacing the last history entry for current/future calculations.
  const latestHistoryDate = sortedHistory[0].date;
  if (dateStr >= latestHistoryDate) {
    return employee.basicSalary + employee.housingAllowance + employee.transportAllowance + employee.otherAllowances;
  }

  // Otherwise (calculating for a past date), find the applicable history entry
  const applicableEntry = sortedHistory.find(entry => entry.date <= dateStr);
  if (applicableEntry) return applicableEntry.total;

  // Fallback if date is older than all history (should rarely happen if history starts at hire date)
  return employee.basicSalary + employee.housingAllowance + employee.transportAllowance + employee.otherAllowances;
};

export const calculateServiceBreakdown = (hireDate: string, endDate: Date = new Date()): ServiceBreakdown => {
  const start = new Date(hireDate);
  const end = new Date(endDate);

  const y1 = start.getFullYear();
  const m1 = start.getMonth();
  const d1 = start.getDate();
  const y2 = end.getFullYear();
  const m2 = end.getMonth();
  const d2 = end.getDate();

  const isLastDayOfMonth = (date: Date) => {
    const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return date.getDate() === d.getDate();
  };

  // 30/360 Rule adjustment
  // Treat 31st and last day of Feb as 30th
  let d1_adj = d1;
  if (d1 === 31 || isLastDayOfMonth(start)) d1_adj = 30;

  let d2_adj = d2;
  if (d2 === 31 || isLastDayOfMonth(end)) d2_adj = 30;

  // The "+ 1" makes the calculation inclusive of both start and end days
  const totalDays = ((y2 - y1) * 360) + ((m2 - m1) * 30) + (d2_adj - d1_adj) + 1;

  if (totalDays <= 0) return { years: 0, months: 0, days: 0 };

  const years = Math.floor(totalDays / 360);
  const months = Math.floor((totalDays % 360) / 30);
  const days = (totalDays % 30) + 1; // User requested +1 to the calculated days

  return { years, months, days };
};

export const calculateESBFromValues = (
  totalMonthlySalary: number,
  years: number,
  months: number,
  days: number,
  terminationReason?: TerminationReason
): { accruedBenefit: number, totalServiceYears: number, reductionRatio: number } => {
  const totalServiceDays = (years * 360) + (months * 30) + days;
  const totalServiceYears = totalServiceDays / 360;
  let accruedBenefit = 0;
  let reductionRatio = 1.0;

  // First 5 years: Half month salary for each year
  // After 5 years: Full month salary for each year
  if (totalServiceYears <= 5) {
    accruedBenefit = totalServiceYears * (totalMonthlySalary / 2);
  } else {
    const firstFiveYearsBenefit = 5 * (totalMonthlySalary / 2);
    const remainingYearsBenefit = (totalServiceYears - 5) * totalMonthlySalary;
    accruedBenefit = firstFiveYearsBenefit + remainingYearsBenefit;
  }

  // Reduction based on Article 85 (Resignation)
  if (terminationReason === TerminationReason.RESIGNATION) {
    if (totalServiceYears < 2) reductionRatio = 0;
    else if (totalServiceYears >= 2 && totalServiceYears < 5) reductionRatio = 1 / 3;
    else if (totalServiceYears >= 5 && totalServiceYears < 10) reductionRatio = 2 / 3;
    else reductionRatio = 1;
    accruedBenefit = accruedBenefit * reductionRatio;
  }

  return { accruedBenefit: Math.max(0, accruedBenefit), totalServiceYears, reductionRatio };
};

export const calculateESB = (employee: Employee, targetDate: Date = new Date()): ESBCalculation & { breakdown: ServiceBreakdown } => {
  const effectiveEndDate = employee.status === EmployeeStatus.TERMINATED && employee.terminationDate
    ? new Date(employee.terminationDate)
    : targetDate;

  const totalMonthlySalary = getSalaryAtDate(employee, effectiveEndDate);
  const breakdown = employee.manualServiceBreakdown || calculateServiceBreakdown(employee.hireDate, effectiveEndDate);

  const { accruedBenefit, totalServiceYears, reductionRatio } = calculateESBFromValues(
    totalMonthlySalary,
    breakdown.years,
    breakdown.months,
    breakdown.days,
    employee.terminationReason
  );

  const monthlyProvision = employee.status === EmployeeStatus.ACTIVE
    ? (totalServiceYears < 5 ? totalMonthlySalary / 24 : totalMonthlySalary / 12)
    : 0;

  const totalLiabilityBeforePayout = (employee.openingBalance || 0) + accruedBenefit;
  const paid = employee.payoutAmount || 0;

  return {
    employeeId: employee.id,
    totalServiceDays: Math.round(totalServiceYears * 360),
    totalServiceYears,
    accruedBenefit,
    monthlyProvision,
    totalLiability: totalLiabilityBeforePayout,
    reductionRatio,
    breakdown,
    remainingLiability: Math.max(0, totalLiabilityBeforePayout - paid)
  };
};
