'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Initialize Supabase client only if credentials are provided
const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const STORAGE_KEY = 'ukCreditCalculator';
const SYNC_QUEUE_KEY = 'ukCreditCalculatorSyncQueue';

export default function CreditCalculator() {
  const [userName, setUserName] = useState('');
  const [userBatch, setUserBatch] = useState('251P');
  const [semesters, setSemesters] = useState([]);
  const [showClearModal, setShowClearModal] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced', 'syncing', 'offline', 'error'
  
  const syncQueueRef = useRef([]);
  const isSyncingRef = useRef(false);

  // UK degree classification boundaries
  const getClassification = (percentage) => {
    if (percentage >= 70) return { name: 'First Class Honours', color: 'text-green-600' };
    if (percentage >= 60) return { name: 'Upper Second Class', color: 'text-blue-600' };
    if (percentage >= 50) return { name: 'Lower Second Class', color: 'text-yellow-600' };
    if (percentage >= 40) return { name: 'Third Class Honours', color: 'text-gray-600' };
    return { name: 'Fail', color: 'text-red-600' };
  };

  // Generate or retrieve user ID for this browser
  const getUserId = () => {
    let id = localStorage.getItem('ukCreditCalculatorUserId');
    if (!id) {
      id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('ukCreditCalculatorUserId', id);
    }
    return id;
  };

  // Load sync queue from localStorage
  const loadSyncQueue = () => {
    try {
      const queue = localStorage.getItem(SYNC_QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('Error loading sync queue:', error);
      return [];
    }
  };

  // Save sync queue to localStorage
  const saveSyncQueue = (queue) => {
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Error saving sync queue:', error);
    }
  };

  // Add operation to sync queue
  const addToSyncQueue = (operation) => {
    const queue = [...syncQueueRef.current, { ...operation, timestamp: Date.now() }];
    syncQueueRef.current = queue;
    saveSyncQueue(queue);
  };

  // Process sync queue
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

          // Remove successfully synced operation from queue
          syncQueueRef.current = syncQueueRef.current.filter(op => op.timestamp !== operation.timestamp);
        } catch (error) {
          console.error('Error processing queue item:', error);
          // Keep the failed operation in queue for retry
          break; // Stop processing on first error
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

  // Save to Supabase (with queue fallback)
  const saveToSupabase = async (data) => {
    if (!supabase) return;

    const operation = {
      type: 'upsert',
      userId: userId,
      data: data
    };

    try {
      // Try immediate sync
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
      // Add to queue for later sync
      addToSyncQueue(operation);
      setSyncStatus('offline');
      setIsOnline(false);
    }
  };

  // Delete from Supabase (with queue fallback)
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
      // Add to queue for later sync
      addToSyncQueue(operation);
      setSyncStatus('offline');
      setIsOnline(false);
    }
  };

  // Save to localStorage (always happens immediately)
  const saveToLocalStorage = (data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  // Load from localStorage on mount
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
        // Initialize with default semester and one empty module
        setSemesters([{
          id: Date.now(),
          name: 'Year 3 Semester 1',
          modules: [{ id: Date.now(), title: '', credits: '', mark: '' }]
        }]);
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      // Initialize with default semester and one empty module on error
      setSemesters([{
        id: Date.now(),
        name: 'Year 3 Semester 1',
        modules: [{ id: Date.now(), title: '', credits: '', mark: '' }]
      }]);
    }

    // Load sync queue
    syncQueueRef.current = loadSyncQueue();

    // Process any pending sync operations
    if (supabase) {
      processSyncQueue();
    }
  }, []);

  // Monitor online status
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

  // Auto-save when data changes
  useEffect(() => {
    if (semesters.length > 0) {
      const data = { userName, userBatch, semesters };
      
      // Always save to localStorage immediately
      saveToLocalStorage(data);
      
      // Try to save to Supabase
      if (userId) {
        saveToSupabase(data);
      }
    }
  }, [userName, userBatch, semesters, userId]);

  // Periodic sync attempt (every 30 seconds)
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
      modules: [{ id: Date.now(), title: '', credits: '', mark: '' }]
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

  const clearAllData = () => {
    setUserName('');
    setUserBatch('251P');
    setSemesters([{
      id: Date.now(),
      name: 'Year 3 Semester 1',
      modules: [{ id: Date.now(), title: '', credits: '', mark: '' }]
    }]);
    
    // Clear localStorage
    localStorage.removeItem(STORAGE_KEY);
    
    // Delete from Supabase
    if (userId) {
      deleteFromSupabase();
    }
    
    setShowClearModal(false);
  };

  const calculateWeightedAverage = () => {
    let totalCredits = 0;
    let weightedSum = 0;

    semesters.forEach(semester => {
      semester.modules.forEach(module => {
        const credits = parseInt(module.credits) || 0;
        const mark = parseFloat(module.mark);
        
        if (!isNaN(mark) && mark !== '' && credits > 0) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
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
                            className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Credits</label>
                            <input
                              type="number"
                              value={module.credits}
                              onChange={(e) => updateModule(semester.id, module.id, 'credits', e.target.value)}
                              className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
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
                              className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
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

                <button
                  onClick={() => addModule(semester.id)}
                  className="mt-3 w-full sm:w-auto px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg md:rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-md flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Module
                </button>
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
            {/* Main Score Card */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-lg p-4 md:p-6 border border-slate-200/50 lg:sticky lg:top-6">
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
                    {/* Progress circle */}
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
                  </svg>
                  {/* Text overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
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
                  </div>
                </div>
                <div className="text-slate-500 text-xs mt-4">
                  {totalCredits} total credits
                </div>
              </div>

              {/* Semester Averages */}
              {semesters.some(sem => sem.modules.some(m => m.mark !== '' && !isNaN(m.mark))) && (
                <div className="space-y-2 md:space-y-3 mb-4 md:mb-6">
                  <h3 className="text-xs md:text-sm font-bold text-slate-700 mb-2 md:mb-3">Semester Averages</h3>
                  {semesters.map(semester => {
                    const semesterCredits = semester.modules.reduce((sum, m) => sum + (parseInt(m.credits) || 0), 0);
                    const semesterWeightedSum = semester.modules.reduce((sum, m) => {
                      if (m.mark !== '' && !isNaN(m.mark)) {
                        return sum + (parseFloat(m.mark) * (parseInt(m.credits) || 0));
                      }
                      return sum;
                    }, 0);
                    const semesterAverage = semesterCredits > 0 ? semesterWeightedSum / semesterCredits : 0;

                    if (semester.modules.some(m => m.mark !== '' && !isNaN(m.mark))) {
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