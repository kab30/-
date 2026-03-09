/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { supabase, type Novel, type Chapter } from './supabase';
import { 
  Plus, 
  Book, 
  Upload, 
  Copy, 
  Save, 
  ChevronRight, 
  ChevronLeft, 
  Trash2, 
  Edit,
  GripVertical,
  Search,
  Image as ImageIcon,
  Languages,
  BookOpen,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [isAddingNovel, setIsAddingNovel] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [arabicContent, setArabicContent] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [newNovelTitle, setNewNovelTitle] = useState('');
  const [newNovelCover, setNewNovelCover] = useState('');

  useEffect(() => {
    fetchNovels();
  }, []);

  useEffect(() => {
    if (selectedNovel) {
      fetchChapters(selectedNovel.id);
    } else {
      setChapters([]);
      setSelectedChapter(null);
    }
  }, [selectedNovel]);

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

  const fetchChapters = async (novelId: string) => {
    const { data, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('novel_id', novelId)
      .order('chapter_number', { ascending: true });
    
    if (error) console.error('Error fetching chapters:', error);
    else {
      setChapters(data || []);
      if (data && data.length > 0) {
        setSelectedChapter(data[0]);
        setArabicContent(data[0].content_arabic || '');
      }
    }
  };

  const handleAddNovel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNovelTitle) return;

    const { data, error } = await supabase
      .from('novels')
      .insert([{ title: newNovelTitle, cover_url: newNovelCover || 'https://picsum.photos/seed/novel/400/600' }])
      .select();

    if (error) {
      alert('خطأ في إضافة الرواية');
    } else {
      setNovels([data[0], ...novels]);
      setIsAddingNovel(false);
      setNewNovelTitle('');
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
      if (selectedNovel?.id === id) setSelectedNovel(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedNovel) return;

    setIsUploading(true);
    
    // Fetch existing chapter numbers to avoid duplicates
    const { data: existingChapters } = await supabase
      .from('chapters')
      .select('chapter_number')
      .eq('novel_id', selectedNovel.id);
    
    const existingNumbers = new Set(existingChapters?.map(c => c.chapter_number) || []);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      
      // Split logic: Look for "Chapter X", "第X章", "الفصل X"
      // Regex to find chapter markers
      const chapterRegex = /(?:第\s*\d+\s*章|Chapter\s*\d+|الفصل\s*\d+)/gi;
      const markers = Array.from(text.matchAll(chapterRegex));
      
      const newChapters: any[] = [];
      
      if (markers.length === 0) {
        // Fallback if no markers found, treat whole text as chapter 1
        if (!existingNumbers.has(1)) {
          newChapters.push({
            novel_id: selectedNovel.id,
            chapter_number: 1,
            title: 'الفصل 1',
            content_original: text.trim()
          });
        }
      } else {
        for (let i = 0; i < markers.length; i++) {
          const chapterNum = i + 1;
          
          // Skip if this chapter number already exists in the database
          if (existingNumbers.has(chapterNum)) continue;

          const start = markers[i].index!;
          const end = markers[i + 1] ? markers[i + 1].index : text.length;
          const fullContent = text.substring(start, end).trim();
          
          // Extract title (first line) and content
          const lines = fullContent.split('\n');
          const title = lines[0].trim();
          const content = lines.slice(1).join('\n').trim();

          newChapters.push({
            novel_id: selectedNovel.id,
            chapter_number: chapterNum,
            title: title,
            content_original: content || fullContent // Use full if content is empty (e.g. only title line)
          });
        }
      }

      // Batch insert to Supabase only if there are new chapters
      if (newChapters.length > 0) {
        const { error } = await supabase.from('chapters').insert(newChapters);
        
        if (error) {
          console.error('Error inserting chapters:', error);
          alert('خطأ في رفع الفصول الجديدة.');
        } else {
          fetchChapters(selectedNovel.id);
        }
      } else {
        alert('لم يتم العثور على فصول جديدة للرفع (الفصول موجودة بالفعل).');
      }
      setIsUploading(false);
    };
    reader.readAsText(file);
  };

  const handleSaveTranslation = async () => {
    if (!selectedChapter) return;

    const { error } = await supabase
      .from('chapters')
      .update({ content_arabic: arabicContent })
      .eq('id', selectedChapter.id);

    if (error) {
      alert('خطأ في حفظ الترجمة');
    } else {
      alert('تم حفظ الترجمة بنجاح');
      setChapters(chapters.map(c => c.id === selectedChapter.id ? { ...c, content_arabic: arabicContent } : c));
    }
  };

  const handleUpdateNovelTitle = async () => {
    if (!selectedNovel || !editedTitle.trim()) return;

    const { error } = await supabase
      .from('novels')
      .update({ title: editedTitle })
      .eq('id', selectedNovel.id);

    if (error) {
      alert('خطأ في تحديث العنوان');
    } else {
      setSelectedNovel({ ...selectedNovel, title: editedTitle });
      setNovels(novels.map(n => n.id === selectedNovel.id ? { ...n, title: editedTitle } : n));
      setIsEditingTitle(false);
    }
  };

  const handleReorderChapters = async (newOrder: Chapter[]) => {
    // Update local state immediately for smooth UI
    const updatedChapters = newOrder.map((chap, index) => ({
      ...chap,
      chapter_number: index + 1
    }));
    setChapters(updatedChapters);

    // Update database
    const updates = updatedChapters.map(chap => 
      supabase.from('chapters').update({ chapter_number: chap.chapter_number }).eq('id', chap.id)
    );

    const results = await Promise.all(updates);
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Errors updating chapter order:', errors);
      // Optionally refetch if there's an error to sync back
      if (selectedNovel) fetchChapters(selectedNovel.id);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('تم النسخ إلى الحافظة');
  };

  const filteredChapters = chapters.filter(chap => 
    chap.content_original.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (chap.title && chap.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => { setSelectedNovel(null); setSelectedChapter(null); }}
          >
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <BookOpen size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">مستودع الروايات</h1>
          </div>
          
          {!selectedNovel && (
            <button 
              onClick={() => setIsAddingNovel(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-100"
            >
              <Plus size={20} />
              <span>إضافة رواية</span>
            </button>
          )}
          
          {selectedNovel && (
            <button 
              onClick={() => setSelectedNovel(null)}
              className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors"
            >
              <span>العودة للرئيسية</span>
              <ChevronLeft size={20} />
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {!selectedNovel ? (
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
                    onClick={() => setSelectedNovel(novel)}
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
          ) : (
            <motion.div 
              key="novel-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* Novel Header Info */}
              <div className="flex flex-col md:flex-row gap-8 items-start bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
                <img 
                  src={selectedNovel.cover_url} 
                  alt={selectedNovel.title} 
                  className="w-40 h-60 object-cover rounded-xl shadow-lg"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    {isEditingTitle ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input 
                          type="text"
                          className="text-3xl font-black text-stone-900 bg-stone-50 border border-stone-200 rounded-xl px-4 py-1 w-full outline-none focus:ring-2 focus:ring-emerald-500"
                          value={editedTitle}
                          onChange={(e) => setEditedTitle(e.target.value)}
                          autoFocus
                        />
                        <button 
                          onClick={handleUpdateNovelTitle}
                          className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
                        >
                          <Save size={20} />
                        </button>
                        <button 
                          onClick={() => setIsEditingTitle(false)}
                          className="p-2 bg-stone-200 text-stone-600 rounded-xl hover:bg-stone-300 transition-colors"
                        >
                          <Trash2 size={20} className="rotate-45" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <h2 className="text-3xl font-black text-stone-900">{selectedNovel.title}</h2>
                        <button 
                          onClick={() => {
                            setEditedTitle(selectedNovel.title);
                            setIsEditingTitle(true);
                          }}
                          className="p-2 text-stone-400 hover:text-emerald-600 transition-colors"
                        >
                          <Edit size={20} />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="bg-stone-100 px-4 py-2 rounded-lg text-sm font-medium text-stone-600">
                      عدد الفصول: {chapters.length}
                    </div>
                  </div>
                  
                  <div className="pt-4 flex gap-4">
                    <label className="flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-xl cursor-pointer hover:bg-stone-800 transition-colors shadow-lg">
                      <Upload size={20} />
                      <span>رفع ملف الرواية (TXT)</span>
                      <input 
                        type="file" 
                        accept=".txt" 
                        className="hidden" 
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                    </label>
                    {isUploading && (
                      <div className="flex items-center gap-2 text-emerald-600 font-medium">
                        <Loader2 className="animate-spin" size={20} />
                        <span>جاري التقسيم والرفع...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Chapter Viewer */}
              {chapters.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Chapter Sidebar/Selector */}
                  <div className="lg:col-span-3 space-y-4">
                    <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
                      <h4 className="font-bold mb-4 flex items-center gap-2">
                        <Book size={18} className="text-emerald-600" />
                        قائمة الفصول
                      </h4>
                      
                      {/* Search Bar */}
                      <div className="relative mb-4">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                        <input 
                          type="text"
                          placeholder="بحث في محتوى الفصول..."
                          className="w-full p-2 pr-10 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>

                      <select 
                        className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={selectedChapter?.id || ''}
                        onChange={(e) => {
                          const chap = chapters.find(c => c.id === e.target.value);
                          if (chap) {
                            setSelectedChapter(chap);
                            setArabicContent(chap.content_arabic || '');
                          }
                        }}
                      >
                        {filteredChapters.map(chap => (
                          <option key={chap.id} value={chap.id}>
                            {chap.title || `الفصل ${chap.chapter_number}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hidden lg:block max-h-[500px] overflow-y-auto bg-white rounded-2xl border border-stone-200 shadow-sm">
                      <div className="p-3 text-xs font-bold text-stone-400 border-b border-stone-100 flex justify-between items-center">
                        <span>{searchQuery ? `نتائج البحث: ${filteredChapters.length}` : 'اسحب لإعادة الترتيب'}</span>
                        {!searchQuery && <GripVertical size={14} />}
                      </div>
                      <div className="space-y-0">
                        {filteredChapters.map((chap, index) => (
                          <div
                            key={chap.id}
                            draggable={!searchQuery}
                            onDragStart={(e) => {
                              if (searchQuery) return;
                              e.dataTransfer.setData('text/plain', index.toString());
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              if (searchQuery) return;
                              e.preventDefault();
                              const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                              const toIndex = index;
                              if (fromIndex === toIndex) return;
                              
                              const newChapters = [...chapters];
                              const [moved] = newChapters.splice(fromIndex, 1);
                              newChapters.splice(toIndex, 0, moved);
                              handleReorderChapters(newChapters);
                            }}
                            className={cn(
                              "w-full text-right p-4 border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors text-sm flex items-center justify-between group",
                              !searchQuery && "cursor-move",
                              selectedChapter?.id === chap.id ? "bg-emerald-50 text-emerald-700 font-bold border-r-4 border-r-emerald-600" : "text-stone-600"
                            )}
                            onClick={() => {
                              setSelectedChapter(chap);
                              setArabicContent(chap.content_arabic || '');
                            }}
                          >
                            <span className="flex-1">{chap.title || `الفصل ${chap.chapter_number}`}</span>
                            {!searchQuery && <GripVertical size={14} className="text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
                          </div>
                        ))}
                        {filteredChapters.length === 0 && (
                          <div className="p-8 text-center text-stone-400 text-sm">
                            لا توجد نتائج للبحث
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="lg:col-span-9 space-y-6">
                    {selectedChapter && (
                      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                          <h3 className="text-xl font-bold text-stone-800">{selectedChapter.title}</h3>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => copyToClipboard(selectedChapter.content_original)}
                              className="p-2 bg-white border border-stone-200 rounded-lg text-stone-600 hover:text-emerald-600 transition-colors shadow-sm"
                              title="نسخ النص الأصلي"
                            >
                              <Copy size={20} />
                            </button>
                            <button 
                              onClick={handleSaveTranslation}
                              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                            >
                              <Save size={18} />
                              <span>حفظ الترجمة</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-stone-100">
                          {/* Original Text */}
                          <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1">
                                <Languages size={14} />
                                النص الأصلي
                              </span>
                            </div>
                            <div className="prose prose-stone max-w-none h-[600px] overflow-y-auto p-4 bg-stone-50 rounded-xl text-lg leading-relaxed whitespace-pre-wrap font-mono">
                              {selectedChapter.content_original}
                            </div>
                          </div>

                          {/* Arabic Translation */}
                          <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1">
                                <Languages size={14} />
                                الترجمة العربية
                              </span>
                            </div>
                            <textarea
                              className="w-full h-[600px] p-4 bg-white border border-stone-200 rounded-xl text-lg leading-relaxed focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                              placeholder="أدخل الترجمة العربية هنا..."
                              value={arabicContent}
                              onChange={(e) => setArabicContent(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white p-20 rounded-3xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center text-stone-400">
                  <Upload size={48} className="mb-4 opacity-20" />
                  <p className="text-lg">لا توجد فصول لهذه الرواية بعد. قم برفع ملف TXT للبدء.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Add Novel Modal */}
      <AnimatePresence>
        {isAddingNovel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingNovel(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
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
                  <label className="text-sm font-bold text-stone-600">رابط صورة الغلاف (اختياري)</label>
                  <div className="relative">
                    <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input 
                      type="url" 
                      className="w-full p-3 pl-10 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="https://..."
                      value={newNovelCover}
                      onChange={(e) => setNewNovelCover(e.target.value)}
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100 mt-4"
                >
                  إضافة الرواية
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
