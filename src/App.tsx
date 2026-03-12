/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { supabase, type Novel, type Chapter } from './supabase';
import { 
  Plus, 
  Book, 
  ChevronLeft, 
  BookOpen, 
  Loader2,
  Lock,
  LogIn,
  LogOut,
  RefreshCw,
  Database,
  WifiOff
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { NovelList } from './components/NovelList';
import { NovelDetail } from './components/NovelDetail';
import { BackupManager } from './components/BackupManager';
import pkg from '../package.json';

const APP_VERSION = pkg.version;

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('app_authenticated') === 'true';
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  // Version Check Logic
  useEffect(() => {
    document.title = 'مستودع الروايات';
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '041994') {
      setIsAuthenticated(true);
      localStorage.setItem('app_authenticated', 'true');
      setError(false);
    } else {
      setError(true);
      setPassword('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden"
        >
          <div className="p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl shadow-emerald-200">
              <Lock size={40} />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-stone-900">مستودع الروايات</h1>
              <p className="text-stone-500 font-medium">يرجى إدخال كلمة السر للوصول للمحتوى</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <input 
                  type="password"
                  className={`w-full p-4 bg-stone-50 border ${error ? 'border-red-500' : 'border-stone-200'} rounded-2xl text-center text-xl tracking-[0.5em] focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                  placeholder="••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(false);
                  }}
                  autoFocus
                />
                {error && (
                  <p className="text-red-500 text-sm font-bold mt-2">كلمة السر غير صحيحة!</p>
                )}
              </div>
              <button 
                type="submit"
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
              >
                <LogIn size={20} />
                <span>دخول</span>
              </button>
            </form>
          </div>
          <div className="bg-stone-50 p-4 text-center border-t border-stone-100">
            <p className="text-xs text-stone-400 font-medium">جميع الحقوق محفوظة © {new Date().getFullYear()}</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [isAddingNovel, setIsAddingNovel] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  // Form states
  const [newNovelTitle, setNewNovelTitle] = useState('');
  const [newNovelOriginalTitle, setNewNovelOriginalTitle] = useState('');
  const [newNovelSourceUrl, setNewNovelSourceUrl] = useState('');
  const [newNovelCover, setNewNovelCover] = useState('');

  useEffect(() => {
    fetchNovels();
  }, []);

  const fetchNovels = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('novels')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) console.error('Error fetching novels:', error);
    else setNovels(data || []);
    setIsLoading(false);
  };

  const handleAddNovel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNovelTitle) return;

    const { data, error } = await supabase
      .from('novels')
      .insert([{ 
        title: newNovelTitle, 
        original_title: newNovelOriginalTitle,
        source_url: newNovelSourceUrl,
        cover_url: newNovelCover || 'https://picsum.photos/seed/novel/400/600' 
      }])
      .select();

    if (error) {
      alert('خطأ في إضافة الرواية');
    } else {
      if (data) {
        setNovels([data[0], ...novels]);
      }
      setIsAddingNovel(false);
      setNewNovelTitle('');
      setNewNovelOriginalTitle('');
      setNewNovelSourceUrl('');
      setNewNovelCover('');
    }
  };

  const handleDeleteNovel = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('هل أنت متأكد من حذف هذه الرواية؟')) return;

    const { error } = await supabase.from('novels').delete().eq('id', id);
    if (error) alert('خطأ في الحذف');
    else {
      setNovels(novels.filter(n => n.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => navigate('/')}
          >
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <BookOpen size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">مستودع الروايات</h1>
            {!isOnline && (
              <div className="flex items-center gap-1 bg-red-100 text-red-600 px-2 py-1 rounded-lg text-xs font-bold animate-pulse">
                <WifiOff size={12} />
                <span>أنت تعمل بدون إنترنت</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <Routes>
              <Route path="/" element={
                <button 
                  onClick={() => setIsAddingNovel(true)}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-100"
                >
                  <Plus size={20} />
                  <span>إضافة رواية</span>
                </button>
              } />
              <Route path="/novel/:id" element={
                <button 
                  onClick={() => navigate('/')}
                  className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors"
                >
                  <span>العودة للرئيسية</span>
                  <ChevronLeft size={20} />
                </button>
              } />
            </Routes>

            <div className="h-6 w-[1px] bg-stone-200 mx-2" />

            <button 
              onClick={() => navigate('/backup')}
              className="p-2 text-stone-400 hover:text-emerald-600 transition-colors"
              title="النسخ الاحتياطي"
            >
              <Database size={20} />
            </button>

            <button 
              onClick={() => {
                if (confirm('هل تريد تسجيل الخروج؟')) {
                  localStorage.removeItem('app_authenticated');
                  window.location.reload();
                }
              }}
              className="p-2 text-stone-400 hover:text-red-500 transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={
              <NovelList 
                novels={novels} 
                isLoading={isLoading} 
                setIsAddingNovel={setIsAddingNovel} 
                handleDeleteNovel={handleDeleteNovel} 
              />
            } />
            <Route path="/novel/:id" element={<NovelDetail />} />
            <Route path="/backup" element={<BackupManager />} />
          </Routes>
        </AnimatePresence>
      </main>

      {/* Add Novel Modal */}
      <AnimatePresence>
        {isAddingNovel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              onClick={() => setIsAddingNovel(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <h3 className="text-xl font-bold">إضافة رواية جديدة</h3>
                <button onClick={() => setIsAddingNovel(false)} className="text-stone-400 hover:text-stone-600">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleAddNovel} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-600">اسم الرواية</label>
                  <input 
                    type="text" 
                    required
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="مثلاً: رواية ملك الآلهة"
                    value={newNovelTitle}
                    onChange={(e) => setNewNovelTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-600">الاسم الأصلي</label>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="الاسم باللغة الأصلية"
                    value={newNovelOriginalTitle}
                    onChange={(e) => setNewNovelOriginalTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-600">رابط الرواية</label>
                  <input 
                    type="url" 
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="https://..."
                    value={newNovelSourceUrl}
                    onChange={(e) => setNewNovelSourceUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-600">رابط صورة الغلاف (اختياري)</label>
                  <input 
                    type="url" 
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="https://..."
                    value={newNovelCover}
                    onChange={(e) => setNewNovelCover(e.target.value)}
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100 mt-4"
                >
                  إضافة الرواية
                </button>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Version Info */}
      <footer className="max-w-6xl mx-auto px-4 py-8 border-t border-stone-200 flex flex-col md:flex-row items-center justify-between gap-4 text-stone-400 text-sm font-medium">
        <div className="flex items-center gap-2">
          <BookOpen size={16} />
          <span>مستودع الروايات © {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-stone-100 px-3 py-1 rounded-full text-xs">
            <RefreshCw size={12} className="animate-spin-slow" />
            <span>الإصدار: {APP_VERSION}</span>
          </div>
          <button 
            onClick={() => {
              if (confirm('هل تريد مسح الكاش وإعادة تحميل الموقع؟')) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="hover:text-stone-600 transition-colors"
          >
            مسح الكاش يدوياً
          </button>
        </div>
      </footer>
    </div>
  );
}
