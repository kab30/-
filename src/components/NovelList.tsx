import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Book, 
  Loader2, 
  Trash2, 
  Edit3, 
  Search, 
  BookOpen, 
  CheckCircle2, 
  Languages, 
  Sparkles,
  Flame,
  ArrowUpRight
} from 'lucide-react';
import { type Novel } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { EditNovelModal } from './EditNovelModal';
import { fetchAllNovelsProgress, type NovelProgress } from '../utils/novelProgress';

interface NovelListProps {
  novels: Novel[];
  isLoading: boolean;
  setIsAddingNovel: (val: boolean) => void;
  handleDeleteNovel: (id: string, e?: React.MouseEvent) => void;
  handleUpdateNovel?: (updated: Novel) => void;
}

type FilterType = 'all' | 'in_progress' | 'completed' | 'not_started';

export const NovelList: React.FC<NovelListProps> = ({ 
  novels, 
  isLoading, 
  setIsAddingNovel,
  handleDeleteNovel,
  handleUpdateNovel 
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [editingNovel, setEditingNovel] = useState<Novel | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, NovelProgress>>({});
  const [isProgressLoading, setIsProgressLoading] = useState(true);

  // Fetch translation progress for all novels
  useEffect(() => {
    let isMounted = true;
    const loadProgress = async () => {
      if (novels.length === 0) {
        setIsProgressLoading(false);
        return;
      }
      setIsProgressLoading(true);
      const data = await fetchAllNovelsProgress(novels);
      if (isMounted) {
        setProgressMap(data);
        setIsProgressLoading(false);
      }
    };
    loadProgress();
    return () => { isMounted = false; };
  }, [novels]);

  // Compute filter counts
  const filterCounts = useMemo(() => {
    let inProgress = 0;
    let completed = 0;
    let notStarted = 0;

    for (const novel of novels) {
      const prog = progressMap[novel.id];
      if (!prog || prog.lastTranslatedChapter === 0) {
        notStarted++;
      } else if (prog.percentage >= 100) {
        completed++;
      } else {
        inProgress++;
      }
    }

    return {
      all: novels.length,
      in_progress: inProgress,
      completed: completed,
      not_started: notStarted
    };
  }, [novels, progressMap]);

  // Filter novels by query & tab
  const filteredNovels = useMemo(() => {
    return novels.filter(novel => {
      const matchesSearch = 
        novel.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (novel.original_title && novel.original_title.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const prog = progressMap[novel.id];
      const hasTranslated = prog && prog.lastTranslatedChapter > 0;
      const isCompleted = prog && prog.percentage >= 100;

      if (activeFilter === 'in_progress') {
        return hasTranslated && !isCompleted;
      }
      if (activeFilter === 'completed') {
        return isCompleted;
      }
      if (activeFilter === 'not_started') {
        return !hasTranslated;
      }

      return true;
    });
  }, [novels, searchQuery, activeFilter, progressMap]);

  return (
    <div className="space-y-6">
      {/* Search & Filter Controls */}
      <div className="max-w-2xl mx-auto space-y-4 px-2 sm:px-0">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
          <input 
            type="text"
            placeholder="بحث عن رواية بالعنوان العربي أو الأصلي..."
            className="w-full p-3.5 pr-11 bg-bg-primary border border-border-primary rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-text-primary text-sm sm:text-base placeholder:text-text-secondary/60"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-xs bg-bg-secondary hover:bg-border-primary text-text-secondary px-2 py-0.5 rounded-full transition-colors"
            >
              مسح
            </button>
          )}
        </div>

        {/* Filter Pills */}
        {novels.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
                activeFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20'
                  : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-border-primary'
              }`}
            >
              <span>الكل</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-bg-primary text-text-secondary'}`}>
                {filterCounts.all}
              </span>
            </button>

            <button
              onClick={() => setActiveFilter('in_progress')}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
                activeFilter === 'in_progress'
                  ? 'bg-red-600 text-white shadow-sm shadow-red-500/20'
                  : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-border-primary'
              }`}
            >
              <Flame size={13} className={activeFilter === 'in_progress' ? 'text-amber-300' : 'text-red-500'} />
              <span>قيد الترجمة</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeFilter === 'in_progress' ? 'bg-white/20 text-white' : 'bg-bg-primary text-text-secondary'}`}>
                {filterCounts.in_progress}
              </span>
            </button>

            <button
              onClick={() => setActiveFilter('completed')}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
                activeFilter === 'completed'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20'
                  : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-border-primary'
              }`}
            >
              <CheckCircle2 size={13} className={activeFilter === 'completed' ? 'text-white' : 'text-emerald-500'} />
              <span>مكتملة</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeFilter === 'completed' ? 'bg-white/20 text-white' : 'bg-bg-primary text-text-secondary'}`}>
                {filterCounts.completed}
              </span>
            </button>

            <button
              onClick={() => setActiveFilter('not_started')}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
                activeFilter === 'not_started'
                  ? 'bg-stone-700 text-white shadow-sm'
                  : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-border-primary'
              }`}
            >
              <span>لم تبدأ</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeFilter === 'not_started' ? 'bg-white/20 text-white' : 'bg-bg-primary text-text-secondary'}`}>
                {filterCounts.not_started}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Novels Grid */}
      <motion.div 
        key="novel-grid"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6"
      >
        {isLoading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-text-secondary">
            <Loader2 className="animate-spin mb-4 text-emerald-600" size={40} />
            <p className="font-medium">جاري تحميل الروايات...</p>
          </div>
        ) : filteredNovels.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-text-secondary border-2 border-dashed border-border-primary rounded-3xl bg-bg-primary/50">
            <Book size={48} className="mb-4 opacity-20 text-emerald-600" />
            <p className="font-medium">{searchQuery ? 'لا توجد نتائج لبحثك' : 'لا توجد روايات في هذا التصنيف.'}</p>
            {activeFilter !== 'all' && (
              <button
                onClick={() => setActiveFilter('all')}
                className="mt-3 text-sm text-emerald-600 hover:underline font-semibold"
              >
                عرض كل الروايات
              </button>
            )}
          </div>
        ) : (
          filteredNovels.map((novel) => {
            const progress = progressMap[novel.id];
            const hasProgress = progress && progress.lastTranslatedChapter > 0;
            const isCompleted = progress && progress.percentage >= 100 && progress.totalChapters > 0;
            const percent = progress ? progress.percentage : 0;
            const currentChapter = progress ? progress.lastTranslatedChapter : 0;
            const totalChaps = progress ? (progress.totalChapters || progress.maxStoredChapter || progress.totalStored || 0) : (novel.total_chapters || 0);

            return (
              <motion.div
                key={novel.id}
                whileHover={{ y: -5 }}
                transition={{ duration: 0.2 }}
                className="group relative bg-bg-primary rounded-2xl overflow-hidden shadow-sm hover:shadow-xl border border-border-primary cursor-pointer flex flex-col"
                onClick={() => navigate(`/novel/${novel.id}`)}
              >
                {/* Cover Image Container */}
                <div className="aspect-[2/3] relative w-full overflow-hidden bg-stone-900">
                  <img 
                    src={novel.cover_url} 
                    alt={novel.title} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />

                  {/* Top Floating Badge: Current Chapter Reached */}
                  <div className="absolute top-2.5 right-2.5 z-10">
                    {hasProgress ? (
                      <div className={`px-2.5 py-1 rounded-xl text-xs font-bold shadow-lg backdrop-blur-md flex items-center gap-1.5 ${
                        isCompleted 
                          ? 'bg-emerald-600/90 text-white border border-emerald-400/30' 
                          : 'bg-black/75 text-white border border-red-500/40'
                      }`}>
                        {!isCompleted && (
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.9)]" />
                        )}
                        <span>
                          {isCompleted ? 'مكتملة' : `فصل ${currentChapter}`}
                        </span>
                      </div>
                    ) : (
                      <div className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-black/60 text-white/80 backdrop-blur-xs border border-white/10">
                        لم تبدأ
                      </div>
                    )}
                  </div>

                  {/* Top Left Quick Action Buttons (Edit / Delete) */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingNovel(novel);
                      }}
                      className="p-2 bg-bg-primary/95 text-text-secondary hover:text-emerald-600 rounded-xl shadow-md hover:bg-bg-primary transition-all backdrop-blur-xs"
                      title="تعديل الرواية"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteNovel(novel.id, e)}
                      className="p-2 bg-bg-primary/95 text-red-500 rounded-xl shadow-md hover:bg-red-50 dark:hover:bg-red-950/50 transition-all backdrop-blur-xs"
                      title="حذف الرواية"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Bottom Dark Gradient Banner: Translation Progress and RED BAR */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-stone-950/95 via-stone-950/70 to-transparent pt-8 pb-2.5 px-3 z-10 flex flex-col justify-end">
                    {/* Info row */}
                    <div className="flex items-center justify-between text-white text-xs font-semibold mb-1.5 drop-shadow-md">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-white/90 text-[11px] sm:text-xs">
                          {hasProgress ? (
                            <span>وصلت: <b className="text-white font-bold">فصل {currentChapter}</b></span>
                          ) : (
                            <span className="text-white/70 text-[11px]">0 فصول مترجمة</span>
                          )}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono font-bold shrink-0">
                        {isCompleted ? (
                          <span className="text-emerald-400">100%</span>
                        ) : (
                          <span className={hasProgress ? 'text-red-400 font-extrabold' : 'text-white/50'}>
                            {percent}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* THE RED PROGRESS BAR */}
                    <div className="w-full bg-stone-950/90 h-2 rounded-full overflow-hidden p-[1.5px] border border-white/20 shadow-inner">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCompleted
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                            : hasProgress
                              ? 'bg-gradient-to-r from-red-600 via-rose-500 to-red-400 shadow-[0_0_8px_rgba(239,68,68,0.85)]'
                              : 'bg-stone-700/40'
                        }`}
                        style={{ 
                          width: `${isCompleted ? 100 : Math.max(percent, hasProgress ? 4 : 0)}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Content Below Cover */}
                <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h3 className="font-bold text-text-primary line-clamp-1 text-sm sm:text-base group-hover:text-emerald-600 transition-colors" title={novel.title}>
                      {novel.title}
                    </h3>
                    {novel.original_title && (
                      <p className="text-xs text-text-secondary line-clamp-1 mt-0.5 font-sans" title={novel.original_title}>
                        {novel.original_title}
                      </p>
                    )}
                  </div>

                  {/* Translation stats mini pill */}
                  <div className="pt-1.5 border-t border-border-primary/60 flex items-center justify-between text-[11px] sm:text-xs text-text-secondary">
                    <span className="flex items-center gap-1">
                      <Languages size={12} className={hasProgress ? 'text-red-500' : 'text-text-secondary'} />
                      <span>
                        {hasProgress 
                          ? `${progress.translatedCount} / ${totalChaps || '؟'} فصل`
                          : `${totalChaps > 0 ? totalChaps + ' فصل مخزن' : 'لا فصول'}`
                        }
                      </span>
                    </span>

                    <span className="flex items-center text-emerald-600 font-semibold group-hover:translate-x-[-2px] transition-transform">
                      <span className="text-[10px] sm:text-[11px]">متابعة</span>
                      <ArrowUpRight size={13} />
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </motion.div>

      {/* Edit Novel Modal */}
      <EditNovelModal
        isOpen={!!editingNovel}
        novel={editingNovel}
        onClose={() => setEditingNovel(null)}
        onSave={(updated) => {
          if (handleUpdateNovel) handleUpdateNovel(updated);
        }}
        onDelete={(id) => {
          handleDeleteNovel(id);
        }}
      />
    </div>
  );
};
