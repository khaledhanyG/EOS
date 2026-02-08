
import React, { useMemo, useState } from 'react';
import { Employee } from '../types';
import { calculateESB } from '../services/calculator';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DashboardProps {
  employees: Employee[];
  t: any;
  isRtl: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ employees, t, isRtl }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const stats = useMemo(() => {
    let totalLiability = 0;
    let totalAccrued = 0;
    let totalMonthlyAccrual = 0;
    let activeCount = 0;

    employees.forEach(emp => {
      const calc = calculateESB(emp);
      totalLiability += calc.remainingLiability;
      totalAccrued += calc.accruedBenefit;
      totalMonthlyAccrual += calc.monthlyProvision;
      if (emp.status === 'ACTIVE') activeCount++;
    });

    return {
      totalAccrued,
      totalLiability,
      totalMonthlyAccrual,
      activeCount
    };
  }, [employees]);

  const chartData = useMemo(() => {
    return employees.slice(0, 10).map(emp => {
      const calc = calculateESB(emp);
      return {
        name: emp.name,
        value: calc.remainingLiability
      };
    });
  }, [employees]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const years = useMemo(() => {
    const startYear = 2017;
    const currentYear = new Date().getFullYear() + 2;
    const arr = [];
    for (let i = startYear; i <= currentYear; i++) arr.push(i);
    return arr;
  }, []);

  const months = useMemo(() => [
    { id: 0, label: isRtl ? "يناير" : "Jan" },
    { id: 1, label: isRtl ? "فبراير" : "Feb" },
    { id: 2, label: isRtl ? "مارس" : "Mar" },
    { id: 3, label: isRtl ? "أبريل" : "Apr" },
    { id: 4, label: isRtl ? "مايو" : "May" },
    { id: 5, label: isRtl ? "يونيو" : "Jun" },
    { id: 6, label: isRtl ? "يوليو" : "Jul" },
    { id: 7, label: isRtl ? "أغسطس" : "Aug" },
    { id: 8, label: isRtl ? "سبتمبر" : "Sep" },
    { id: 9, label: isRtl ? "أكتوبر" : "Oct" },
    { id: 10, label: isRtl ? "نوفمبر" : "Nov" },
    { id: 11, label: isRtl ? "ديسمبر" : "Dec" },
  ], [isRtl]);

  const matrixData = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    return [...employees]
      .sort((a, b) => new Date(a.hireDate).getTime() - new Date(b.hireDate).getTime())
      .map(emp => {
        let annualTotal = 0;
        const monthlyValues = months.map(m => {
          if (selectedYear > currentYear) return 0;
          if (selectedYear === currentYear && m.id > currentMonth) return 0;
          const startDate = new Date(selectedYear, m.id, 0);
          let endDate = new Date(selectedYear, m.id + 1, 0);
          if (selectedYear === currentYear && m.id === currentMonth) {
            endDate = today;
          }
          const esbEnd = calculateESB(emp, endDate);
          const esbStart = calculateESB(emp, startDate);
          const diff = Math.max(0, esbEnd.remainingLiability - esbStart.remainingLiability);
          annualTotal += diff;
          return diff;
        });
        // Calculate Total Liability up to the end of the selected year
        const yearEndDate = new Date(selectedYear, 11, 31);
        // If selected year is changing, we want the hypothetical liability at that date.
        // passing yearEndDate to calculateESB (which supports overrides)
        const liabilityAtYearEnd = calculateESB(emp, yearEndDate).remainingLiability;

        return {
          id: emp.id,
          name: emp.name,
          monthlyValues,
          annualTotal,
          liabilityAtYearEnd
        };
      });
  }, [employees, selectedYear, months]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center no-print">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span>📅</span> {t.viewByYear}
        </h2>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="px-6 py-2 bg-white border-2 border-green-100 rounded-xl font-bold text-green-700 shadow-sm focus:ring-2 focus:ring-green-500 outline-none"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title={t.remainingAmount} value={stats.totalLiability} icon="💰" color="bg-blue-600" />
        <StatCard title={t.totalAccrued} value={stats.totalAccrued} icon="📈" color="bg-green-600" />
        <StatCard title={t.totalMonthlyAllowance} value={stats.totalMonthlyAccrual} icon="🧮" color="bg-purple-600" />
        <StatCard title={t.activeEmployees} value={stats.activeCount} icon="👤" color="bg-orange-600" isCount />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-700">{t.monthlyAccrualMatrix} ({selectedYear})</h2>
          <span className="text-xs font-bold text-gray-400">SAR / MONTH</span>
        </div>
        <div className="overflow-x-auto matrix-scroll">
          <table className="w-full text-xs text-left rtl:text-right border-collapse">
            <thead className="bg-gray-100/50 text-gray-500 font-bold border-b">
              <tr>
                <th className="px-4 py-3 sticky left-0 rtl:right-0 bg-gray-100/80 backdrop-blur z-10 w-48">{t.employeeName}</th>
                {months.map(m => (
                  <th key={m.id} className="px-4 py-3 text-center min-w-[100px] border-l border-gray-200">{m.label}</th>
                ))}
                <th className="px-4 py-3 text-center min-w-[120px] border-l border-gray-200 bg-green-50 text-green-700 sticky right-0 rtl:left-0 z-10">{t.annualTotal}</th>
                <th className="px-4 py-3 text-center min-w-[140px] border-l border-gray-200 bg-blue-50 text-blue-800 font-black whitespace-nowrap sticky right-0 z-20">{t.totalLiabilityEndOfYear || "Total Due (End of Year)"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {matrixData.map(row => (
                <tr key={row.id} className="hover:bg-green-50/50 transition-colors">
                  <td className="px-4 py-3 font-bold text-gray-700 sticky left-0 rtl:right-0 bg-white/90 backdrop-blur z-10 border-r rtl:border-r-0 rtl:border-l shadow-sm">{row.name}</td>
                  {row.monthlyValues.map((val, idx) => (
                    <td key={idx} className={`px-4 py-3 text-center tabular-nums border-l border-gray-100 ${val > 1000 ? 'font-bold text-indigo-600' : 'text-gray-500'}`}>
                      {val === 0 ? '-' : val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center tabular-nums font-black text-green-700 bg-green-50/30 sticky right-0 rtl:left-0 z-10 border-l">
                    {row.annualTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums font-black text-blue-800 bg-blue-50/30 sticky right-0 z-20 border-l">
                    {row.liabilityAtYearEnd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-black text-gray-800 border-t-2 border-gray-300">
              <tr>
                <td className="px-4 py-3 sticky left-0 rtl:right-0 bg-gray-100 z-10 border-r rtl:border-r-0 rtl:border-l shadow-sm text-right">{t.total || "Total"}</td>
                {months.map((_, idx) => {
                  const colTotal = matrixData.reduce((sum, row) => sum + row.monthlyValues[idx], 0);
                  return (
                    <td key={idx} className="px-4 py-3 text-center tabular-nums border-l border-gray-200">
                      {colTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center tabular-nums font-black text-green-800 bg-green-100 sticky right-0 rtl:left-0 z-10 border-l">
                  {matrixData.reduce((sum, row) => sum + row.annualTotal, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-center tabular-nums font-black text-blue-900 bg-blue-100 sticky right-0 z-20 border-l">
                  {matrixData.reduce((sum, row) => sum + row.liabilityAtYearEnd, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border">
          <h2 className="text-lg font-bold mb-6 text-gray-700">{t.financialOverview}</h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={10} interval={0} angle={-15} textAnchor="end" />
                <YAxis tickFormatter={(val) => `${val / 1000}k`} fontSize={10} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), t.remainingAmount]}
                  labelStyle={{ textAlign: isRtl ? 'right' : 'left' }}
                />
                <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#16a34a' : '#2563eb'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Enhanced Rules Panel based on image */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col">
          <div className="p-5 bg-[#204051] text-white text-center">
            <h2 className="text-xl font-bold">{t.calcHeader}</h2>
          </div>
          <div className="p-6 flex-1 space-y-8 overflow-y-auto">
            {/* General Case Header */}
            <div className="space-y-4">
              <div className="p-3 bg-[#fbb03b]/20 text-[#204051] text-xs font-bold rounded-lg leading-relaxed text-center border-l-4 border-[#fbb03b]">
                {t.fullBenefitCase}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 border rounded-xl bg-gray-50 border-gray-100 flex flex-col items-center">
                  <div className="w-12 h-12 mb-2 flex items-center justify-center bg-white rounded-full shadow-sm text-2xl border border-gray-100">📅</div>
                  <h4 className="font-bold text-xs text-[#204051] mb-1">{t.halfMonthRule}:</h4>
                  <p className="text-[10px] text-gray-500 leading-tight">{t.halfMonthDesc}</p>
                </div>
                <div className="text-center p-3 border rounded-xl bg-gray-50 border-gray-100 flex flex-col items-center">
                  <div className="w-12 h-12 mb-2 flex items-center justify-center bg-white rounded-full shadow-sm text-2xl border border-gray-100">📅</div>
                  <h4 className="font-bold text-xs text-[#204051] mb-1">{t.fullMonthRule}:</h4>
                  <p className="text-[10px] text-gray-500 leading-tight">{t.fullMonthDesc}</p>
                </div>
              </div>
            </div>

            {/* Resignation Case Header */}
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div className="text-center">
                <span className="bg-[#fbb03b] text-[#204051] px-6 py-1 rounded text-sm font-black uppercase tracking-widest inline-block mb-4">
                  {t.resignationCase}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 transition-hover hover:bg-white hover:shadow-md">
                  <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-xl">💵</div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-[#204051]">{t.oneThirdBenefit}:</p>
                    <p className="text-[10px] text-gray-500 leading-tight">{t.oneThirdDesc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 transition-hover hover:bg-white hover:shadow-md">
                  <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-xl">💵💵</div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-[#204051]">{t.twoThirdsBenefit}:</p>
                    <p className="text-[10px] text-gray-500 leading-tight">{t.twoThirdsDesc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-[#204051]/5 rounded-xl border border-[#204051]/10 transition-hover hover:bg-white hover:shadow-md">
                  <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-xl">💰</div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-[#204051]">{t.fullResignBenefit}:</p>
                    <p className="text-[10px] text-gray-500 leading-tight font-bold">{t.fullResignDesc}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 bg-gray-50 border-t text-[10px] text-gray-400 italic text-center font-bold">
            {t.saudiLawNote}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: number; icon: string; color: string; isCount?: boolean }> = ({ title, value, icon, color, isCount }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border flex items-center gap-4 transition-transform hover:scale-[1.02]">
    <div className={`w-14 h-14 ${color} rounded-xl flex items-center justify-center text-white text-2xl shadow-lg shadow-opacity-20`}>
      {icon}
    </div>
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</p>
      <p className="text-2xl font-black text-gray-900 tracking-tight flex items-baseline gap-1">
        {!isCount && <span className="text-xs font-bold text-gray-400">SAR</span>}
        {value.toLocaleString('en-US', { minimumFractionDigits: isCount ? 0 : 0, maximumFractionDigits: isCount ? 0 : 0 })}
      </p>
    </div>
  </div>
);

export default Dashboard;
