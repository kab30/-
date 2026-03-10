import React from 'react';
import { motion } from 'motion/react';
import { Plus, Book, Loader2, Trash2 } from 'lucide-react';
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

  return (
    <motion.div 
      key="novel-grid"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
    >
      {isLoading ? (
        <div className="col-span-full flex flex-col items-center justify-center py-20 text-stone-400">
          <Loader2 className="animate-spin mb-4" size={40} />
          <p>جاري تحميل الروايات...</p>
        </div>
      ) : novels.length === 0 ? (
        <div className="col-span-full flex flex-col items-center justify-center py-20 text-stone-400 border-2 border-dashed border-stone-200 rounded-3xl">
          <Book size={48} className="mb-4 opacity-20" />
          <p>لا توجد روايات حالياً. ابدأ بإضافة رواية جديدة!</p>
        </div>
      ) : (
        novels.map((novel) => (
          <motion.div
            key={novel.id}
            whileHover={{ y: -5 }}
            className="group relative bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-200 cursor-pointer"
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
                className="absolute top-2 left-2 p-2 bg-white/90 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="p-3">
              <h3 className="font-bold text-stone-800 line-clamp-1">{novel.title}</h3>
            </div>
          </motion.div>
        ))
      )}
    </motion.div>
  );
};
