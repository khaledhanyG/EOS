
import React, { useState, useMemo } from 'react';
import { Employee, Language, EmployeeStatus } from '../types';
import { calculateESB, getSalaryAtDate } from '../services/calculator';
import * as XLSX from 'xlsx';

interface ReportsProps {
  employees: Employee[];
  t: any;
  isRtl: boolean;
  language: Language;
}

const Reports: React.FC<ReportsProps> = ({ employees, t, isRtl, language }) => {
  const [reportType, setReportType] = useState<'cumulative' | 'monthly'>('cumulative');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  const years = useMemo(() => {
    const startYear = 2017;
    const currentYear = new Date().getFullYear() + 2;
    const arr = [];
    for (let i = startYear; i <= currentYear; i++) arr.push(i);
    return arr;
  }, []);

  const months = [
    { id: 0, en: "January", ar: "يناير" },
    { id: 1, en: "February", ar: "فبراير" },
    { id: 2, en: "March", ar: "مارس" },
    { id: 3, en: "April", ar: "أبريل" },
    { id: 4, en: "May", ar: "مايو" },
    { id: 5, en: "June", ar: "يونيو" },
    { id: 6, en: "July", ar: "يوليو" },
    { id: 7, en: "August", ar: "أغسطس" },
    { id: 8, en: "September", ar: "سبتمبر" },
    { id: 9, en: "October", ar: "أكتوبر" },
    { id: 10, en: "November", ar: "نوفمبر" },
    { id: 11, en: "December", ar: "ديسمبر" },
  ];

  const getProvisioningForMonth = (emp: Employee, year: number, month: number) => {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); // Last day of month
    const prevMonthEnd = new Date(year, month, 0); // Last day of prev month

    // ESB at end of this month
    const esbEnd = calculateESB(emp, endDate);
    // ESB at end of previous month
    const esbStart = calculateESB(emp, prevMonthEnd);

    const totalAccrual = esbEnd.totalLiability - esbStart.totalLiability;
    
    // Check if salary changed this month to separate "Standard Accrual" from "Adjustment Accrual"
    const salaryStart = getSalaryAtDate(emp, prevMonthEnd);
    const salaryEnd = getSalaryAtDate(emp, endDate);
    const hasSalaryChange = salaryStart !== salaryEnd;

    // Standard accrual is usually 1/24 or 1/12 of monthly salary
    // If salary changed, the bulk of the difference is the retroactive adjustment
    const standardAccrual = esbEnd.monthlyProvision;
    const adjustmentAccrual = totalAccrual - standardAccrual;

    return {
      totalAccrual,
      standardAccrual,
      adjustmentAccrual: Math.max(0, adjustmentAccrual),
      closingBalance: esbEnd.totalLiability,
      hasSalaryChange
    };
  };

  const getReportData = () => {
    if (reportType === 'cumulative') {
      return employees.map(emp => {
        const calc = calculateESB(emp);
        return {
          [t.employeeNumber]: emp.employeeNumber,
          [t.name]: emp.name,
          [t.status]: emp.status === EmployeeStatus.ACTIVE ? t.active : t.terminated,
          [t.hireDate]: emp.hireDate,
          [t.servicePeriod]: `${calc.breakdown.years}Y ${calc.breakdown.months}M`,
          [t.openingBalance]: emp.openingBalance.toFixed(2),
          [t.totalAccrued]: calc.accruedBenefit.toFixed(2),
          [t.totalLiability]: calc.totalLiability.toFixed(2)
        };
      });
    } else {
      return employees.map(emp => {
        const prov = getProvisioningForMonth(emp, selectedYear, selectedMonth);
        return {
          [t.name]: emp.name,
          [t.month]: months[selectedMonth][language],
          [t.standardAccrual]: prov.standardAccrual.toFixed(2),
          [t.salaryAdjustment]: prov.adjustmentAccrual.toFixed(2),
          [t.totalMonthlyProvision]: prov.totalAccrual.toFixed(2),
          [t.closingBalance]: prov.closingBalance.toFixed(2)
        };
      });
    }
  };

  const exportToExcel = () => {
    const data = getReportData();
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `ESB_Report_${selectedYear}_${selectedMonth + 1}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white p-6 rounded-xl shadow-sm border no-print flex flex-col md:flex-row gap-6 items-center">
        <div className="flex bg-gray-100 p-1 rounded-lg w-full md:w-auto">
          <button 
            onClick={() => setReportType('cumulative')}
            className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${reportType === 'cumulative' ? 'bg-white shadow text-green-700' : 'text-gray-500'}`}
          >
            {t.financialOverview}
          </button>
          <button 
            onClick={() => setReportType('monthly')}
            className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${reportType === 'monthly' ? 'bg-white shadow text-green-700' : 'text-gray-500'}`}
          >
            {t.provisioningReport}
          </button>
        </div>

        {reportType === 'monthly' && (
          <div className="flex gap-4 w-full md:w-auto">
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-bold"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-bold"
            >
              {months.map(m => <option key={m.id} value={m.id}>{m[language]}</option>)}
            </select>
          </div>
        )}

        <div className="md:ml-auto rtl:md:mr-auto flex gap-2 w-full md:w-auto">
          <button onClick={exportToExcel} className="flex-1 px-4 py-2 bg-green-700 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-green-800 transition">📊 {t.exportExcel}</button>
          <button onClick={() => window.print()} className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-red-700 transition">📕 {t.exportPdf}</button>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="p-8 border-b flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-2xl font-black text-gray-800 tracking-tight uppercase">
              {reportType === 'cumulative' ? t.financialOverview : `${t.provisioningReport} - ${months[selectedMonth][language]} ${selectedYear}`}
            </h2>
            <p className="text-xs text-gray-400 font-bold tracking-widest mt-1">
              {reportType === 'cumulative' ? 'LIABILITY & ACCRUAL SUMMARY' : 'MONTHLY FINANCIAL PROVISIONING LOG'}
            </p>
          </div>
          <div className="text-right rtl:text-left">
            <div className="text-sm font-bold text-gray-500">{new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</div>
            <div className="text-[10px] text-gray-400 font-mono">ID: ESB-RPT-{selectedYear}{selectedMonth+1}</div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left rtl:text-right border-collapse">
            <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[11px] border-b">
              {reportType === 'cumulative' ? (
                <tr>
                  <th className="px-6 py-4">{t.name}</th>
                  <th className="px-6 py-4">{t.hireDate}</th>
                  <th className="px-6 py-4">{t.servicePeriod}</th>
                  <th className="px-6 py-4 text-right">{t.openingBalance}</th>
                  <th className="px-6 py-4 text-right">{t.totalAccrued}</th>
                  <th className="px-6 py-4 text-right font-black text-gray-800">{t.totalLiability}</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-6 py-4">{t.name}</th>
                  <th className="px-6 py-4 text-right">{t.standardAccrual}</th>
                  <th className="px-6 py-4 text-right">{t.salaryAdjustment}</th>
                  <th className="px-6 py-4 text-right font-black text-indigo-600">{t.totalMonthlyProvision}</th>
                  <th className="px-6 py-4 text-right font-black text-gray-800">{t.closingBalance}</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map(emp => {
                if (reportType === 'cumulative') {
                  const calc = calculateESB(emp);
                  return (
                    <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-800">{emp.name}</div>
                        <div className="text-[10px] text-gray-400">{emp.employeeNumber} | {emp.jobTitle}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-mono">{emp.hireDate}</td>
                      <td className="px-6 py-4 text-gray-600 font-bold">{calc.breakdown.years}Y {calc.breakdown.months}M</td>
                      <td className="px-6 py-4 text-right tabular-nums">{emp.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right tabular-nums">{calc.accruedBenefit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right tabular-nums font-black text-green-600 text-base">
                        {calc.totalLiability.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                } else {
                  const prov = getProvisioningForMonth(emp, selectedYear, selectedMonth);
                  return (
                    <tr key={emp.id} className={`hover:bg-gray-50 transition-colors ${prov.hasSalaryChange ? 'bg-yellow-50/30' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-800">{emp.name}</div>
                        {prov.hasSalaryChange && <div className="text-[10px] text-amber-600 font-bold">⚠️ {t.salaryAdjustment}</div>}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums text-gray-600 font-bold">{prov.standardAccrual.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-amber-600 font-bold">{prov.adjustmentAccrual.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right tabular-nums font-black text-indigo-600">{prov.totalAccrual.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right tabular-nums font-black text-gray-800 text-base">
                        {prov.closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                }
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              {reportType === 'cumulative' ? (
                <tr>
                  <td className="px-6 py-6 font-black text-gray-400" colSpan={3}>GRAND TOTAL</td>
                  <td className="px-6 py-6 text-right tabular-nums font-black">{employees.reduce((sum, e) => sum + e.openingBalance, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-6 text-right tabular-nums font-black">{employees.reduce((sum, e) => sum + calculateESB(e).accruedBenefit, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-6 text-right tabular-nums text-xl font-black text-green-800">
                    {employees.reduce((sum, e) => sum + calculateESB(e).totalLiability, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ) : (
                <tr>
                  <td className="px-6 py-6 font-black text-gray-400">TOTAL PROVISION</td>
                  <td className="px-6 py-6 text-right tabular-nums font-black">{employees.reduce((sum, e) => sum + getProvisioningForMonth(e, selectedYear, selectedMonth).standardAccrual, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-6 text-right tabular-nums font-black">{employees.reduce((sum, e) => sum + getProvisioningForMonth(e, selectedYear, selectedMonth).adjustmentAccrual, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-6 text-right tabular-nums font-black text-indigo-700 text-lg">{employees.reduce((sum, e) => sum + getProvisioningForMonth(e, selectedYear, selectedMonth).totalAccrual, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-6 text-right tabular-nums font-black text-gray-800 text-xl">
                    {employees.reduce((sum, e) => sum + getProvisioningForMonth(e, selectedYear, selectedMonth).closingBalance, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>
      
      {/* Legend / Info */}
      {reportType === 'monthly' && (
        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-start gap-3 no-print">
          <span className="text-xl">💡</span>
          <div className="text-xs text-indigo-800 leading-relaxed">
            <strong>{t.salaryAdjustment}:</strong> {isRtl 
              ? 'توضح هذه القيمة فرق الاستحقاق التراكمي لجميع السنوات السابقة عند تعديل راتب الموظف في هذا الشهر. يتم تحميل كامل الفرق على شهر التعديل لضمان دقة الرصيد الختامي.'
              : 'This value represents the cumulative accrual difference for all previous years when a salary adjustment occurs this month. The entire difference is loaded into the adjustment month to ensure closing balance accuracy.'}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
