import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Book, Loader2, Trash2, Search } from 'lucide-react';
import { type Novel } from '../supabase';
import { useNavigate } from 'react-router-dom';

interface NovelListProps {
  novels: Novel[];
  isLoading: boolean;
  setIsAddingNovel: (val: boolean) => void;
  handleDeleteNovel: (id: string, e: React.MouseEvent) => void;
}

export const NovelList: React.FC<NovelListProps> = ({ 
  novels, 
  isLoading, 
  setIsAddingNovel,
  handleDeleteNovel 
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNovels = novels.filter(novel => 
    novel.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (novel.original_title && novel.original_title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      {/* Search Bar */}
      <div className="relative max-w-md mx-auto">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
        <input 
          type="text"
          placeholder="بحث عن رواية..."
          className="w-full p-4 pr-12 bg-bg-primary border border-border-primary rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-text-primary"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <motion.div 
        key="novel-grid"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
      >
        {isLoading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-text-secondary">
            <Loader2 className="animate-spin mb-4" size={40} />
            <p>جاري تحميل الروايات...</p>
          </div>
        ) : filteredNovels.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-text-secondary border-2 border-dashed border-border-primary rounded-3xl">
            <Book size={48} className="mb-4 opacity-20" />
            <p>{searchQuery ? 'لا توجد نتائج لبحثك' : 'لا توجد روايات حالياً. ابدأ بإضافة رواية جديدة!'}</p>
          </div>
        ) : (
          filteredNovels.map((novel) => (
            <motion.div
              key={novel.id}
              whileHover={{ y: -5 }}
              className="group relative bg-bg-primary rounded-2xl overflow-hidden shadow-sm border border-border-primary cursor-pointer"
              onClick={() => navigate(`/novel/${novel.id}`)}
            >
              <div className="aspect-[2/3] relative">
                <img 
                  src={novel.cover_url} 
                  alt={novel.title} 
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <span className="text-white text-sm font-medium">عرض الفصول</span>
                </div>
                <button 
                  onClick={(e) => handleDeleteNovel(novel.id, e)}
                  className="absolute top-2 left-2 p-2 bg-bg-primary/90 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="p-3">
                <h3 className="font-bold text-text-primary line-clamp-1">{novel.title}</h3>
              </div>
            </motion.div>
          ))
        )}
      </motion.div>
    </div>
  );
};
