import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Employee, EmployeeStatus } from '../types';

interface ExcelImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (employees: any[]) => void;
    t: any;
    isRtl: boolean;
}

interface ColumnMapping {
    systemField: string;
    excelColumn: string;
}

const SYSTEM_FIELDS = [
    { key: 'employeeNumber', label: 'employeeNumber', required: true },
    { key: 'name', label: 'name', required: true },
    { key: 'jobTitle', label: 'jobTitle', required: true },
    { key: 'basicSalary', label: 'basicSalary', required: false }, // Optional
    { key: 'housingAllowance', label: 'housing', required: false },
    { key: 'transportAllowance', label: 'transport', required: false },
    { key: 'otherAllowances', label: 'other', required: false },
    { key: 'totalSalary', label: 'salaryInputHelper', required: false }, // Added Total Salary
    { key: 'hireDate', label: 'hireDate', required: true },
];

const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ isOpen, onClose, onImport, t, isRtl }) => {
    const [file, setFile] = useState<File | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [step, setStep] = useState<1 | 2>(1); // 1: Upload, 2: Map
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            readExcel(selectedFile);
        }
    };

    const readExcel = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const bstr = e.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                if (data.length > 0) {
                    const loadedHeaders = (data[0] as string[]).map(h => String(h).trim());
                    setHeaders(loadedHeaders);
                    setPreviewData(data.slice(1, 6)); // Preview 5 rows

                    // Auto-map if headers match
                    const initialMapping: Record<string, string> = {};
                    SYSTEM_FIELDS.forEach(field => {
                        const match = loadedHeaders.find(h =>
                            h.toLowerCase() === t[field.label]?.toLowerCase() ||
                            h.toLowerCase() === field.key.toLowerCase()
                        );
                        if (match) initialMapping[field.key] = match;
                    });
                    setMapping(initialMapping);

                    setStep(2);
                    setError(null);
                } else {
                    setError(t.emptyFileError || "The file appears to be empty.");
                }
            } catch (err) {
                console.error(err);
                setError(t.fileReadError || "Error reading file. Please ensure it is a valid Excel file.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleImport = () => {
        if (!file) return;

        // Custom validation: Require Basic Salary OR Total Salary
        const hasBasic = !!mapping['basicSalary'];
        const hasTotal = !!mapping['totalSalary'];

        if (!hasBasic && !hasTotal) {
            setError(t.salaryRequiredError || "Please map either Basic Salary or Total Salary.");
            return;
        }

        // Validate other required fields
        const missingRequired = SYSTEM_FIELDS.filter(f => f.required && !mapping[f.key]);
        if (missingRequired.length > 0) {
            setError(`${t.missingFieldsError || "Please map the following required fields:"} ${missingRequired.map(f => t[f.label]).join(', ')}`);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const bstr = e.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws); // Read as dicts now

            const processedEmployees = data.map((row: any) => {
                const emp: any = {
                    status: EmployeeStatus.ACTIVE,
                    salaryHistory: []
                };

                // Map fields
                Object.entries(mapping).forEach(([sysKey, excelHeader]) => {
                    let val = (row as any)[excelHeader];

                    // Handle Dates
                    if (sysKey === 'hireDate' && typeof val === 'number') {
                        // Excel date serial to JS Date
                        const date = new Date((val - (25567 + 2)) * 86400 * 1000);
                        val = date.toISOString().split('T')[0];
                    }

                    // Handle Numbers - Aggressive parsing (strip everything except digits and dot)
                    if (['basicSalary', 'housingAllowance', 'transportAllowance', 'otherAllowances', 'totalSalary'].includes(sysKey)) {
                        if (typeof val === 'string') {
                            // Remove all non-numeric chars except dot
                            const cleanVal = val.replace(/[^0-9.]/g, '');
                            val = parseFloat(cleanVal) || 0;
                        } else {
                            val = Number(val) || 0;
                        }
                    }

                    emp[sysKey] = val;
                });

                // Auto-calculate breakdown if Total Salary is provided but Basic is missing or 0
                if (emp.totalSalary > 0 && (!emp.basicSalary || emp.basicSalary === 0)) {
                    const total = emp.totalSalary;
                    // Formula: Basic approx 60-70%? 
                    // User specified: Basic = Total / 1.35
                    // Housing = Basic * 0.25 (which is 25% of basic)
                    // Transport = Remainder

                    emp.basicSalary = Number((total / 1.35).toFixed(2));
                    emp.housingAllowance = Number((emp.basicSalary * 0.25).toFixed(2));
                    emp.transportAllowance = Number((total - emp.basicSalary - emp.housingAllowance).toFixed(2));
                }

                // Clean up temporary field to avoid pollution if not needed downstream
                delete emp.totalSalary;

                // Default logic
                emp.basicSalary = emp.basicSalary || 0;
                emp.housingAllowance = emp.housingAllowance || 0;
                emp.transportAllowance = emp.transportAllowance || 0;
                emp.otherAllowances = emp.otherAllowances || 0;

                // Create initial salary history with CALCULATION DATE override to ensure it takes immediately
                // We use hireDate as the base date.
                const historyTotal = emp.basicSalary + emp.housingAllowance + emp.transportAllowance + emp.otherAllowances;
                emp.salaryHistory = [{
                    date: emp.hireDate || new Date().toISOString().split('T')[0],
                    basicSalary: emp.basicSalary,
                    housingAllowance: emp.housingAllowance,
                    transportAllowance: emp.transportAllowance,
                    otherAllowances: emp.otherAllowances,
                    total: historyTotal,
                    reason: t.openingBalance || 'Opening Balance'
                }];

                return emp;
            });

            onImport(processedEmployees);
            onClose();
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-xl font-black text-gray-800">{t.importExcel || "Import from Excel"}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">✕</button>
                </div>

                <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm font-bold">
                            {error}
                        </div>
                    )}

                    {step === 1 && (
                        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 hover:bg-gray-100 transition cursor-pointer relative">
                            <input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleFileUpload}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            <div className="text-5xl mb-4">📂</div>
                            <p className="font-bold text-gray-500">{t.clickToUpload || "Click to upload Excel file"}</p>
                            <p className="text-xs text-gray-400 mt-2">.xlsx, .xls, .csv</p>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                                <p className="text-blue-800 text-xs font-bold leading-relaxed">
                                    {t.mappingInstruction || "Please map the columns from your Excel file to the system fields."}
                                </p>
                            </div>

                            <div className="space-y-3">
                                {SYSTEM_FIELDS.map(field => (
                                    <div key={field.key} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <div className="w-1/3">
                                            <span className="text-xs font-black text-gray-500 uppercase">{t[field.label]}</span>
                                            {field.required && <span className="text-red-500 ml-1">*</span>}
                                        </div>
                                        <div className="flex-1 text-2xl font-bold text-gray-300">→</div>
                                        <div className="w-1/2">
                                            <select
                                                value={mapping[field.key] || ''}
                                                onChange={(e) => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none"
                                            >
                                                <option value="">{t.selectColumn || "Select Column"}</option>
                                                {headers.map(h => (
                                                    <option key={h} value={h}>{h}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t bg-gray-50 rounded-b-3xl flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition">
                        {t.cancel}
                    </button>
                    {step === 2 && (
                        <button
                            onClick={handleImport}
                            className="px-8 py-2 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition shadow-lg shadow-green-100"
                        >
                            {t.importData || "Import Data"}
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};

export default ExcelImportModal;
