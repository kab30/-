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
  WifiOff,
  Link2,
  Sparkles,
  Moon,
  Sun
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { NovelList } from './components/NovelList';
import { NovelDetail } from './components/NovelDetail';
import { BackupManager } from './components/BackupManager';
import { ScraperModal } from './components/ScraperModal';
import { GeminiImportModal } from './components/GeminiImportModal';
import { ChangelogModal } from './components/ChangelogModal';
import pkg from '../package.json';

const APP_VERSION = pkg.version;

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('app_authenticated') === 'true';
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('app_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

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
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4 font-sans transition-colors duration-300">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-bg-secondary rounded-3xl shadow-2xl border border-border-primary overflow-hidden"
        >
          <div className="p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl shadow-emerald-500/20">
              <Lock size={40} />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-text-primary">مستودع الروايات</h1>
              <p className="text-text-secondary font-medium">يرجى إدخال كلمة السر للوصول للمحتوى</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <input 
                  type="password"
                  className={`w-full p-4 bg-bg-primary border ${error ? 'border-red-500' : 'border-border-primary'} rounded-2xl text-center text-xl tracking-[0.5em] focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-text-primary`}
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
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={toggleTheme}
                  className="p-4 bg-bg-primary border border-border-primary rounded-2xl text-text-secondary hover:text-emerald-600 transition-all"
                >
                  {theme === 'light' ? <Moon size={24} /> : <Sun size={24} />}
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <LogIn size={20} />
                  <span>دخول</span>
                </button>
              </div>
            </form>
          </div>
          <div className="bg-bg-primary p-4 text-center border-t border-border-primary">
            <p className="text-xs text-text-secondary font-medium">جميع الحقوق محفوظة © {new Date().getFullYear()}</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <HashRouter>
      <AppContent theme={theme} toggleTheme={toggleTheme} />
    </HashRouter>
  );
}

function AppContent({ theme, toggleTheme }: { theme: 'light' | 'dark', toggleTheme: () => void }) {
  const navigate = useNavigate();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [isAddingNovel, setIsAddingNovel] = useState(false);
  const [isScraperOpen, setIsScraperOpen] = useState(false);
  const [isGeminiImportOpen, setIsGeminiImportOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showChangelog, setShowChangelog] = useState(false);

  // Version Check Logic
  useEffect(() => {
    const lastSeenVersion = localStorage.getItem('last_seen_version');
    if (lastSeenVersion !== APP_VERSION) {
      setShowChangelog(true);
      localStorage.setItem('last_seen_version', APP_VERSION);
    }
  }, []);

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
    <div className="min-h-screen bg-bg-primary font-sans text-text-primary pb-20 transition-colors duration-300">
      {/* Header */}
      <header className="bg-bg-secondary border-b border-border-primary sticky top-0 z-30 px-4 py-4 transition-colors duration-300">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => navigate('/')}
          >
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
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
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsGeminiImportOpen(true)}
                    className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-100 dark:border-blue-900/30"
                    title="جلب من Gemini"
                  >
                    <Sparkles size={20} />
                    <span className="hidden sm:inline">جلب من Gemini</span>
                  </button>
                  <button 
                    onClick={() => setIsScraperOpen(true)}
                    className="flex items-center gap-2 bg-bg-primary text-text-secondary px-4 py-2 rounded-xl hover:bg-bg-secondary transition-colors border border-border-primary"
                    title="سحب من رابط"
                  >
                    <Link2 size={20} />
                    <span className="hidden sm:inline">سحب من رابط</span>
                  </button>
                  <button 
                    onClick={() => setIsAddingNovel(true)}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-500/20"
                  >
                    <Plus size={20} />
                    <span>إضافة رواية</span>
                  </button>
                </div>
              } />
              <Route path="/novel/:id" element={
                <button 
                  onClick={() => navigate('/')}
                  className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
                >
                  <span>العودة للرئيسية</span>
                  <ChevronLeft size={20} />
                </button>
              } />
            </Routes>

            <div className="h-6 w-[1px] bg-border-primary mx-2" />

            <button 
              onClick={toggleTheme}
              className="p-2 text-text-secondary hover:text-emerald-600 transition-colors"
              title={theme === 'light' ? 'الوضع الليلي' : 'الوضع النهاري'}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            <button 
              onClick={() => navigate('/backup')}
              className="p-2 text-text-secondary hover:text-emerald-600 transition-colors"
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
              className="p-2 text-text-secondary hover:text-red-500 transition-colors"
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
        {isScraperOpen && (
          <ScraperModal 
            isOpen={isScraperOpen}
            onClose={() => setIsScraperOpen(false)}
            novels={novels}
            onSuccess={() => {
              // Optionally show a toast or refresh something
            }}
          />
        )}
        {isGeminiImportOpen && (
          <GeminiImportModal 
            isOpen={isGeminiImportOpen}
            onClose={() => setIsGeminiImportOpen(false)}
            novels={novels}
          />
        )}
        {isAddingNovel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              onClick={() => setIsAddingNovel(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <div className="relative w-full max-w-md bg-bg-secondary rounded-3xl shadow-2xl overflow-hidden border border-border-primary">
              <div className="p-6 border-b border-border-primary flex items-center justify-between">
                <h3 className="text-xl font-bold text-text-primary">إضافة رواية جديدة</h3>
                <button onClick={() => setIsAddingNovel(false)} className="text-text-secondary hover:text-text-primary transition-colors">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleAddNovel} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-secondary">اسم الرواية</label>
                  <input 
                    type="text" 
                    required
                    className="w-full p-3 bg-bg-primary border border-border-primary rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-text-primary"
                    placeholder="مثلاً: رواية ملك الآلهة"
                    value={newNovelTitle}
                    onChange={(e) => setNewNovelTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-secondary">الاسم الأصلي</label>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-bg-primary border border-border-primary rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-text-primary"
                    placeholder="الاسم باللغة الأصلية"
                    value={newNovelOriginalTitle}
                    onChange={(e) => setNewNovelOriginalTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-secondary">رابط الرواية</label>
                  <input 
                    type="url" 
                    className="w-full p-3 bg-bg-primary border border-border-primary rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-text-primary"
                    placeholder="https://..."
                    value={newNovelSourceUrl}
                    onChange={(e) => setNewNovelSourceUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-secondary">رابط صورة الغلاف (اختياري)</label>
                  <input 
                    type="url" 
                    className="w-full p-3 bg-bg-primary border border-border-primary rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-text-primary"
                    placeholder="https://..."
                    value={newNovelCover}
                    onChange={(e) => setNewNovelCover(e.target.value)}
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 mt-4"
                >
                  إضافة الرواية
                </button>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

      <ChangelogModal 
        isOpen={showChangelog} 
        onClose={() => setShowChangelog(false)} 
        version={APP_VERSION} 
      />

      {/* Footer Version Info */}
      <footer className="max-w-6xl mx-auto px-4 py-8 border-t border-border-primary flex flex-col md:flex-row items-center justify-between gap-4 text-text-secondary text-sm font-medium">
        <div className="flex items-center gap-2">
          <BookOpen size={16} />
          <span>مستودع الروايات © {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-4">
          <div 
            onClick={() => setShowChangelog(true)}
            className="flex items-center gap-1 bg-bg-primary px-3 py-1 rounded-full text-xs cursor-pointer hover:bg-emerald-500/10 hover:text-emerald-500 transition-all"
          >
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
            className="hover:text-text-primary transition-colors"
          >
            مسح الكاش يدوياً
          </button>
        </div>
      </footer>
    </div>
  );
}
