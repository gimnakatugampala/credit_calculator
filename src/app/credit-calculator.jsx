'use client';

import { useState, useEffect } from 'react';

export default function CreditCalculator() {
  const [semesters, setSemesters] = useState([]);

  // UK degree classification boundaries
  const getClassification = (percentage) => {
    if (percentage >= 70) return { name: 'First Class Honours', color: 'text-green-600' };
    if (percentage >= 60) return { name: 'Upper Second Class (2:1)', color: 'text-blue-600' };
    if (percentage >= 50) return { name: 'Lower Second Class (2:2)', color: 'text-yellow-600' };
    if (percentage >= 40) return { name: 'Third Class Honours', color: 'text-gray-600' };
    return { name: 'Fail', color: 'text-red-600' };
  };

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('ukCreditCalculator');
    if (saved) {
      try {
        setSemesters(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved data:', e);
      }
    } else {
      // Initialize with Year 3 Semester 1 only
      setSemesters([
        { id: Date.now(), name: 'Year 3 Semester 1', modules: [] }
      ]);
    }
  }, []);

  // Save to localStorage whenever semesters change
  useEffect(() => {
    if (semesters.length > 0) {
      localStorage.setItem('ukCreditCalculator', JSON.stringify(semesters));
    }
  }, [semesters]);

  function createNewModule() {
    return {
      id: Date.now() + Math.random(),
      title: '',
      credits: 20,
      mark: ''
    };
  }

  function addSemester() {
    const semesterNames = [
      'Year 3 Semester 1',
      'Year 3 Semester 2', 
      'Year 4 Semester 1',
      'Year 4 Semester 2'
    ];
    
    const nextIndex = semesters.length;
    const nextName = nextIndex < semesterNames.length 
      ? semesterNames[nextIndex]
      : `Semester ${nextIndex + 1}`;
    
    setSemesters([...semesters, {
      id: Date.now(),
      name: nextName,
      modules: []
    }]);
  }

  function addModule(semesterId) {
    setSemesters(semesters.map(sem => 
      sem.id === semesterId 
        ? { ...sem, modules: [...sem.modules, createNewModule()] }
        : sem
    ));
  }

  function updateModule(semesterId, moduleId, field, value) {
    setSemesters(semesters.map(sem =>
      sem.id === semesterId
        ? {
            ...sem,
            modules: sem.modules.map(mod =>
              mod.id === moduleId ? { ...mod, [field]: value } : mod
            )
          }
        : sem
    ));
  }

  function deleteModule(semesterId, moduleId) {
    setSemesters(semesters.map(sem =>
      sem.id === semesterId
        ? { ...sem, modules: sem.modules.filter(mod => mod.id !== moduleId) }
        : sem
    ));
  }

  function deleteSemester(semesterId) {
    setSemesters(semesters.filter(sem => sem.id !== semesterId));
  }

  function updateSemesterName(semesterId, name) {
    setSemesters(semesters.map(sem =>
      sem.id === semesterId ? { ...sem, name } : sem
    ));
  }

  function clearAllData() {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      setSemesters([
        { id: Date.now(), name: 'Year 3 Semester 1', modules: [] }
      ]);
      localStorage.removeItem('ukCreditCalculator');
    }
  }

  // Calculate weighted average
  function calculateWeightedAverage() {
    let totalCredits = 0;
    let weightedSum = 0;

    semesters.forEach(sem => {
      sem.modules.forEach(mod => {
        if (mod.mark !== '' && !isNaN(mod.mark)) {
          const mark = parseFloat(mod.mark);
          const credits = parseInt(mod.credits) || 0;
          weightedSum += mark * credits;
          totalCredits += credits;
        }
      });
    });

    return totalCredits > 0 ? weightedSum / totalCredits : 0;
  }

  const weightedAverage = calculateWeightedAverage();
  const classification = getClassification(weightedAverage);
  const totalCredits = semesters.reduce((sum, sem) => 
    sum + sem.modules.reduce((s, m) => s + (parseInt(m.credits) || 0), 0), 0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxIDAgNiAyLjY5IDYgNnMtMi42OSA2LTYgNi02LTIuNjktNi02IDIuNjktNiA2LTZ6TTI0IDQyYzMuMzEgMCA2IDIuNjkgNiA2cy0yLjY5IDYtNiA2LTYtMi42OS02LTYgMi42OS02IDYtNnoiIHN0cm9rZT0iIzk0YTNiOCIgc3Ryb2tlLXdpZHRoPSIuNSIgb3BhY2l0eT0iLjEiLz48L2c+PC9zdmc+')] opacity-40"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-slate-800 via-blue-900 to-indigo-900 bg-clip-text text-transparent mb-2" 
              style={{ fontFamily: 'Georgia, serif' }}>
            NIBM - Coventry Credit Calculator
          </h1>
          <p className="text-slate-600 text-base font-light">
            Track your weighted credits and degree classification
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Calculator Section - Takes 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Semesters - Only show semesters that exist in state */}
            {semesters.map((semester, idx) => (
              <div key={semester.id} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-slate-200/50 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center justify-between mb-4">
                  <input
                    type="text"
                    value={semester.name}
                    onChange={(e) => updateSemesterName(semester.id, e.target.value)}
                    className="text-xl font-bold text-slate-800 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 rounded-lg px-2 py-1"
                    style={{ fontFamily: 'Georgia, serif' }}
                  />
                  <button
                    onClick={() => deleteSemester(semester.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                    title="Delete semester"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                  {/* Module Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600">Title</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600">Credits</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600">Mark (%)</th>
                          <th className="w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {semester.modules.map((module) => (
                          <tr key={module.id} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={module.title}
                                onChange={(e) => updateModule(semester.id, module.id, 'title', e.target.value)}
                                placeholder="Module Title"
                                className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                value={module.credits}
                                onChange={(e) => updateModule(semester.id, module.id, 'credits', e.target.value)}
                                className="w-20 px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                value={module.mark}
                                onChange={(e) => updateModule(semester.id, module.id, 'mark', e.target.value)}
                                placeholder="0-100"
                                min="0"
                                max="100"
                                className="w-20 px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <button
                                onClick={() => deleteModule(semester.id, module.id)}
                                className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={() => addModule(semester.id)}
                    className="mt-3 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-md flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Module
                  </button>
                </div>
              ))}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={addSemester}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Semester
                </button>
                <button
                  onClick={clearAllData}
                  className="px-6 py-3 bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Summary Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Main Score Card */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-slate-200/50 sticky top-6">
                <div className="text-center mb-6">
                  <div className="inline-block relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 blur-xl opacity-20"></div>
                    <div className="relative bg-gradient-to-br from-white to-blue-50 rounded-2xl p-8 shadow-xl border border-blue-100">
                      <div className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3" style={{ fontFamily: 'Georgia, serif' }}>
                        {weightedAverage.toFixed(1)}%
                      </div>
                      <div className={`text-lg font-semibold mb-1 ${classification.color}`}>
                        {classification.name}
                      </div>
                      <div className="text-slate-500 text-xs">
                        {totalCredits} total credits
                      </div>
                    </div>
                  </div>
                </div>

                {/* Semester Averages - Only show semesters with modules that have marks */}
                {semesters.some(sem => sem.modules.some(m => m.mark !== '' && !isNaN(m.mark))) && (
                  <div className="space-y-3 mb-6">
                    <h3 className="text-sm font-bold text-slate-700 mb-3">Semester Averages</h3>
                    {semesters.map(semester => {
                      const semesterCredits = semester.modules.reduce((sum, m) => sum + (parseInt(m.credits) || 0), 0);
                      const semesterWeightedSum = semester.modules.reduce((sum, m) => {
                        if (m.mark !== '' && !isNaN(m.mark)) {
                          return sum + (parseFloat(m.mark) * (parseInt(m.credits) || 0));
                        }
                        return sum;
                      }, 0);
                      const semesterAverage = semesterCredits > 0 ? semesterWeightedSum / semesterCredits : 0;

                      // Only show semesters that have at least one module with a mark
                      if (semester.modules.some(m => m.mark !== '' && !isNaN(m.mark))) {
                        return (
                          <div key={semester.id} className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl p-3 border border-slate-200">
                            <div className="flex justify-between items-center mb-1">
                              <h4 className="text-sm font-semibold text-slate-700">{semester.name}</h4>
                              <span className="text-lg font-bold text-blue-600">{semesterAverage.toFixed(1)}%</span>
                            </div>
                            <div className="text-xs text-slate-500">{semesterCredits} credits</div>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}

                {/* Classification Guide */}
                <div className="bg-gradient-to-br from-slate-50 to-indigo-50 rounded-xl p-4 border border-slate-200">
                  <h3 className="text-xs font-bold text-slate-700 mb-3">UK Classifications</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="font-medium text-slate-700">First (1st):</span>
                      <span className="text-slate-600">70%+</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="font-medium text-slate-700">Upper 2nd (2:1):</span>
                      <span className="text-slate-600">60-69%</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                      <span className="font-medium text-slate-700">Lower 2nd (2:2):</span>
                      <span className="text-slate-600">50-59%</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                      <span className="font-medium text-slate-700">Third (3rd):</span>
                      <span className="text-slate-600">40-49%</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <span className="font-medium text-slate-700">Fail:</span>
                      <span className="text-slate-600">&lt;40%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}