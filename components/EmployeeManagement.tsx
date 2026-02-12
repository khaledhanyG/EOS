
import React, { useState, useEffect } from 'react';
import { Employee, EmployeeStatus, SalaryHistoryEntry, TerminationReason, ServiceBreakdown } from '../types';
import { calculateESB, calculateServiceBreakdown, getSalaryAtDate } from '../services/calculator';
import ExcelImportModal from './ExcelImportModal';

interface EmployeeManagementProps {
  employees: Employee[];
  t: any;
  isRtl: boolean;
  addEmployee: (emp: any) => void;
  updateEmployee: (id: string, emp: any) => void;
  deleteEmployee: (id: string) => void;
  canEdit: boolean;
}

const EmployeeManagement: React.FC<EmployeeManagementProps> = ({ employees, t, isRtl, addEmployee, updateEmployee, deleteEmployee, canEdit }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [isTerminateModalOpen, setIsTerminateModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingHistoryIndex, setEditingHistoryIndex] = useState<number | null>(null);
  const [deletingHistoryIndex, setDeletingHistoryIndex] = useState<number | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [salaryForm, setSalaryForm] = useState({ gross: 0, basic: 0, housing: 0, transport: 0, other: 0 });
  const [newSalaryValue, setNewSalaryValue] = useState(0);
  const [salaryChangeReason, setSalaryChangeReason] = useState('');
  const [salaryChangeDate, setSalaryChangeDate] = useState(new Date().toISOString().split('T')[0]);

  const [previewCalcDate, setPreviewCalcDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState<string>('');

  useEffect(() => {
    if (editingEmployee) {
      const total = (editingEmployee.basicSalary || 0) + (editingEmployee.housingAllowance || 0) + (editingEmployee.transportAllowance || 0) + (editingEmployee.otherAllowances || 0);
      setSalaryForm({
        gross: total - (editingEmployee.otherAllowances || 0),
        basic: editingEmployee.basicSalary || 0,
        housing: editingEmployee.housingAllowance || 0,
        transport: editingEmployee.transportAllowance || 0,
        other: editingEmployee.otherAllowances || 0
      });
      setNewSalaryValue(total);
      setSalaryChangeReason(t.annualReview);
      setSalaryChangeDate(new Date().toISOString().split('T')[0]);
    } else {
      setSalaryForm({ gross: 0, basic: 0, housing: 0, transport: 0, other: 0 });
    }
  }, [editingEmployee, isModalOpen, isSalaryModalOpen, t]);

  // Separate effect: Only reset preview date when modal OPENS (not on employee change)
  useEffect(() => {
    if (isPreviewModalOpen && editingEmployee) {
      const defaultDate = editingEmployee.status === EmployeeStatus.TERMINATED && editingEmployee.terminationDate
        ? editingEmployee.terminationDate
        : new Date().toISOString().split('T')[0];
      setPreviewCalcDate(defaultDate);
    }
  }, [isPreviewModalOpen]);

  const handleGrossChange = (val: number) => {
    const basic = Number((val / 1.35).toFixed(2));
    const housing = Number((basic * 0.25).toFixed(2));
    const transport = Number((val - basic - housing).toFixed(2));
    setSalaryForm(prev => ({ ...prev, gross: val, basic, housing, transport }));
  };

  const handleSalaryIncrease = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee || !canEdit) return;
    const val = newSalaryValue;
    const basic = Number((val / 1.35).toFixed(2));
    const housing = Number((basic * 0.25).toFixed(2));
    const transport = Number((val - basic - housing).toFixed(2));
    const updatedHistory = [...(editingEmployee.salaryHistory || [])];
    updatedHistory.push({
      date: salaryChangeDate,
      basicSalary: basic,
      housingAllowance: housing,
      transportAllowance: transport,
      otherAllowances: editingEmployee.otherAllowances || 0,
      total: val,
      reason: salaryChangeReason || t.increaseSalary
    });
    updateEmployee(editingEmployee.id, { basicSalary: basic, housingAllowance: housing, transportAllowance: transport, salaryHistory: updatedHistory });
    setIsSalaryModalOpen(false);
  };

  const handleDeleteHistory = () => {
    if (!editingEmployee || deletingHistoryIndex === null) return;

    if (deleteConfirmationInput !== t.matchDeleteWord) return;

    const updatedHistory = [...(editingEmployee.salaryHistory || [])];
    updatedHistory.splice(deletingHistoryIndex, 1);

    // Sort by date descending to find the new latest
    const sortedHistory = [...updatedHistory].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const latest = sortedHistory[0];
    const updatedFields: Partial<Employee> = {
      salaryHistory: updatedHistory,
    };

    if (latest) {
      updatedFields.basicSalary = Number(latest.basicSalary) || 0;
      updatedFields.housingAllowance = Number(latest.housingAllowance) || 0;
      updatedFields.transportAllowance = Number(latest.transportAllowance) || 0;
      updatedFields.otherAllowances = Number(latest.otherAllowances) || 0;
    } else {
      // If history is empty, reset salary fields to 0 or opening balance??
      // Based on user request, it should match the "current" state found in DB.
      // If no history, current salary is effectively 0 or purely Opening Balance driven.
      // Let's reset to 0 to be safe and clear.
      updatedFields.basicSalary = 0;
      updatedFields.housingAllowance = 0;
      updatedFields.transportAllowance = 0;
      updatedFields.otherAllowances = 0;
    }

    updateEmployee(editingEmployee.id, updatedFields);
    setEditingEmployee({ ...editingEmployee, ...updatedFields });
    setDeletingHistoryIndex(null);
    setDeleteConfirmationInput('');
  };

  const handleTerminate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEmployee || !canEdit) return;
    const formData = new FormData(e.currentTarget);
    const terminationDate = formData.get('terminationDate') as string;
    const terminationReason = formData.get('terminationReason') as TerminationReason;
    updateEmployee(editingEmployee.id, {
      status: EmployeeStatus.TERMINATED,
      terminationDate,
      terminationReason,
      contractEndDate: terminationDate // Sync contract end date with termination date
    });
    setIsTerminateModalOpen(false);
  };

  const handlePayout = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEmployee || !canEdit) return;
    const formData = new FormData(e.currentTarget);
    const payoutAmount = parseFloat(formData.get('payoutAmount') as string);
    const payoutDate = formData.get('payoutDate') as string;
    updateEmployee(editingEmployee.id, { payoutAmount, payoutDate });
    setIsPayoutModalOpen(false);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canEdit) return;
    const formData = new FormData(e.currentTarget);
    const basicSalary = salaryForm.basic;
    const housingAllowance = salaryForm.housing;
    const transportAllowance = salaryForm.transport;
    const otherAllowances = salaryForm.other;
    const total = basicSalary + housingAllowance + transportAllowance + otherAllowances;

    const baseData = {
      employeeNumber: formData.get('employeeNumber') as string,
      name: formData.get('name') as string,
      jobTitle: formData.get('jobTitle') as string,
      hireDate: formData.get('hireDate') as string,
      contractEndDate: (formData.get('endDate') as string) || undefined,
      basicSalary,
      housingAllowance,
      transportAllowance,
      otherAllowances,
      openingBalance: Number(formData.get('openingBalance')) || 0,
      status: formData.get('status') as EmployeeStatus,
    };

    if (editingEmployee) {
      updateEmployee(editingEmployee.id, baseData);
    } else {
      const initialHistory: SalaryHistoryEntry[] = [{
        date: baseData.hireDate,
        basicSalary, housingAllowance, transportAllowance, otherAllowances,
        total, reason: t.adjustment
      }];
      addEmployee({ ...baseData, salaryHistory: initialHistory });
    }
    setIsModalOpen(false);
    setEditingEmployee(null);
  };

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.employeeNumber && e.employeeNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center no-print">
        <div className="relative w-full md:w-96">
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            className="w-full px-12 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-green-500 focus:outline-none font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-3.5 text-gray-400 text-lg`}>🔍</span>
        </div>
        {canEdit && (
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex-1 md:flex-none px-6 py-3 bg-white border border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-all"
            >
              📤 {t.importExcel}
            </button>
            <button
              onClick={() => { setEditingEmployee(null); setIsModalOpen(true); }}
              className="flex-1 md:flex-none px-8 py-3 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 shadow-lg shadow-green-100 transition-all"
            >
              + {t.addEmployee}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left rtl:text-right">
            <thead className="bg-gray-50 text-gray-400 font-black uppercase text-[10px] tracking-widest border-b">
              <tr>
                <th className="px-6 py-5">{t.employeeNumber}</th>
                <th className="px-6 py-5">{t.name}</th>
                <th className="px-6 py-5">{t.totalSalary}</th>
                <th className="px-6 py-5">{t.remainingAmount}</th>
                <th className="px-6 py-5">{t.status}</th>
                <th className="px-6 py-5 no-print">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmployees.map((emp) => {
                const calc = calculateESB(emp);
                const isTerminated = emp.status === EmployeeStatus.TERMINATED;
                const isPaidFull = calc.remainingLiability <= 0 && isTerminated;
                return (
                  <tr key={emp.id} className={`hover:bg-gray-50/50 transition-colors ${isTerminated ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-6 py-5 font-mono text-gray-500 font-bold">{emp.employeeNumber}</td>
                    <td className="px-6 py-5">
                      <div className="font-black text-gray-800">{emp.name}</div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase">{emp.jobTitle}</div>
                    </td>
                    <td className="px-6 py-5 text-gray-600 font-bold tabular-nums">
                      {((emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.otherAllowances || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-5 font-black text-green-600 tabular-nums">
                      {calc.remainingLiability.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${emp.status === EmployeeStatus.ACTIVE ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {emp.status === EmployeeStatus.ACTIVE ? t.active : t.terminated}
                      </span>
                      {isTerminated && (
                        <div className={`text-[8px] font-bold mt-1 uppercase ${isPaidFull ? 'text-green-600' : 'text-amber-600'}`}>
                          {isPaidFull ? t.paidStatus : (emp.payoutAmount ? t.partiallyPaid : t.notPaid)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 no-print">
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingEmployee(emp); setIsPreviewModalOpen(true); }} className="p-2 hover:bg-white rounded-lg transition shadow-sm border border-transparent hover:border-gray-100">👁️</button>
                        {canEdit && (
                          <>
                            {!isTerminated ? (
                              <>
                                <button onClick={() => { setEditingEmployee(emp); setIsSalaryModalOpen(true); }} className="p-2 hover:bg-white rounded-lg transition text-green-600 shadow-sm border border-transparent hover:border-gray-100">📈</button>
                                <button onClick={() => { setEditingEmployee(emp); setIsTerminateModalOpen(true); }} className="p-2 hover:bg-white rounded-lg transition text-red-600 shadow-sm border border-transparent hover:border-gray-100">🚪</button>
                              </>
                            ) : (
                              <button onClick={() => { setEditingEmployee(emp); setIsPayoutModalOpen(true); }} className="p-2 hover:bg-white rounded-lg transition text-blue-600 shadow-sm border border-transparent hover:border-gray-100">💰</button>
                            )}
                            <button onClick={() => { setEditingEmployee(emp); setIsModalOpen(true); }} className="p-2 hover:bg-white rounded-lg transition text-indigo-600 shadow-sm border border-transparent hover:border-gray-100">✏️</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Employee Modal - FIXED & IMPROVED */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
              <h2 className="text-xl font-black text-gray-800 tracking-tight">{editingEmployee ? t.editEmployee : t.addEmployee}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:scale-110 transition font-bold">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[80vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div><label className="block text-xs font-black text-gray-400 uppercase mb-1">{t.employeeNumber}</label><input name="employeeNumber" required defaultValue={editingEmployee?.employeeNumber} className="w-full px-4 py-2 border rounded-xl font-bold focus:border-green-500 outline-none" /></div>
                <div><label className="block text-xs font-black text-gray-400 uppercase mb-1">{t.name}</label><input name="name" required defaultValue={editingEmployee?.name} className="w-full px-4 py-2 border rounded-xl font-bold focus:border-green-500 outline-none" /></div>
                <div><label className="block text-xs font-black text-gray-400 uppercase mb-1">{t.jobTitle}</label><input name="jobTitle" required defaultValue={editingEmployee?.jobTitle} className="w-full px-4 py-2 border rounded-xl font-bold focus:border-green-500 outline-none" /></div>
                <div><label className="block text-xs font-black text-gray-400 uppercase mb-1">{t.hireDate}</label><input type="date" name="hireDate" required defaultValue={editingEmployee?.hireDate} className="w-full px-4 py-2 border rounded-xl font-bold focus:border-green-500 outline-none" /></div>
                <div><label className="block text-xs font-black text-gray-400 uppercase mb-1">{t.endDate}</label><input type="date" name="endDate" defaultValue={editingEmployee?.contractEndDate} className="w-full px-4 py-2 border rounded-xl font-bold focus:border-green-500 outline-none" /></div>
                <div><label className="block text-xs font-black text-gray-400 uppercase mb-1">{t.openingBalance}</label><input type="number" step="0.01" name="openingBalance" defaultValue={editingEmployee?.openingBalance || 0} className="w-full px-4 py-2 border rounded-xl font-bold focus:border-green-500 outline-none" /></div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">{t.status}</label>
                  <select name="status" defaultValue={editingEmployee?.status || EmployeeStatus.ACTIVE} className="w-full px-4 py-2 border rounded-xl font-bold focus:border-green-500 outline-none">
                    <option value={EmployeeStatus.ACTIVE}>{t.active}</option>
                    <option value={EmployeeStatus.INACTIVE}>{t.inactive}</option>
                  </select>
                </div>
              </div>
              <div className="bg-green-50 p-6 rounded-2xl border border-green-100 space-y-4">
                <h3 className="text-xs font-black text-green-800 uppercase tracking-widest">{t.totalSalary}</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div><label className="block text-[10px] font-black text-green-700 mb-1">{t.grossSalary}</label><input type="number" step="0.01" value={salaryForm.gross || ''} onChange={(e) => handleGrossChange(Number(e.target.value))} className="w-full px-4 py-2 border-2 border-green-200 rounded-xl font-black text-lg focus:border-green-500 outline-none" /></div>
                  <div><label className="block text-[10px] font-black text-gray-500 mb-1">{t.basicSalary}</label><input type="number" step="0.01" value={salaryForm.basic || ''} onChange={(e) => setSalaryForm({ ...salaryForm, basic: Number(e.target.value) })} className="w-full px-4 py-2 border rounded-xl font-bold" /></div>
                  <div><label className="block text-[10px] font-black text-gray-500 mb-1">{t.housing}</label><input type="number" step="0.01" value={salaryForm.housing || ''} onChange={(e) => setSalaryForm({ ...salaryForm, housing: Number(e.target.value) })} className="w-full px-4 py-2 border rounded-xl font-bold" /></div>
                  <div><label className="block text-[10px] font-black text-gray-500 mb-1">{t.transport}</label><input type="number" step="0.01" value={salaryForm.transport || ''} onChange={(e) => setSalaryForm({ ...salaryForm, transport: Number(e.target.value) })} className="w-full px-4 py-2 border rounded-xl font-bold" /></div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 font-bold text-gray-500">{t.cancel}</button>
                <button type="submit" className="px-10 py-2 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition shadow-lg shadow-green-100">{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Salary Change Modal */}
      {isSalaryModalOpen && editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-xl font-black mb-6 text-gray-800">{t.increaseSalary}: {editingEmployee.name}</h2>

            <div className="mb-8 border-b pb-8">
              <h3 className="font-bold text-gray-500 text-sm uppercase mb-4">{t.addNewAdjustment}</h3>
              <form onSubmit={handleSalaryIncrease} className="space-y-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">{t.historyDate}</label>
                    <input
                      type="date"
                      required
                      value={salaryChangeDate}
                      onChange={(e) => setSalaryChangeDate(e.target.value)}
                      className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-gray-700 outline-none focus:border-green-500 transition-colors text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">{t.changeReason}</label>
                    <input
                      type="text"
                      required
                      placeholder={t.reason || "Reason"}
                      value={salaryChangeReason}
                      onChange={(e) => setSalaryChangeReason(e.target.value)}
                      className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-gray-700 outline-none focus:border-green-500 transition-colors"
                    />
                  </div>
                </div>
                <div><label className="block text-xs font-black text-gray-400 uppercase mb-1">{t.newSalary}</label><input type="number" step="0.01" required value={newSalaryValue} onChange={(e) => setNewSalaryValue(Number(e.target.value))} className="w-full px-4 py-3 border-2 border-green-100 rounded-xl font-black text-xl text-green-700" /></div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="submit" className="w-full py-3 bg-green-600 text-white font-black rounded-xl shadow-lg shadow-green-100 hover:bg-green-700 transition">{t.process}</button>
                </div>
              </form>
            </div>

            <div>
              <h3 className="font-bold text-gray-500 text-sm uppercase mb-4">{t.salaryHistory}</h3>
              <div className="space-y-3">
                {/* SAFE SORT: Create copy first to avoid mutating state */}
                {[...(editingEmployee.salaryHistory || [])]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((hist, _sortedIdx) => {
                    // Find actual index in the unsorted source array
                    const originalIndex = (editingEmployee.salaryHistory || []).findIndex(h => h === hist);
                    if (originalIndex === -1) return null;
                    const isEditing = editingHistoryIndex === originalIndex;

                    return (
                      <div key={originalIndex} className="bg-gray-50 rounded-xl border border-gray-100 p-2 overflow-hidden flex items-center justify-between gap-3 group hover:bg-white hover:shadow-sm transition">

                        {/* 1. Date (Right in RTL) */}
                        <div className="bg-white p-2 rounded-lg border text-center min-w-[70px] shrink-0">
                          {isEditing ? (
                            <input
                              type="date"
                              defaultValue={hist.date}
                              id={`modal-history-date-${originalIndex}`}
                              className="w-full text-[10px] p-0 border-0 text-center font-bold focus:ring-0"
                            />
                          ) : (
                            <>
                              <div className="text-[9px] text-gray-400 font-bold uppercase">{new Date(hist.date).toLocaleString('en-US', { month: 'short' })}</div>
                              <div className="text-xl font-black text-gray-800 leading-none py-0.5">{new Date(hist.date).getDate().toLocaleString('en-US')}</div>
                              <div className="text-[9px] text-gray-400">{new Date(hist.date).getFullYear().toString()}</div>
                            </>
                          )}
                        </div>

                        {/* 2. Content (Middle) - Flexible */}
                        <div className="flex-1 flex items-center gap-4 overflow-hidden">
                          {isEditing ? (
                            <div className="grid grid-cols-2 gap-2 w-full">
                              <div>
                                <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">{t.totalSalary}</label>
                                <div className="flex items-center bg-white border rounded px-2">
                                  <span className="text-gray-400 text-xs">SAR</span>
                                  <input
                                    type="number"
                                    defaultValue={hist.total}
                                    id={`modal-history-total-${originalIndex}`}
                                    className="w-full p-1 border-0 focus:ring-0 font-bold text-sm"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">{t.reason}</label>
                                <input
                                  type="text"
                                  defaultValue={hist.reason}
                                  id={`modal-history-reason-${originalIndex}`}
                                  className="w-full p-1 border rounded font-bold text-sm"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 w-full">
                              <div className="font-black text-lg text-gray-800 whitespace-nowrap">
                                <span className="text-xs text-gray-400 font-medium mr-1">SAR</span>
                                {hist.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div className="text-[10px] bg-white border px-2 py-1 rounded-full text-gray-500 font-bold truncate max-w-[150px]">
                                {hist.reason || '-'}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="shrink-0">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  // Fix: use findIndex again to be safe inside the handler closure? 
                                  // Actually originalIndex computed outside is safe if the array didn't change
                                  // BUT we need to ensure originalIndex is correct.

                                  const newDateEl = document.getElementById(`modal-history-date-${originalIndex}`) as HTMLInputElement;
                                  const newTotalEl = document.getElementById(`modal-history-total-${originalIndex}`) as HTMLInputElement;
                                  const newReasonEl = document.getElementById(`modal-history-reason-${originalIndex}`) as HTMLInputElement;

                                  if (newDateEl && newTotalEl && newReasonEl) {
                                    const newDate = newDateEl.value;
                                    const newTotal = parseFloat(newTotalEl.value);
                                    const newReason = newReasonEl.value;

                                    const basic = Number((newTotal / 1.35).toFixed(2));
                                    const housing = Number((basic * 0.25).toFixed(2));
                                    const transport = Number((newTotal - basic - housing).toFixed(2));

                                    const updatedHistory = [...editingEmployee.salaryHistory!];
                                    updatedHistory[originalIndex] = {
                                      ...hist,
                                      date: newDate,
                                      total: newTotal,
                                      reason: newReason,
                                      basicSalary: basic,
                                      housingAllowance: housing,
                                      transportAllowance: transport
                                    };

                                    updateEmployee(editingEmployee.id, { salaryHistory: updatedHistory });
                                    setEditingEmployee({ ...editingEmployee, salaryHistory: updatedHistory });
                                  }
                                  setEditingHistoryIndex(null);
                                }}
                                className="w-8 h-8 flex items-center justify-center bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm"
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingHistoryIndex(null)}
                                className="w-8 h-8 flex items-center justify-center bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            canEdit ? (
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingHistoryIndex(originalIndex)}
                                  className="w-8 h-8 flex items-center justify-center border border-gray-200 text-gray-400 rounded-lg hover:bg-white hover:border-green-500 hover:text-green-600 hover:shadow-sm transition"
                                >
                                  ✎
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeletingHistoryIndex(originalIndex);
                                    setDeleteConfirmationInput('');
                                  }}
                                  className="w-8 h-8 flex items-center justify-center border border-gray-200 text-gray-400 rounded-lg hover:bg-white hover:border-red-500 hover:text-red-500 hover:shadow-sm transition"
                                >
                                  🗑️
                                </button>
                              </div>
                            ) : null
                          )}
                        </div>

                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Delete Confirmation Overlay */}
            {deletingHistoryIndex !== null && (
              <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 rounded-3xl">
                <h4 className="text-xl font-black text-gray-800 mb-4">{t.confirmDelete}</h4>
                <p className="text-sm text-gray-500 mb-6">{t.typeToDelete}</p>
                <input
                  type="text"
                  value={deleteConfirmationInput}
                  onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                  placeholder={t.matchDeleteWord}
                  className="w-full max-w-xs px-4 py-3 border-2 border-red-100 rounded-xl font-bold text-center text-red-600 focus:border-red-500 outline-none mb-6"
                  autoFocus
                />
                <div className="flex gap-4">
                  <button
                    onClick={() => setDeletingHistoryIndex(null)}
                    className="px-6 py-2 font-bold text-gray-400 hover:text-gray-600"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleDeleteHistory}
                    disabled={deleteConfirmationInput !== t.matchDeleteWord}
                    className="px-8 py-2 bg-red-500 text-white font-black rounded-xl hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-red-100"
                  >
                    {t.delete}
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-6 mt-6 border-t">
              <button type="button" onClick={() => setIsSalaryModalOpen(false)} className="px-6 py-2 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition">{t.close}</button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate Modal */}
      {isTerminateModalOpen && editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8">
            <h2 className="text-xl font-black mb-6 text-red-600">{t.terminateService}</h2>
            <form onSubmit={handleTerminate} className="space-y-4">
              <div><label className="block text-xs font-black text-gray-400 uppercase mb-1">{t.terminationDate}</label><input type="date" name="terminationDate" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-2 border rounded-xl font-bold" /></div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase mb-1">{t.terminationReason}</label>
                <select name="terminationReason" required className="w-full px-4 py-2 border rounded-xl font-bold">
                  <option value={TerminationReason.RESIGNATION}>{t.resignation}</option>
                  <option value={TerminationReason.MUTUAL_AGREEMENT}>{t.mutualAgreement}</option>
                  <option value={TerminationReason.TERMINATION_BY_EMPLOYER}>{t.terminationEmployer}</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t">
                <button type="button" onClick={() => setIsTerminateModalOpen(false)} className="px-6 py-2 font-bold text-gray-500">{t.cancel}</button>
                <button type="submit" className="px-8 py-2 bg-red-600 text-white font-black rounded-xl">{t.process}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payout Modal */}
      {isPayoutModalOpen && editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8">
            <h2 className="text-xl font-black mb-6 text-blue-600">{t.payout}</h2>
            <form onSubmit={handlePayout} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase mb-1">{t.payoutAmount}</label>
                <input type="number" step="0.01" name="payoutAmount" required defaultValue={editingEmployee.payoutAmount || calculateESB(editingEmployee).totalLiability} className="w-full px-4 py-3 border-2 border-blue-100 rounded-xl font-black text-xl text-blue-700" />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase mb-1">{t.payoutDate}</label>
                <input type="date" name="payoutDate" required defaultValue={editingEmployee.payoutDate || new Date().toISOString().split('T')[0]} className="w-full px-4 py-2 border rounded-xl font-bold" />
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t">
                <button type="button" onClick={() => setIsPayoutModalOpen(false)} className="px-6 py-2 font-bold text-gray-500">{t.cancel}</button>
                <button type="submit" className="px-8 py-2 bg-blue-600 text-white font-black rounded-xl">{t.confirmPayout}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {isPreviewModalOpen && editingEmployee && (() => {
        const filteredEmpsForDropdown = employees.filter(e =>
          e.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
          (e.employeeNumber && e.employeeNumber.toLowerCase().includes(employeeSearchTerm.toLowerCase()))
        );

        const calc = calculateESB(editingEmployee, new Date(previewCalcDate));

        // Help find relevant salary entry for breakdown/display
        const relevantHistory = [...(editingEmployee.salaryHistory || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).find(h => h.date <= previewCalcDate);
        const displaySalary = relevantHistory ? {
          basic: relevantHistory.basicSalary,
          housing: relevantHistory.housingAllowance,
          transport: relevantHistory.transportAllowance,
          other: relevantHistory.otherAllowances,
          total: relevantHistory.total
        } : {
          basic: editingEmployee.basicSalary,
          housing: editingEmployee.housingAllowance,
          transport: editingEmployee.transportAllowance,
          other: editingEmployee.otherAllowances,
          total: (editingEmployee.basicSalary || 0) + (editingEmployee.housingAllowance || 0) + (editingEmployee.transportAllowance || 0) + (editingEmployee.otherAllowances || 0)
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-6 bg-gray-900 text-white flex justify-between items-center gap-4 shrink-0 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-black text-gray-400 uppercase mb-2">{t.employeeName}</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={t.searchPlaceholder}
                      value={employeeSearchTerm}
                      onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-bold placeholder-gray-500 focus:border-indigo-500 outline-none"
                    />
                    {employeeSearchTerm && filteredEmpsForDropdown.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                        {filteredEmpsForDropdown.map(emp => (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => {
                              setEditingEmployee(emp);
                              setEmployeeSearchTerm('');
                            }}
                            className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition text-sm font-bold border-b border-gray-700 last:border-b-0"
                          >
                            <div className="font-black">{emp.name}</div>
                            <div className="text-xs text-gray-400">{emp.employeeNumber} • {emp.jobTitle}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-[150px] text-right">
                  <h2 className="text-2xl font-black tracking-tight">{editingEmployee.name}</h2>
                  <p className="text-gray-400 font-bold uppercase text-xs tracking-wider">{editingEmployee.jobTitle} • {editingEmployee.employeeNumber}</p>
                </div>
                <button onClick={() => setIsPreviewModalOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition shrink-0">✕</button>
              </div>

              {/* Scrollable Content */}
              <div className="p-8 overflow-y-auto custom-scrollbar">

                {/* Date Selection */}
                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4 md:mb-8 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-black text-gray-500 uppercase whitespace-nowrap">{t.calcUpTo}</label>
                    <input
                      type="date"
                      value={previewCalcDate}
                      onChange={(e) => setPreviewCalcDate(e.target.value)}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-lg font-bold shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none hover:border-indigo-400 transition"
                    />
                  </div>
                  <div className={`text-xs text-gray-400 font-medium ${isRtl ? 'md:mr-auto' : 'md:ml-auto'}`}>
                    * {t.calculationDateNote}
                  </div>
                </div>
                {/* Big Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200 relative overflow-hidden group hover:scale-[1.02] transition">
                    <div className="relative z-10">
                      <p className="text-indigo-200 font-bold uppercase text-xs mb-1">{t.totalAccrued}</p>
                      <p className="text-3xl font-black">{calc.accruedBenefit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm opacity-50">SAR</span></p>
                    </div>
                    <div className="absolute -right-6 -bottom-6 text-indigo-500/20 text-9xl font-black group-hover:text-indigo-500/30 transition">SAR</div>
                  </div>
                  <div className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition relative group">
                    <p className="text-gray-400 font-bold uppercase text-xs mb-1">{t.payoutAmount}</p>
                    <p className="text-3xl font-black text-gray-800">{(editingEmployee.payoutAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm text-gray-400">SAR</span></p>
                    {editingEmployee.payoutDate && (
                      <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">📅 {editingEmployee.payoutDate}</p>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => { setIsPayoutModalOpen(true); setIsPreviewModalOpen(false); }}
                        className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100 transition-all bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                        title={t.edit}
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                  <div className="bg-green-50 border border-green-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition">
                    <p className="text-green-600 font-bold uppercase text-xs mb-1">{t.netPayable}</p>
                    <p className="text-3xl font-black text-green-700">{calc.remainingLiability.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm opacity-50">SAR</span></p>
                  </div>
                </div>

                {/* Service Duration Stripe */}
                <div className="flex justify-between items-center bg-gray-50 rounded-xl p-4 mb-4 md:mb-8 border border-gray-100">
                  <div className="text-center w-1/3 border-gray-200 ltr:border-r rtl:border-l">
                    <p className="text-2xl font-black text-gray-800">{calc.breakdown.years}</p>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.years}</p>
                  </div>
                  <div className="text-center w-1/3 border-gray-200 ltr:border-r rtl:border-l">
                    <p className="text-2xl font-black text-gray-800">{calc.breakdown.months}</p>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.months}</p>
                  </div>
                  <div className="text-center w-1/3">
                    <p className="text-2xl font-black text-gray-800">{calc.breakdown.days}</p>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.days}</p>
                  </div>
                </div>

                {/* Two Column details */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                  {/* Left Col: Salary & Basic Info */}
                  <div className="space-y-6">
                    <div className="bg-white border rounded-2xl p-6 shadow-sm">
                      <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <span className="text-lg">💰</span> {t.salaryBasis}
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center"><span className="text-gray-500 font-bold text-xs uppercase">{t.basicSalary}</span><span className="font-bold text-gray-800">{displaySalary.basic?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR</span></div>
                        <div className="flex justify-between items-center"><span className="text-gray-500 font-bold text-xs uppercase">{t.housing}</span><span className="font-bold text-gray-800">{displaySalary.housing?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR</span></div>
                        <div className="flex justify-between items-center"><span className="text-gray-500 font-bold text-xs uppercase">{t.transport}</span><span className="font-bold text-gray-800">{displaySalary.transport?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR</span></div>
                        <div className="flex justify-between items-center"><span className="text-gray-500 font-bold text-xs uppercase">{t.other}</span><span className="font-bold text-gray-800">{displaySalary.other?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR</span></div>
                        <div className="h-px bg-gray-100 my-2"></div>
                        <div className="flex justify-between items-center text-lg"><span className="font-black text-gray-800">{t.totalSalary}</span><span className="font-black text-green-600">{displaySalary.total?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR</span></div>
                      </div>
                    </div>

                    <div className="bg-white border rounded-2xl p-6 shadow-sm">
                      <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <span className="text-lg">📄</span> {t.contractInfo}
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500 font-medium">{t.hireDate}</span><span className="font-bold">{editingEmployee.hireDate}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500 font-medium">{t.terminationDate}</span><span className="font-bold">{editingEmployee.contractEndDate || "-"}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500 font-medium">{t.status}</span><span className={`font-bold px-2 py-0.5 rounded text-xs ${editingEmployee.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{editingEmployee.status === 'ACTIVE' ? t.active : t.terminated}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Right Col: History */}
                  <div className="bg-white border rounded-2xl p-6 shadow-sm h-full flex flex-col">
                    <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                      <span className="text-lg">📅</span> {t.salaryHistory}
                    </h3>
                    <div className="space-y-4 overflow-y-auto max-h-[300px] custom-scrollbar pr-2">
                      {editingEmployee.salaryHistory
                        ?.filter(h => h.date !== editingEmployee.hireDate)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((hist, idx) => (
                          <div key={idx} className="flex items-start gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-white hover:shadow-md transition group">
                            <div className="bg-white p-2 rounded-lg border text-center min-w-[60px] group-hover:border-indigo-200 transition">
                              <div className="text-[10px] text-gray-400 font-bold uppercase">{new Date(hist.date).toLocaleString('en-US', { month: 'short' })}</div>
                              <div className="text-lg font-black text-gray-800">{new Date(hist.date).getDate().toLocaleString('en-US')}</div>
                              <div className="text-[10px] text-gray-400">{new Date(hist.date).getFullYear().toString()}</div>
                            </div>
                            <div className="flex-1 w-full">
                              <div className="flex justify-between items-start mb-1 gap-2">
                                <span className="font-black text-gray-800">{hist.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR</span>
                                <span className="text-[9px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">{hist.reason || t.adjustment}</span>
                              </div>
                              <div className="text-[10px] text-gray-500 grid grid-cols-2 gap-1 mt-1">
                                <span>B: {hist.basicSalary?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <span>H: {hist.housingAllowance?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <span>T: {hist.transportAllowance?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <span>O: {hist.otherAllowances?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      {(!editingEmployee.salaryHistory || editingEmployee.salaryHistory.length === 0) && (
                        <div className="text-center py-12 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-xl">
                          <span className="text-3xl opacity-20 mb-2">📂</span>
                          <span className="text-gray-400 text-sm font-medium italic">No history records found</span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>
              <div className="p-4 bg-gray-50 border-t flex justify-end">
                <button onClick={() => window.print()} className="px-6 py-2 bg-gray-800 text-white font-bold rounded-xl hover:bg-black transition ltr:mr-3 rtl:ml-3 no-print flex items-center gap-2">
                  <span>🖨️</span> {t.print}
                </button>
                <button onClick={() => setIsPreviewModalOpen(false)} className="px-6 py-2 bg-white border font-bold text-gray-600 rounded-xl hover:bg-gray-100 transition">{t.close}</button>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Import Modal */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={(importedEmployees) => {
          importedEmployees.forEach(emp => {
            // Generate ID if missing
            if (!emp.id) emp.id = Math.random().toString(36).substr(2, 9);
            addEmployee(emp);
          });
        }}
        t={t}
        isRtl={isRtl}
      />
    </div>
  );
};

export default EmployeeManagement;
