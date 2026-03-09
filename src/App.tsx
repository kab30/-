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
  Loader2,
  Check,
  Download
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
  const [chapterFilter, setChapterFilter] = useState<'all' | 'translated' | 'untranslated'>('all');
  const [pendingChapters, setPendingChapters] = useState<any[]>([]);
  const [showUploadPreview, setShowUploadPreview] = useState(false);
  const [selectedPendingIndices, setSelectedPendingIndices] = useState<Set<number>>(new Set());
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [deleteRangeStart, setDeleteRangeStart] = useState('');
  const [deleteRangeEnd, setDeleteRangeEnd] = useState('');

  // Form states
  const [newNovelTitle, setNewNovelTitle] = useState('');
  const [newNovelOriginalTitle, setNewNovelOriginalTitle] = useState('');
  const [newNovelSourceUrl, setNewNovelSourceUrl] = useState('');
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
    setIsLoading(true);
    let allChapters: Chapter[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .eq('novel_id', novelId)
        .order('chapter_number', { ascending: true })
        .range(from, from + step - 1);
      
      if (error) {
        console.error('Error fetching chapters:', error);
        hasMore = false;
      } else {
        const batch = data || [];
        allChapters = [...allChapters, ...batch];
        if (batch.length < step) {
          hasMore = false;
        } else {
          from += step;
        }
      }
    }

    setChapters(allChapters);
    if (allChapters.length > 0) {
      // Only set selected chapter if none is selected or if we just switched novel
      if (!selectedChapter || !allChapters.find(c => c.id === selectedChapter.id)) {
        setSelectedChapter(allChapters[0]);
        setArabicContent(allChapters[0].content_arabic || '');
      }
    }
    setIsLoading(false);
  };

  const handleDeleteSelected = async () => {
    if (selectedChapterIds.size === 0 || !selectedNovel) return;
    if (!confirm(`هل أنت متأكد من حذف ${selectedChapterIds.size} فصل؟`)) return;

    setIsLoading(true);
    const { error } = await supabase
      .from('chapters')
      .delete()
      .in('id', Array.from(selectedChapterIds));

    if (error) {
      alert('خطأ في حذف الفصول');
    } else {
      const deletedIds = Array.from(selectedChapterIds);
      if (selectedChapter && deletedIds.includes(selectedChapter.id)) {
        setSelectedChapter(null);
        setArabicContent('');
      }
      setSelectedChapterIds(new Set());
      fetchChapters(selectedNovel.id);
    }
    setIsLoading(false);
  };

  const handleDeleteRange = async () => {
    const start = parseInt(deleteRangeStart);
    const end = parseInt(deleteRangeEnd);
    if (isNaN(start) || isNaN(end) || !selectedNovel) {
      alert('يرجى إدخال نطاق صحيح');
      return;
    }

    if (!confirm(`هل أنت متأكد من حذف الفصول من ${start} إلى ${end}؟`)) return;

    setIsLoading(true);
    const { error } = await supabase
      .from('chapters')
      .delete()
      .eq('novel_id', selectedNovel.id)
      .gte('chapter_number', start)
      .lte('chapter_number', end);

    if (error) {
      alert('خطأ في حذف نطاق الفصول');
    } else {
      // Check if selected chapter is in range
      if (selectedChapter && selectedChapter.chapter_number >= start && selectedChapter.chapter_number <= end) {
        setSelectedChapter(null);
        setArabicContent('');
      }
      setDeleteRangeStart('');
      setDeleteRangeEnd('');
      fetchChapters(selectedNovel.id);
    }
    setIsLoading(false);
  };

  const toggleChapterSelection = (id: string) => {
    const newSelection = new Set(selectedChapterIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedChapterIds(newSelection);
  };

  const handleApplyDeleteRangeSelection = () => {
    const start = parseInt(deleteRangeStart);
    const end = parseInt(deleteRangeEnd);
    if (isNaN(start) || isNaN(end)) return;

    const newSelection = new Set(selectedChapterIds);
    chapters.forEach(chap => {
      if (chap.chapter_number >= start && chap.chapter_number <= end) {
        newSelection.add(chap.id);
      }
    });
    setSelectedChapterIds(newSelection);
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
      setNovels([data[0], ...novels]);
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
      if (selectedNovel?.id === id) setSelectedNovel(null);
    }
  };

  const handleConfirmUpload = async () => {
    if (!selectedNovel || selectedPendingIndices.size === 0) return;

    setIsUploading(true);
    const chaptersToUpload = pendingChapters
      .filter((_, idx) => selectedPendingIndices.has(idx))
      .map(({ isDuplicate, ...rest }) => rest);

    // Deduplicate by chapter_number within the upload set (keep the last one)
    const uniqueChaptersMap = new Map();
    chaptersToUpload.forEach(chap => {
      uniqueChaptersMap.set(chap.chapter_number, chap);
    });
    const finalChaptersToUpload = Array.from(uniqueChaptersMap.values());

    const batchSize = 50;
    let hasError = false;
    
    for (let i = 0; i < finalChaptersToUpload.length; i += batchSize) {
      const batch = finalChaptersToUpload.slice(i, i + batchSize);
      const { error } = await supabase.from('chapters').upsert(batch, { onConflict: 'novel_id,chapter_number' });
      if (error) {
        console.error('Error inserting batch:', error);
        hasError = true;
        break;
      }
    }
    
    if (hasError) {
      alert('حدث خطأ أثناء رفع بعض الفصول. يرجى التحقق من القائمة.');
    } else {
      alert(`تم رفع ${finalChaptersToUpload.length} فصل بنجاح.`);
      setShowUploadPreview(false);
      setPendingChapters([]);
      setSelectedPendingIndices(new Set());
      fetchChapters(selectedNovel.id);
    }
    setIsUploading(false);
  };

  const handleApplyRange = () => {
    const start = parseInt(rangeStart);
    const end = parseInt(rangeEnd);
    if (isNaN(start) || isNaN(end)) return;

    const newSelection = new Set(selectedPendingIndices);
    pendingChapters.forEach((chapter, idx) => {
      if (chapter.chapter_number >= start && chapter.chapter_number <= end) {
        newSelection.add(idx);
      }
    });
    setSelectedPendingIndices(newSelection);
  };

  const togglePendingSelection = (idx: number) => {
    const newSelection = new Set(selectedPendingIndices);
    if (newSelection.has(idx)) {
      newSelection.delete(idx);
    } else {
      newSelection.add(idx);
    }
    setSelectedPendingIndices(newSelection);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedNovel) return;

    setIsUploading(true);
    
    // Fetch ALL existing chapter numbers to avoid duplicates (handling Supabase 1000 limit)
    let allExistingChapters: { chapter_number: number }[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('chapters')
        .select('chapter_number')
        .eq('novel_id', selectedNovel.id)
        .range(from, from + step - 1);
      
      if (error) {
        console.error('Error fetching existing chapters:', error);
        hasMore = false;
      } else {
        const batch = data || [];
        allExistingChapters = [...allExistingChapters, ...batch];
        if (batch.length < step) {
          hasMore = false;
        } else {
          from += step;
        }
      }
    }
    
    const existingNumbers = new Set(allExistingChapters.map(c => c.chapter_number));
    const maxExistingNum = allExistingChapters.reduce((max, c) => Math.max(max, c.chapter_number), 0);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      
      const chapterRegex = /(?:第\s*(\d+)\s*(?:章|节|回)|Chapter\s*(\d+)|الفصل\s*(\d+))/gi;
      const markers = Array.from(text.matchAll(chapterRegex));
      
      const parsedChapters: any[] = [];
      
      if (markers.length === 0) {
        const nextNum = maxExistingNum + 1;
        parsedChapters.push({
          novel_id: selectedNovel.id,
          chapter_number: nextNum,
          title: `الفصل ${nextNum}`,
          content_original: text.trim(),
          isDuplicate: existingNumbers.has(nextNum)
        });
      } else {
        for (let i = 0; i < markers.length; i++) {
          const match = markers[i];
          const extractedNum = parseInt(match[1] || match[2] || match[3]);
          const chapterNum = isNaN(extractedNum) ? (maxExistingNum + i + 1) : extractedNum;
          
          const start = match.index!;
          const end = markers[i + 1] ? markers[i + 1].index : text.length;
          const fullContent = text.substring(start, end).trim();
          
          const lines = fullContent.split('\n');
          const title = lines[0].trim();
          const content = lines.slice(1).join('\n').trim();

          parsedChapters.push({
            novel_id: selectedNovel.id,
            chapter_number: chapterNum,
            title: title,
            content_original: content || fullContent,
            isDuplicate: existingNumbers.has(chapterNum)
          });
        }
      }

      setPendingChapters(parsedChapters);
      // Select all non-duplicates by default
      setSelectedPendingIndices(new Set(
        parsedChapters
          .map((c, idx) => c.isDuplicate ? -1 : idx)
          .filter(idx => idx !== -1)
      ));
      setShowUploadPreview(true);
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
      const updatedChapters = chapters.map(c => c.id === selectedChapter.id ? { ...c, content_arabic: arabicContent } : c);
      setChapters(updatedChapters);
      
      // Move to next untranslated chapter
      const next = updatedChapters.find(c => !c.content_arabic || c.content_arabic.trim().length === 0);
      if (next) {
        setSelectedChapter(next);
        setArabicContent(next.content_arabic || '');
      }
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

  const copyToClipboard = async (text: string, id?: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      
      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        alert('تم النسخ إلى الحافظة');
      }
    } catch (err) {
      console.error('Failed to copy: ', err);
      alert('فشل النسخ. يرجى المحاولة مرة أخرى أو النسخ يدوياً.');
    }
  };

  const handleDownloadTranslated = () => {
    if (!selectedNovel || chapters.length === 0) return;

    const translatedChapters = chapters
      .filter(c => c.content_arabic && c.content_arabic.trim().length > 0)
      .sort((a, b) => a.chapter_number - b.chapter_number);

    if (translatedChapters.length === 0) {
      alert('لا توجد فصول مترجمة لتحميلها');
      return;
    }

    const content = translatedChapters
      .map(c => c.content_arabic)
      .join('\n\n' + '='.repeat(30) + '\n\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedNovel.title}_ترجمة.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredChapters = chapters.filter(chap => {
    const matchesSearch = chap.content_original.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chap.title && chap.title.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const isTranslated = !!(chap.content_arabic && chap.content_arabic.trim().length > 0);
    
    if (chapterFilter === 'translated') return matchesSearch && isTranslated;
    if (chapterFilter === 'untranslated') return matchesSearch && !isTranslated;
    return matchesSearch;
  });

  const translatedCount = chapters.filter(c => c.content_arabic && c.content_arabic.trim().length > 0).length;
  const nextUntranslated = chapters.find(c => !c.content_arabic || c.content_arabic.trim().length === 0);

  const handleGoToNextUntranslated = () => {
    if (nextUntranslated) {
      setSelectedChapter(nextUntranslated);
      setArabicContent(nextUntranslated.content_arabic || '');
    }
  };

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
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
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
                        </div>
                        {selectedNovel.original_title && (
                          <p className="text-stone-500 font-medium">{selectedNovel.original_title}</p>
                        )}
                        {selectedNovel.source_url && (
                          <a 
                            href={selectedNovel.source_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-emerald-600 text-sm hover:underline flex items-center gap-1"
                          >
                            <ImageIcon size={14} />
                            رابط الرواية الأصلي
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="bg-stone-100 px-4 py-2 rounded-lg text-sm font-medium text-stone-600">
                      عدد الفصول: {chapters.length}
                    </div>
                    <div className="bg-emerald-100 px-4 py-2 rounded-lg text-sm font-medium text-emerald-700 flex items-center gap-2">
                      <span>المترجمة: {translatedCount}</span>
                      <span className="text-xs opacity-60">({Math.round((translatedCount / (chapters.length || 1)) * 100)}%)</span>
                    </div>
                    {nextUntranslated && (
                      <button 
                        onClick={handleGoToNextUntranslated}
                        className="bg-stone-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors flex items-center gap-2"
                      >
                        <span>الفصل التالي للترجمة: {nextUntranslated.chapter_number}</span>
                        <ChevronRight size={16} />
                      </button>
                    )}
                    <button 
                      onClick={handleDownloadTranslated}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
                    >
                      <Download size={16} />
                      <span>تحميل الترجمة (.txt)</span>
                    </button>
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

                      {/* Quick Copy Buttons */}
                      {chapters.filter(c => !c.content_arabic || c.content_arabic.trim().length === 0).length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          {chapters
                            .filter(c => !c.content_arabic || c.content_arabic.trim().length === 0)
                            .slice(0, 3)
                            .map((chap) => (
                              <button
                                key={chap.id}
                                onClick={() => copyToClipboard(`${chap.title}\n\n${chap.content_original}`, chap.id)}
                                className={cn(
                                  "py-2 px-1 rounded-xl text-[10px] font-bold transition-all flex flex-col items-center justify-center gap-1 shadow-sm border",
                                  copiedId === chap.id 
                                    ? "bg-emerald-500 border-emerald-500 text-white scale-95" 
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                )}
                                title={`نسخ ${chap.title}`}
                              >
                                {copiedId === chap.id ? <Check size={14} /> : <Copy size={14} />}
                                <span className="truncate w-full text-center">فصل {chap.chapter_number}</span>
                              </button>
                            ))}
                        </div>
                      )}

                      {/* Filter Tabs */}
                      <div className="flex gap-1 mb-4 bg-stone-100 p-1 rounded-xl">
                        <button 
                          onClick={() => setChapterFilter('all')}
                          className={cn(
                            "flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors",
                            chapterFilter === 'all' ? "bg-white text-emerald-600 shadow-sm" : "text-stone-500 hover:text-stone-700"
                          )}
                        >الكل</button>
                        <button 
                          onClick={() => setChapterFilter('translated')}
                          className={cn(
                            "flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors",
                            chapterFilter === 'translated' ? "bg-white text-emerald-600 shadow-sm" : "text-stone-500 hover:text-stone-700"
                          )}
                        >المترجمة</button>
                        <button 
                          onClick={() => setChapterFilter('untranslated')}
                          className={cn(
                            "flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors",
                            chapterFilter === 'untranslated' ? "bg-white text-emerald-600 shadow-sm" : "text-stone-500 hover:text-stone-700"
                          )}
                        >غير المترجمة</button>
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

                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 p-3 bg-stone-100 rounded-2xl border border-stone-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-stone-500">إجراءات جماعية</span>
                          {selectedChapterIds.size > 0 && (
                            <button 
                              onClick={handleDeleteSelected}
                              className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
                            >
                              <Trash2 size={12} />
                              حذف ({selectedChapterIds.size})
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            placeholder="من" 
                            className="w-full p-2 text-xs bg-white border border-stone-200 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500"
                            value={deleteRangeStart}
                            onChange={(e) => setDeleteRangeStart(e.target.value)}
                          />
                          <input 
                            type="number" 
                            placeholder="إلى" 
                            className="w-full p-2 text-xs bg-white border border-stone-200 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500"
                            value={deleteRangeEnd}
                            onChange={(e) => setDeleteRangeEnd(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={handleApplyDeleteRangeSelection}
                            className="flex-1 py-1.5 text-[10px] font-bold bg-white border border-stone-200 text-stone-600 rounded-lg hover:bg-stone-50 transition-colors"
                          >
                            تحديد النطاق
                          </button>
                          <button 
                            onClick={handleDeleteRange}
                            className="flex-1 py-1.5 text-[10px] font-bold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            حذف النطاق
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setSelectedChapterIds(new Set(chapters.map(c => c.id)))}
                            className="flex-1 py-1 text-[10px] font-bold text-emerald-600 hover:underline"
                          >
                            تحديد الكل
                          </button>
                          <button 
                            onClick={() => setSelectedChapterIds(new Set())}
                            className="flex-1 py-1 text-[10px] font-bold text-stone-400 hover:underline"
                          >
                            إلغاء التحديد
                          </button>
                        </div>
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
                                "w-full text-right p-4 border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors text-sm flex items-center gap-3 group",
                                !searchQuery && "cursor-move",
                                selectedChapter?.id === chap.id ? "bg-emerald-50 text-emerald-700 font-bold border-r-4 border-r-emerald-600" : "text-stone-600"
                              )}
                            >
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleChapterSelection(chap.id);
                                }}
                                className={cn(
                                  "w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer shrink-0",
                                  selectedChapterIds.has(chap.id) ? "bg-emerald-500 border-emerald-500 text-white" : "border-stone-300 bg-white"
                                )}
                              >
                                {selectedChapterIds.has(chap.id) && <Check size={10} />}
                              </div>
                              <div 
                                className="flex items-center gap-2 flex-1 min-w-0"
                                onClick={() => {
                                  setSelectedChapter(chap);
                                  setArabicContent(chap.content_arabic || '');
                                }}
                              >
                                <span className="truncate flex-1">{chap.title || `الفصل ${chap.chapter_number}`}</span>
                                {chap.content_arabic && chap.content_arabic.trim().length > 0 && (
                                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200 shrink-0" title="مترجم" />
                                )}
                              </div>
                              {!searchQuery && <GripVertical size={14} className="text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
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
                </div>

                {/* Content Area */}
                  <div className="lg:col-span-9 space-y-6">
                    {selectedChapter && (
                      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                          <h3 className="text-xl font-bold text-stone-800">{selectedChapter.title}</h3>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => copyToClipboard(`${selectedChapter.title}\n\n${selectedChapter.content_original}`)}
                              className="p-2 bg-white border border-stone-200 rounded-lg text-stone-600 hover:text-emerald-600 transition-colors shadow-sm flex items-center gap-2"
                              title="نسخ النص الأصلي"
                            >
                              <Copy size={18} />
                              <span className="text-xs font-bold hidden sm:inline">نسخ الأصلي</span>
                            </button>
                            <button 
                              onClick={() => copyToClipboard(`${selectedChapter.title}\n\n${arabicContent}`)}
                              className="p-2 bg-white border border-stone-200 rounded-lg text-stone-600 hover:text-emerald-600 transition-colors shadow-sm flex items-center gap-2"
                              title="نسخ الترجمة"
                            >
                              <Copy size={18} />
                              <span className="text-xs font-bold hidden sm:inline">نسخ الترجمة</span>
                            </button>
                            <button 
                              onClick={handleSaveTranslation}
                              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                            >
                              <Save size={18} />
                              <span className="hidden sm:inline">حفظ الترجمة</span>
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
                              <button 
                                onClick={() => copyToClipboard(`${selectedChapter.title}\n\n${selectedChapter.content_original}`)}
                                className="p-1.5 text-stone-400 hover:text-emerald-600 transition-colors"
                                title="نسخ النص الأصلي"
                              >
                                <Copy size={14} />
                              </button>
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
                              <button 
                                onClick={() => copyToClipboard(`${selectedChapter.title}\n\n${arabicContent}`)}
                                className="p-1.5 text-stone-400 hover:text-emerald-600 transition-colors"
                                title="نسخ الترجمة"
                              >
                                <Copy size={14} />
                              </button>
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

        {showUploadPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUploadPreview(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                  <h3 className="text-xl font-bold">معاينة الفصول المستخرجة</h3>
                  <p className="text-sm text-stone-500">تم العثور على {pendingChapters.length} فصل</p>
                </div>
                <button onClick={() => setShowUploadPreview(false)} className="text-stone-400 hover:text-stone-600">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <div className="p-6 bg-stone-50 border-b border-stone-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-bold text-stone-500 uppercase">تحديد نطاق (من - إلى)</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        placeholder="من"
                        className="w-20 p-2 bg-white border border-stone-200 rounded-lg text-sm"
                        value={rangeStart}
                        onChange={(e) => setRangeStart(e.target.value)}
                      />
                      <input 
                        type="number" 
                        placeholder="إلى"
                        className="w-20 p-2 bg-white border border-stone-200 rounded-lg text-sm"
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(e.target.value)}
                      />
                      <button 
                        onClick={handleApplyRange}
                        className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-bold hover:bg-stone-900"
                      >
                        تطبيق النطاق
                      </button>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <p className="text-sm font-bold text-stone-600">المحدد: {selectedPendingIndices.size}</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSelectedPendingIndices(new Set(pendingChapters.map((_, i) => i)))}
                        className="text-xs text-emerald-600 font-bold hover:underline"
                      >
                        تحديد الكل
                      </button>
                      <button 
                        onClick={() => setSelectedPendingIndices(new Set())}
                        className="text-xs text-red-600 font-bold hover:underline"
                      >
                        إلغاء الكل
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {pendingChapters.map((chapter, idx) => (
                  <div 
                    key={idx}
                    onClick={() => togglePendingSelection(idx)}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer",
                      selectedPendingIndices.has(idx) 
                        ? "bg-emerald-50 border-emerald-200" 
                        : "bg-white border-stone-100 hover:border-stone-200",
                      chapter.isDuplicate && "opacity-60"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded border flex items-center justify-center",
                      selectedPendingIndices.has(idx) ? "bg-emerald-500 border-emerald-500 text-white" : "border-stone-300"
                    )}>
                      {selectedPendingIndices.has(idx) && <Check size={12} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-stone-400">#{chapter.chapter_number}</span>
                        <span className="font-bold text-stone-700">{chapter.title}</span>
                      </div>
                      {chapter.isDuplicate && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">موجود مسبقاً</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-stone-100 bg-white">
                <button 
                  onClick={handleConfirmUpload}
                  disabled={isUploading || selectedPendingIndices.size === 0}
                  className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isUploading ? <Loader2 className="animate-spin" /> : <Upload size={20} />}
                  حفظ الفصول المختارة ({selectedPendingIndices.size})
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
