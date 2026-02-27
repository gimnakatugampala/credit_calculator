'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const STORAGE_KEY = 'ukCreditCalculator';
const SYNC_QUEUE_KEY = 'ukCreditCalculatorSyncQueue';
const ONBOARDING_KEY = 'ukCreditCalculatorOnboarded';

const BSC_COMPUTING_MODULES = [
  {
    id: 'bsc-sem-1',
    name: 'Year 3 Semester 1',
    modules: [
      { id: 'bsc-1-1', title: 'Agile', credits: '20', mark: '' },
      { id: 'bsc-1-2', title: 'User Experience Designing', credits: '20', mark: '' },
      { id: 'bsc-1-3', title: 'Programming, Data Structures and Algorithms-2', credits: '20', mark: '' },
    ]
  },
  {
    id: 'bsc-sem-2',
    name: 'Year 3 Semester 2',
    modules: [
      { id: 'bsc-2-1', title: 'Technology and Its Social, Legal and Ethical Context', credits: '10', mark: '' },
      { id: 'bsc-2-2', title: 'Cyber Security', credits: '20', mark: '' },
      { id: 'bsc-2-3', title: 'Data Science', credits: '20', mark: '' },
      { id: 'bsc-2-4', title: 'Effective Communication Skills', credits: '10', mark: '' },
    ]
  },
  {
    id: 'bsc-sem-3',
    name: 'Year 4 Semester 1',
    modules: [
      { id: 'bsc-3-1', title: 'Web API Development', credits: '20', mark: '' },
      { id: 'bsc-3-2', title: 'Project Discovery', credits: '20', mark: '' },
      { id: 'bsc-3-3', title: 'IOS Development', credits: '20', mark: '' },
    ]
  },
  {
    id: 'bsc-sem-4',
    name: 'Year 4 Semester 2',
    modules: [
      { id: 'bsc-4-1', title: 'Computer Vision', credits: '20', mark: '' },
      { id: 'bsc-4-2', title: 'Artificial Intelligence', credits: '10', mark: '' },
      { id: 'bsc-4-3', title: 'Dissertation and Project Artefact', credits: '30', mark: '' },
    ]
  },
];

