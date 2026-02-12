import React, { useMemo, useState } from 'react';
import { TerminationReason } from '../types';
import { calculateESBFromValues, calculateServiceBreakdown } from '../services/calculator';

interface ServicesProps {
  t: any;
  isRtl: boolean;
}

const Services: React.FC<ServicesProps> = ({ t, isRtl }) => {
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [terminationType, setTerminationType] = useState<'resignation' | 'other'>('other');
  const [monthlySalary, setMonthlySalary] = useState(0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const result = useMemo(() => {
    if (!startDate || !endDate || monthlySalary <= 0) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    if (start > end) return null;

    const breakdown = calculateServiceBreakdown(startDate, end);
    const reason = terminationType === 'resignation' ? TerminationReason.RESIGNATION : undefined;
    const { accruedBenefit, totalServiceYears, reductionRatio } = calculateESBFromValues(
      monthlySalary,
      breakdown.years,
      breakdown.months,
      breakdown.days,
      reason
    );

    return { breakdown, accruedBenefit, totalServiceYears, reductionRatio };
  }, [startDate, endDate, monthlySalary, terminationType]);

  const isInvalidRange = useMemo(() => {
    if (!startDate || !endDate) return false;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    return start > end;
  }, [startDate, endDate]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-800">{t.services}</h2>
            <p className="text-xs text-gray-400 font-bold tracking-widest mt-1 uppercase">
              {t.electronicCalculator}
            </p>
          </div>
          <button
            onClick={() => setIsCalculatorOpen(true)}
            className="px-6 py-3 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 shadow-lg shadow-green-100 transition-all"
          >
            🧮 {t.openCalculator}
          </button>
        </div>
      </div>

      {isCalculatorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-gray-800">{t.serviceCalculatorTitle}</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">{t.electronicCalculator}</p>
              </div>
              <button onClick={() => setIsCalculatorOpen(false)} className="text-gray-400 hover:scale-110 transition font-bold">✕</button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t.startDateLabel}</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full mt-2 px-4 py-3 border-2 border-gray-100 rounded-xl font-bold focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t.endDateLabel}</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full mt-2 px-4 py-3 border-2 border-gray-100 rounded-xl font-bold focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t.terminationType}</label>
                  <select
                    value={terminationType}
                    onChange={(e) => setTerminationType(e.target.value as 'resignation' | 'other')}
                    className="w-full mt-2 px-4 py-3 border-2 border-gray-100 rounded-xl font-bold focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="other">{t.nonResignationOption}</option>
                    <option value="resignation">{t.resignationOption}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t.monthlySalary}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlySalary}
                    onChange={(e) => setMonthlySalary(Number(e.target.value))}
                    className="w-full mt-2 px-4 py-3 border-2 border-gray-100 rounded-xl font-bold focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                {isInvalidRange && (
                  <div className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    {t.invalidDateRange}
                  </div>
                )}
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 space-y-6">
                <div className="text-center">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{t.calcResult}</span>
                  <h4 className="text-lg font-black text-gray-800 mt-2">{t.servicePeriod}</h4>
                </div>
                {result ? (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center bg-white rounded-xl border border-gray-100 p-4">
                        <div className="text-2xl font-black text-gray-800">{result.breakdown.years}</div>
                        <div className="text-xs font-bold text-gray-400">{t.years}</div>
                      </div>
                      <div className="text-center bg-white rounded-xl border border-gray-100 p-4">
                        <div className="text-2xl font-black text-gray-800">{result.breakdown.months}</div>
                        <div className="text-xs font-bold text-gray-400">{t.months}</div>
                      </div>
                      <div className="text-center bg-white rounded-xl border border-gray-100 p-4">
                        <div className="text-2xl font-black text-gray-800">{result.breakdown.days}</div>
                        <div className="text-xs font-bold text-gray-400">{t.days}</div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{t.benefitAmount}</span>
                        <span className="text-lg font-black text-green-700">{formatCurrency(result.accruedBenefit)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{t.benefitRatio}</span>
                        <span className="text-sm font-black text-gray-700">{result.reductionRatio.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{t.totalServiceYears}</span>
                        <span className="text-sm font-black text-gray-700">{result.totalServiceYears.toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-sm font-bold text-gray-400">
                    {t.calculationDateNote}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsCalculatorOpen(false)}
                className="px-6 py-2 font-bold text-gray-500 hover:text-gray-700"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Services;