export default function CreditCalculator() {
  const [userName, setUserName] = useState('');
  const [userBatch, setUserBatch] = useState('251P');
  const [semesters, setSemesters] = useState([]);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showClassGuide, setShowClassGuide] = useState(false);
  const [isBscMode, setIsBscMode] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState('synced');
  
  const syncQueueRef = useRef([]);
  const isSyncingRef = useRef(false);
  const onboardingPendingRef = useRef(false);

  const getClassification = (percentage) => {
    if (percentage >= 70) return { name: 'First Class Honours', color: 'text-green-600' };
    if (percentage >= 60) return { name: 'Upper Second Class', color: 'text-blue-600' };
    if (percentage >= 50) return { name: 'Lower Second Class', color: 'text-yellow-600' };
    if (percentage >= 40) return { name: 'Third Class Honours', color: 'text-gray-600' };
    return { name: 'Fail', color: 'text-red-600' };
  };

  const getUserId = () => {
    let id = localStorage.getItem('ukCreditCalculatorUserId');
    if (!id) {
      id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('ukCreditCalculatorUserId', id);
    }
    return id;
  };

  const loadSyncQueue = () => {
    try {
      const queue = localStorage.getItem(SYNC_QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('Error loading sync queue:', error);
      return [];
    }
  };

  const saveSyncQueue = (queue) => {
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Error saving sync queue:', error);
    }
  };

  const addToSyncQueue = (operation) => {
    const queue = [...syncQueueRef.current, { ...operation, timestamp: Date.now() }];
    syncQueueRef.current = queue;
    saveSyncQueue(queue);
  };

  const processSyncQueue = async () => {
    if (!supabase || isSyncingRef.current || syncQueueRef.current.length === 0) {
      return;
    }

    isSyncingRef.current = true;
    setSyncStatus('syncing');

    try {
      const queue = [...syncQueueRef.current];
      
      for (const operation of queue) {
        try {
          switch (operation.type) {
            case 'upsert':
              await supabase
                .from('calculator_data')
                .upsert({
                  user_id: operation.userId,
                  data: operation.data,
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'user_id'
                });
              break;

            case 'delete':
              await supabase
                .from('calculator_data')
                .delete()
                .eq('user_id', operation.userId);
              break;

            default:
              console.warn('Unknown operation type:', operation.type);
          }

          syncQueueRef.current = syncQueueRef.current.filter(op => op.timestamp !== operation.timestamp);
        } catch (error) {
          console.error('Error processing queue item:', error);
          break;
        }
      }

      saveSyncQueue(syncQueueRef.current);
      
      if (syncQueueRef.current.length === 0) {
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    } catch (error) {
      console.error('Error processing sync queue:', error);
      setSyncStatus('error');
    } finally {
      isSyncingRef.current = false;
    }
  };

  const saveToSupabase = async (data) => {
    if (!supabase) return;

    const operation = {
      type: 'upsert',
      userId: userId,
      data: data
    };

    try {
      await supabase
        .from('calculator_data')
        .upsert({
          user_id: userId,
          data: data,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });
      
      setSyncStatus('synced');
    } catch (error) {
      console.error('Error saving to Supabase:', error);
      addToSyncQueue(operation);
      setSyncStatus('offline');
      setIsOnline(false);
    }
  };

  const deleteFromSupabase = async () => {
    if (!supabase) return;

    const operation = {
      type: 'delete',
      userId: userId
    };

    try {
      await supabase
        .from('calculator_data')
        .delete()
        .eq('user_id', userId);
      
      setSyncStatus('synced');
    } catch (error) {
      console.error('Error deleting from Supabase:', error);
      addToSyncQueue(operation);
      setSyncStatus('offline');
      setIsOnline(false);
    }
  };

  const saveToLocalStorage = (data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  useEffect(() => {
    const id = getUserId();
    setUserId(id);

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        setUserName(data.userName || '');
        setUserBatch(data.userBatch || '251P');
        setSemesters(data.semesters || []);
      } else {
        // First time visitor - show onboarding
        // Do NOT pre-set semesters here; wait until user answers so we don't accidentally save to localStorage
        onboardingPendingRef.current = true;
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      setSemesters([{
        id: Date.now(),
        name: 'Year 3 Semester 1',
        modules: [{ id: Date.now() + 1, title: '', credits: '', mark: '' }]
      }]);
    }

    syncQueueRef.current = loadSyncQueue();

    if (supabase) {
      processSyncQueue();
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (supabase && syncQueueRef.current.length > 0) {
        processSyncQueue();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Don't save anything until the user has answered the onboarding question
    if (onboardingPendingRef.current) return;
    if (semesters.length > 0) {
      const data = { userName, userBatch, semesters };
      saveToLocalStorage(data);
      if (userId) {
        saveToSupabase(data);
      }
    }
  }, [userName, userBatch, semesters, userId]);

  useEffect(() => {
    if (!supabase) return;

    const interval = setInterval(() => {
      if (syncQueueRef.current.length > 0 && isOnline) {
        processSyncQueue();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isOnline]);

  const addSemester = () => {
    const newSemester = {
      id: Date.now(),
      name: `Year ${Math.ceil((semesters.length + 1) / 2)} Semester ${(semesters.length % 2) + 1}`,
      modules: []
    };
    setSemesters([...semesters, newSemester]);
  };

  const deleteSemester = (semesterId) => {
    setSemesters(semesters.filter(sem => sem.id !== semesterId));
  };

  const updateSemesterName = (semesterId, newName) => {
    setSemesters(semesters.map(sem =>
      sem.id === semesterId ? { ...sem, name: newName } : sem
    ));
  };

  const addModule = (semesterId) => {
    setSemesters(semesters.map(sem => {
      if (sem.id === semesterId) {
        return {
          ...sem,
          modules: [...sem.modules, { id: Date.now(), title: '', credits: '', mark: '' }]
        };
      }
      return sem;
    }));
  };

  const deleteModule = (semesterId, moduleId) => {
    setSemesters(semesters.map(sem => {
      if (sem.id === semesterId) {
        return {
          ...sem,
          modules: sem.modules.filter(mod => mod.id !== moduleId)
        };
      }
      return sem;
    }));
  };

  const updateModule = (semesterId, moduleId, field, value) => {
    setSemesters(semesters.map(sem => {
      if (sem.id === semesterId) {
        return {
          ...sem,
          modules: sem.modules.map(mod =>
            mod.id === moduleId ? { ...mod, [field]: value } : mod
          )
        };
      }
      return sem;
    }));
  };

  const handleBscYes = () => {
    onboardingPendingRef.current = false;
    setSemesters(BSC_COMPUTING_MODULES);
    setIsBscMode(true);
    setShowOnboarding(false);
  };

  const handleBscNo = () => {
    onboardingPendingRef.current = false;
    setSemesters([{
      id: Date.now(),
      name: 'Year 3 Semester 1',
      modules: [{ id: Date.now() + 1, title: '', credits: '', mark: '' }]
    }]);
    setIsBscMode(false);
    setShowOnboarding(false);
  };

  const clearAllData = () => {
    setUserName('');
    setUserBatch('251P');
    setSemesters([{
      id: Date.now(),
      name: 'Year 3 Semester 1',
      modules: [{ id: Date.now() + 1, title: '', credits: '', mark: '' }]
    }]);
    
    localStorage.removeItem(STORAGE_KEY);
    
    if (userId) {
      deleteFromSupabase();
    }
    
    setShowClearModal(false);
  };

  // Only include modules that have a mark explicitly entered (not empty string)
  const hasValidMark = (module) => {
    return module.mark !== '' && module.mark !== null && module.mark !== undefined && !isNaN(parseFloat(module.mark));
  };

  const calculateWeightedAverage = () => {
    let totalCredits = 0;
    let weightedSum = 0;

    semesters.forEach(semester => {
      semester.modules.forEach(module => {
        const credits = parseInt(module.credits) || 0;
        // Only calculate if mark has been explicitly entered
        if (hasValidMark(module) && credits > 0) {
          const mark = parseFloat(module.mark);
          totalCredits += credits;
          weightedSum += mark * credits;
        }
      });
    });

    return totalCredits > 0 ? weightedSum / totalCredits : 0;
  };

  const weightedAverage = calculateWeightedAverage();
  const classification = getClassification(weightedAverage);
  const totalCredits = semesters.reduce((sum, sem) => 
    sum + sem.modules.reduce((s, m) => s + (parseInt(m.credits) || 0), 0), 0
  );

  // Only count credits from modules that have marks entered
  const gradedCredits = semesters.reduce((sum, sem) => 
    sum + sem.modules.reduce((s, m) => s + (hasValidMark(m) ? (parseInt(m.credits) || 0) : 0), 0), 0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        input[type=number] { 
          -moz-appearance: textfield;
        }
        input[type=number]:focus {
          pointer-events: auto;
        }
      `}</style>
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxIDAgNiAyLjY5IDYgNnMtMi42OSA2LTYgNi02LTIuNjktNi02IDIuNjktNiA2LTZ6TTI0IDQyYzMuMzEgMCA2IDIuNjkgNiA2cy0yLjY5IDYtNiA2LTYtMi42OS02LTYgMi42OS02IDYtNnoiIHN0cm9rZT0iIzk0YTNiOCIgc3Ryb2tlLXdpZHRoPSIuNSIgb3BhY2l0eT0iLjEiLz48L2c+PC9zdmc+')] opacity-40"></div>
      
      <div className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-12">
        {/* Header */}
        <div className="mb-6 md:mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-slate-800 via-blue-900 to-indigo-900 bg-clip-text text-transparent mb-2" 
              style={{ fontFamily: 'Georgia, serif' }}>
            NIBM - Coventry Credit Calculator
          </h1>
          <p className="text-slate-600 text-sm md:text-base font-light px-4">
            Track your weighted credits and degree classification
          </p>
          {isBscMode && (
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 bg-blue-100 border border-blue-200 rounded-full">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="text-xs font-semibold text-blue-700">BSc Computing — Modules Pre-loaded</span>
            </div>
          )}
        </div>

        {/* User Info Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-lg p-4 md:p-6 border border-slate-200/50 mb-4 md:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-xs md:text-sm font-semibold text-slate-700 mb-1 md:mb-2">
                Student Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 text-sm md:text-base text-slate-800 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-semibold text-slate-700 mb-1 md:mb-2">
                Batch
              </label>
              <input
                type="text"
                value={userBatch}
                onChange={(e) => setUserBatch(e.target.value)}
                placeholder="e.g., 251P"
                className="w-full px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 text-sm md:text-base text-slate-800 bg-white"
              />
            </div>
          </div>
        </div>

        {/* Mobile Score Card - shown only on mobile, between user info and modules */}
        <div className="lg:hidden bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-slate-200/50 mb-4">
          <div className="flex items-center gap-4">
            {/* Circular Progress - compact for mobile */}
            <div className="relative flex-shrink-0">
              <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="70" fill="none" stroke="#e5e7eb" strokeWidth="14" />
                {gradedCredits > 0 && (
                  <circle
                    cx="80" cy="80" r="70" fill="none"
                    stroke={
                      weightedAverage >= 70 ? '#16a34a' :
                      weightedAverage >= 60 ? '#2563eb' :
                      weightedAverage >= 50 ? '#ca8a04' :
                      weightedAverage >= 40 ? '#6b7280' : '#dc2626'
                    }
                    strokeWidth="14" strokeLinecap="round"
                    strokeDasharray={`${(weightedAverage / 100) * 440} 440`}
                    className="transition-all duration-1000 ease-out"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {gradedCredits > 0 ? (
                  <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent" style={{ fontFamily: 'Georgia, serif' }}>
                    {weightedAverage.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-xl font-bold text-slate-300">—</span>
                )}
              </div>
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              {gradedCredits > 0 ? (
                <>
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Weighted Average</div>
                  <button
                    onClick={() => setShowClassGuide(v => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2 ${
                      classification.color === 'text-green-600' ? 'bg-green-50 border border-green-200 text-green-700' :
                      classification.color === 'text-blue-600' ? 'bg-blue-50 border border-blue-200 text-blue-700' :
                      classification.color === 'text-yellow-600' ? 'bg-yellow-50 border border-yellow-200 text-yellow-700' :
                      classification.color === 'text-gray-600' ? 'bg-gray-50 border border-gray-200 text-gray-700' :
                      'bg-red-50 border border-red-200 text-red-700'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                      classification.color === 'text-green-600' ? 'bg-green-500' :
                      classification.color === 'text-blue-600' ? 'bg-blue-500' :
                      classification.color === 'text-yellow-600' ? 'bg-yellow-500' :
                      classification.color === 'text-gray-600' ? 'bg-gray-500' : 'bg-red-500'
                    }`}></div>
                    {classification.name}
                    <svg className={`w-3 h-3 ml-0.5 transition-transform duration-200 ${showClassGuide ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="text-xs text-slate-500 mb-2">{gradedCredits} of {totalCredits} credits</div>
                  {/* Expandable classification guide */}
                  {showClassGuide && (
                    <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="text-xs font-bold text-slate-600 mb-2">UK Honours Classifications</div>
                      {[
                        { color: 'bg-green-500', label: 'First Class', range: '70%+', active: weightedAverage >= 70 },
                        { color: 'bg-blue-500', label: 'Upper Second', range: '60–69%', active: weightedAverage >= 60 && weightedAverage < 70 },
                        { color: 'bg-yellow-500', label: 'Lower Second', range: '50–59%', active: weightedAverage >= 50 && weightedAverage < 60 },
                        { color: 'bg-gray-400', label: 'Third Class', range: '40–49%', active: weightedAverage >= 40 && weightedAverage < 50 },
                        { color: 'bg-red-500', label: 'Fail', range: '<40%', active: weightedAverage < 40 },
                      ].map(({ color, label, range, active }) => (
                        <div key={label} className={`flex items-center justify-between text-xs px-2 py-1 rounded-lg ${active ? 'bg-white border border-slate-300 font-semibold' : ''}`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`}></div>
                            <span className="text-slate-700">{label}</span>
                            {active && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold">You</span>}
                          </div>
                          <span className="text-slate-500">{range}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-sm font-semibold text-slate-600 mb-1">Enter marks to see your average</div>
                  <div className="text-xs text-slate-400">{totalCredits} total credits</div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          {/* Calculator Section - Takes 2 columns */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Semesters */}
            {semesters.map((semester, idx) => (
              <div key={semester.id} className="bg-white/80 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-lg p-4 md:p-6 border border-slate-200/50 hover:shadow-xl transition-shadow duration-300">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <input
                    type="text"
                    value={semester.name}
                    onChange={(e) => updateSemesterName(semester.id, e.target.value)}
                    className="text-lg md:text-xl font-bold text-slate-800 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 rounded-lg px-2 py-1 flex-1 mr-2"
                    style={{ fontFamily: 'Georgia, serif' }}
                  />
                  <button
                    onClick={() => deleteSemester(semester.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 md:p-2 rounded-lg transition-colors flex-shrink-0"
                    title="Delete semester"
                  >
                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {semester.modules.length === 0 ? (
                  <p className="text-slate-400 text-sm italic py-4 text-center">No modules added yet</p>
                ) : (
                  <>
                  {/* Module Table - Desktop */}
                  <div className="hidden sm:block overflow-x-auto">
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
                                
                                className={`w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500`}
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                value={module.credits}
                                onChange={(e) => updateModule(semester.id, module.id, 'credits', e.target.value)}
                                onWheel={(e) => e.currentTarget.blur()}
                                className={`w-20 px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500`}
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                value={module.mark}
                                onChange={(e) => updateModule(semester.id, module.id, 'mark', e.target.value)}
                                onWheel={(e) => e.currentTarget.blur()}
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

                  {/* Module Cards - Mobile */}
                  <div className="sm:hidden space-y-3">
                    {semester.modules.map((module) => (
                      <div key={module.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Title</label>
                            <input
                              type="text"
                              value={module.title}
                              onChange={(e) => updateModule(semester.id, module.id, 'title', e.target.value)}
                              placeholder="Module Title"
                              
                              className={`w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 text-black placeholder:text-slate-400`}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Credits</label>
                              <input
                                type="number"
                                value={module.credits}
                                onChange={(e) => updateModule(semester.id, module.id, 'credits', e.target.value)}
                                
                                onWheel={(e) => e.currentTarget.blur()}
                                className={`w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 text-black placeholder:text-slate-400`}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Mark (%)</label>
                              <input
                                type="number"
                                value={module.mark}
                                onChange={(e) => updateModule(semester.id, module.id, 'mark', e.target.value)}
                                placeholder="0-100"
                                min="0"
                                max="100"
                                onWheel={(e) => e.currentTarget.blur()}
                                className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 text-black placeholder:text-slate-400"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => deleteModule(semester.id, module.id)}
                            className="w-full text-red-500 hover:text-red-700 hover:bg-red-50 py-2 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete Module
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  </>
                )}

                  {!isBscMode && (
                  <button
                    onClick={() => addModule(semester.id)}
                    className="mt-3 w-full sm:w-auto px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg md:rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-md flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Module
                  </button>
                  )}
                </div>
              ))}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={addSemester}
                  className="px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Semester
                </button>
                <button
                  onClick={() => setShowClearModal(true)}
                  className="px-4 md:px-6 py-2.5 md:py-3 bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Summary Sidebar */}
            <div className="lg:col-span-1 space-y-4 md:space-y-6">
              {/* Main Score Card - hidden on mobile, shown in desktop sidebar */}
              <div className="hidden lg:block bg-white/80 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-lg p-4 md:p-6 border border-slate-200/50 lg:sticky lg:top-6">
                {/* Student Info Display */}
                {(userName || userBatch !== '251P') && (
                  <div className="mb-4 md:mb-6 pb-4 md:pb-6 border-b border-slate-200">
                    {userName && (
                      <div className="text-center mb-2">
                        <div className="text-base md:text-lg font-bold text-slate-800" style={{ fontFamily: 'Georgia, serif' }}>
                          {userName}
                        </div>
                      </div>
                    )}
                    <div className="text-center">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs md:text-sm font-semibold">
                        Batch {userBatch}
                      </span>
                    </div>
                  </div>
                )}

                <div className="text-center mb-4 md:mb-6">
                  <div className="inline-block relative">
                    {/* Circular Progress Bar */}
                    <svg className="w-40 h-40 md:w-48 md:h-48 transform -rotate-90" viewBox="0 0 160 160">
                      {/* Background circle */}
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="12"
                      />
                      {/* Progress circle - only shows when there are graded credits */}
                      {gradedCredits > 0 && (
                        <circle
                          cx="80"
                          cy="80"
                          r="70"
                          fill="none"
                          stroke={
                            weightedAverage >= 70 ? '#16a34a' :
                            weightedAverage >= 60 ? '#2563eb' :
                            weightedAverage >= 50 ? '#ca8a04' :
                            weightedAverage >= 40 ? '#6b7280' :
                            '#dc2626'
                          }
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={`${(weightedAverage / 100) * 440} 440`}
                          className="transition-all duration-1000 ease-out"
                        />
                      )}
                    </svg>
                    {/* Text overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      {gradedCredits > 0 ? (
                        <>
                          <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-1" style={{ fontFamily: 'Georgia, serif' }}>
                            {weightedAverage.toFixed(2)}%
                          </div>
                          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                            Weighted Average
                          </div>
                          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                            classification.color === 'text-green-600' ? 'bg-green-50 border border-green-200' :
                            classification.color === 'text-blue-600' ? 'bg-blue-50 border border-blue-200' :
                            classification.color === 'text-yellow-600' ? 'bg-yellow-50 border border-yellow-200' :
                            classification.color === 'text-gray-600' ? 'bg-gray-50 border border-gray-200' :
                            'bg-red-50 border border-red-200'
                          }`}>
                            <div className={`w-2 h-2 rounded-full ${
                              classification.color === 'text-green-600' ? 'bg-green-500 animate-pulse' :
                              classification.color === 'text-blue-600' ? 'bg-blue-500 animate-pulse' :
                              classification.color === 'text-yellow-600' ? 'bg-yellow-500 animate-pulse' :
                              classification.color === 'text-gray-600' ? 'bg-gray-500 animate-pulse' :
                              'bg-red-500 animate-pulse'
                            }`}></div>
                            <span className={`text-xs md:text-sm font-bold ${classification.color}`}>
                              {classification.name}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-2xl md:text-3xl font-bold text-slate-300 mb-1" style={{ fontFamily: 'Georgia, serif' }}>
                            —
                          </div>
                          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider text-center px-4">
                            Enter marks to see your average
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-slate-500 text-xs mt-4">
                    {gradedCredits > 0
                      ? `${gradedCredits} of ${totalCredits} credits`
                      : `${totalCredits} total credits`
                    }
                  </div>
                </div>

                {/* Semester Averages - only show semesters with at least one mark entered */}
                {semesters.some(sem => sem.modules.some(m => hasValidMark(m))) && (
                  <div className="space-y-2 md:space-y-3 mb-4 md:mb-6">
                    <h3 className="text-xs md:text-sm font-bold text-slate-700 mb-2 md:mb-3">Semester Averages</h3>
                    {semesters.map(semester => {
                      // Only count modules that have marks entered
                      const gradedModules = semester.modules.filter(m => hasValidMark(m) && (parseInt(m.credits) || 0) > 0);
                      const semesterCredits = gradedModules.reduce((sum, m) => sum + (parseInt(m.credits) || 0), 0);
                      const semesterWeightedSum = gradedModules.reduce((sum, m) => {
                        return sum + (parseFloat(m.mark) * (parseInt(m.credits) || 0));
                      }, 0);
                      const semesterAverage = semesterCredits > 0 ? semesterWeightedSum / semesterCredits : 0;

                      if (gradedModules.length > 0) {
                        return (
                          <div key={semester.id} className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg md:rounded-xl p-2.5 md:p-3 border border-slate-200">
                            <div className="flex justify-between items-center mb-1">
                              <h4 className="text-xs md:text-sm font-semibold text-slate-700">{semester.name}</h4>
                              <span className="text-base md:text-lg font-bold text-blue-600">{semesterAverage.toFixed(1)}%</span>
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
                <div className="bg-gradient-to-br from-slate-50 to-indigo-50 rounded-lg md:rounded-xl p-3 md:p-4 border border-slate-200">
                  <h3 className="text-xs font-bold text-slate-700 mb-2 md:mb-3">UK Honours Classifications</h3>
                  <div className="space-y-1.5 md:space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></div>
                      <span className="font-medium text-slate-700">First Class:</span>
                      <span className="text-slate-600">70%+</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                      <span className="font-medium text-slate-700">Upper Second Class:</span>
                      <span className="text-slate-600">60-69%</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0"></div>
                      <span className="font-medium text-slate-700">Lower Second Class:</span>
                      <span className="text-slate-600">50-59%</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-gray-500 flex-shrink-0"></div>
                      <span className="font-medium text-slate-700">Third Class:</span>
                      <span className="text-slate-600">40-49%</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></div>
                      <span className="font-medium text-slate-700">Fail:</span>
                      <span className="text-slate-600">&lt;40%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </div>

      {/* Onboarding Modal */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all animate-in">
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              </div>
            </div>

            <h2 className="text-xl font-bold text-slate-800 text-center mb-2" style={{ fontFamily: 'Georgia, serif' }}>
              Welcome to NIBM Credit Calculator
            </h2>
            <p className="text-slate-500 text-sm text-center mb-4">
              Are you a <span className="font-semibold text-blue-600">BSc Computing</span> student at NIBM?
            </p>

            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 mb-3">
              <p className="text-xs text-blue-700 text-center">
                ✓ If yes, we'll pre-load all your modules and credits — you just need to enter your marks!
              </p>
            </div>

            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 mb-5">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-amber-700 leading-relaxed">
                  <span className="font-bold">Ethical Hacking</span> or <span className="font-bold">Business IT</span> student? Please select <span className="font-bold">"No"</span> — your programme has a different module structure, so you'll enter your modules manually.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleBscYes}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Yes, I'm a BSc Computing Student
              </button>
              <button
                onClick={handleBscNo}
                className="w-full px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors duration-200"
              >
                No, load the default calculator
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Data Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl md:rounded-2xl shadow-2xl max-w-md w-full p-5 md:p-6 transform transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 md:w-6 md:h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-bold text-slate-800">Clear All Data?</h3>
              </div>
            </div>
            
            <p className="text-sm md:text-base text-slate-600 mb-5 md:mb-6">
              This will permanently delete all your modules, marks, and student information from both local storage and cloud backup. This action cannot be undone.
            </p>
            
            <div className="flex flex-col-reverse sm:flex-row gap-2 md:gap-3">
              <button
                onClick={() => setShowClearModal(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg md:rounded-xl font-semibold transition-colors text-sm md:text-base"
              >
                Cancel
              </button>
              <button
                onClick={clearAllData}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg md:rounded-xl font-semibold transition-colors text-sm md:text-base"
              >
                Clear All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}