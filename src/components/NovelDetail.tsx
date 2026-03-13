import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, type Novel, type Chapter } from '../supabase';
import { 
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
  Loader2,
  Check,
  Download,
  Plus,
  Wifi,
  WifiOff,
  CloudUpload,
  FileSearch,
  AlertCircle,
  CheckCircle2,
  StickyNote,
  Link2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ePub from 'epubjs';
import { ScraperModal } from './ScraperModal';
import { CleaningRulesModal } from './CleaningRulesModal';
import { Settings2 } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const NovelDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [novel, setNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [arabicContent, setArabicContent] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('pending_sync');
    return saved ? JSON.parse(saved) : {};
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isEditingTotalChapters, setIsEditingTotalChapters] = useState(false);
  const [editedTotalChapters, setEditedTotalChapters] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [isScraperOpen, setIsScraperOpen] = useState(false);
  const [isCleaningRulesOpen, setIsCleaningRulesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chapterFilter, setChapterFilter] = useState<'all' | 'translated' | 'untranslated'>('all');
  const [pendingChapters, setPendingChapters] = useState<any[]>([]);
  const [showUploadPreview, setShowUploadPreview] = useState(false);
  const [selectedPendingIndices, setSelectedPendingIndices] = useState<Set<number>>(new Set());
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [downloadRangeStart, setDownloadRangeStart] = useState('');
  const [downloadRangeEnd, setDownloadRangeEnd] = useState('');
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [checkResults, setCheckResults] = useState<{ missing: number[], max: number } | null>(null);
  const [deleteRangeStart, setDeleteRangeStart] = useState('');
  const [deleteRangeEnd, setDeleteRangeEnd] = useState('');

  useEffect(() => {
    if (id) {
      fetchNovel(id);
      fetchChapters(id);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [id]);

  useEffect(() => {
    localStorage.setItem('pending_sync', JSON.stringify(pendingSync));
  }, [pendingSync]);

  const syncPending = async () => {
    if (!isOnline || Object.keys(pendingSync).length === 0 || isSyncing) return;
    
    setIsSyncing(true);
    const newPending = { ...pendingSync };
    
    try {
      for (const [chapterId, content] of Object.entries(pendingSync)) {
        const { error } = await supabase
          .from('chapters')
          .update({ content_arabic: content })
          .eq('id', chapterId);
        
        if (!error) {
          delete newPending[chapterId];
        }
      }
      setPendingSync(newPending);
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (isOnline) {
      syncPending();
    }
  }, [isOnline]);

  const fetchNovel = async (novelId: string) => {
    const { data, error } = await supabase
      .from('novels')
      .select('*')
      .eq('id', novelId)
      .single();
    
    if (error) {
      console.error('Error fetching novel:', error);
      navigate('/');
    } else {
      setNovel(data);
      setEditedTitle(data.title);
      setEditedTotalChapters(data.total_chapters?.toString() || '');
      setEditedNotes(data.notes || '');
    }
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
      if (!selectedChapter || !allChapters.find(c => c.id === selectedChapter.id)) {
        setSelectedChapter(allChapters[0]);
        setArabicContent(allChapters[0].content_arabic || '');
      }
    }
    setIsLoading(false);
  };

  const handleDeleteSelected = async () => {
    if (selectedChapterIds.size === 0 || !novel) return;
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
      fetchChapters(novel.id);
    }
    setIsLoading(false);
  };

  const handleDeleteRange = async () => {
    const start = parseInt(deleteRangeStart);
    const end = parseInt(deleteRangeEnd);
    if (isNaN(start) || isNaN(end) || !novel) {
      alert('يرجى إدخال نطاق صحيح');
      return;
    }

    if (!confirm(`هل أنت متأكد من حذف الفصول من ${start} إلى ${end}؟`)) return;

    setIsLoading(true);
    const { error } = await supabase
      .from('chapters')
      .delete()
      .eq('novel_id', novel.id)
      .gte('chapter_number', start)
      .lte('chapter_number', end);

    if (error) {
      alert('خطأ في حذف نطاق الفصول');
    } else {
      if (selectedChapter && selectedChapter.chapter_number >= start && selectedChapter.chapter_number <= end) {
        setSelectedChapter(null);
        setArabicContent('');
      }
      setDeleteRangeStart('');
      setDeleteRangeEnd('');
      fetchChapters(novel.id);
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

  const handleConfirmUpload = async () => {
    if (!novel || selectedPendingIndices.size === 0) return;

    setIsUploading(true);
    const chaptersToUpload = pendingChapters
      .filter((_, idx) => selectedPendingIndices.has(idx))
      .map(({ isDuplicate, ...rest }) => rest);

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
      fetchChapters(novel.id);
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
    if (!file || !novel) return;

    setIsUploading(true);
    
    let allExistingChapters: { chapter_number: number }[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('chapters')
        .select('chapter_number')
        .eq('novel_id', novel.id)
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

    const isEpub = file.name.toLowerCase().endsWith('.epub');

    if (isEpub) {
      try {
        const book = ePub(await file.arrayBuffer());
        const spine = await book.loaded.spine;
        const parsedChapters: any[] = [];
        let currentMax = maxExistingNum;

        for (let i = 0; i < spine.length; i++) {
          const item = (spine as any).get(i);
          if (!item) continue;
          
          const html = await item.load(book.load.bind(book));
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const textContent = doc.body.textContent || "";
          
          if (textContent.trim().length < 50) continue;

          const chapterRegex = /(?:第\s*(\d+)\s*(?:章|节|回)|Chapter\s*(\d+)|الفصل\s*(\d+)|(\d+)\s*:)/gi;
          const match = chapterRegex.exec(textContent);
          
          let chapterNum: number;
          if (match) {
            chapterNum = parseInt(match[1] || match[2] || match[3] || match[4]);
          } else {
            chapterNum = currentMax + 1;
          }
          
          if (!isNaN(chapterNum)) {
            currentMax = Math.max(currentMax, chapterNum);
            
            const lines = textContent.trim().split('\n');
            const title = lines[0].trim().substring(0, 100);
            const content = lines.slice(1).join('\n').trim();

            parsedChapters.push({
              novel_id: novel.id,
              chapter_number: chapterNum,
              title: title || `الفصل ${chapterNum}`,
              content_original: content || textContent.trim(),
              isDuplicate: existingNumbers.has(chapterNum)
            });
          }
        }
        
        setPendingChapters(parsedChapters);
        setSelectedPendingIndices(new Set(
          parsedChapters
            .map((c, idx) => c.isDuplicate ? -1 : idx)
            .filter(idx => idx !== -1)
        ));
        setShowUploadPreview(true);
        setIsUploading(false);
        return;
      } catch (err) {
        console.error('Error parsing EPUB:', err);
        alert('حدث خطأ أثناء قراءة ملف EPUB');
        setIsUploading(false);
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      
      const chapterRegex = /(?:第\s*(\d+)\s*(?:章|节|回)|Chapter\s*(\d+)|الفصل\s*(\d+)|(\d+)\s*:)/gi;
      const markers = Array.from(text.matchAll(chapterRegex));
      
      const parsedChapters: any[] = [];
      
      if (markers.length === 0) {
        const nextNum = maxExistingNum + 1;
        parsedChapters.push({
          novel_id: novel.id,
          chapter_number: nextNum,
          title: `الفصل ${nextNum}`,
          content_original: text.trim(),
          isDuplicate: existingNumbers.has(nextNum)
        });
      } else {
        for (let i = 0; i < markers.length; i++) {
          const match = markers[i];
          const extractedNum = parseInt(match[1] || match[2] || match[3] || match[4]);
          const chapterNum = isNaN(extractedNum) ? (maxExistingNum + i + 1) : extractedNum;
          
          const start = match.index!;
          const end = markers[i + 1] ? markers[i + 1].index : text.length;
          const fullContent = text.substring(start, end).trim();
          
          const lines = fullContent.split('\n');
          const title = lines[0].trim();
          const content = lines.slice(1).join('\n').trim();

          parsedChapters.push({
            novel_id: novel.id,
            chapter_number: chapterNum,
            title: title,
            content_original: content || fullContent,
            isDuplicate: existingNumbers.has(chapterNum)
          });
        }
      }

      setPendingChapters(parsedChapters);
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

    if (!isOnline) {
      setPendingSync(prev => ({
        ...prev,
        [selectedChapter.id]: arabicContent
      }));
      
      const updatedChapters = chapters.map(c => c.id === selectedChapter.id ? { ...c, content_arabic: arabicContent } : c);
      setChapters(updatedChapters);
      
      alert('تم الحفظ محلياً (أنت غير متصل). سيتم الرفع تلقائياً عند عودة الإنترنت.');
      
      const next = updatedChapters.find(c => !c.content_arabic || c.content_arabic.trim().length === 0);
      if (next) {
        setSelectedChapter(next);
        setArabicContent(next.content_arabic || '');
      }
      return;
    }

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
      
      const next = updatedChapters.find(c => !c.content_arabic || c.content_arabic.trim().length === 0);
      if (next) {
        setSelectedChapter(next);
        setArabicContent(next.content_arabic || '');
      }
    }
  };

  const handleUpdateNovelTitle = async () => {
    if (!novel || !editedTitle.trim()) return;

    const { error } = await supabase
      .from('novels')
      .update({ title: editedTitle })
      .eq('id', novel.id);

    if (error) {
      alert('خطأ في تحديث العنوان');
    } else {
      setNovel({ ...novel, title: editedTitle });
      setIsEditingTitle(false);
    }
  };

  const handleUpdateTotalChapters = async () => {
    if (!novel) return;
    const total = parseInt(editedTotalChapters);
    if (isNaN(total) && editedTotalChapters !== '') {
      alert('يرجى إدخال رقم صحيح');
      return;
    }

    const { error } = await supabase
      .from('novels')
      .update({ total_chapters: isNaN(total) ? null : total })
      .eq('id', novel.id);

    if (error) {
      alert('خطأ في تحديث عدد الفصول');
    } else {
      setNovel({ ...novel, total_chapters: isNaN(total) ? undefined : total });
      setIsEditingTotalChapters(false);
    }
  };

  const handleUpdateNotes = async () => {
    if (!novel) return;

    const { error } = await supabase
      .from('novels')
      .update({ notes: editedNotes })
      .eq('id', novel.id);

    if (error) {
      alert('خطأ في تحديث الملاحظات');
    } else {
      setNovel({ ...novel, notes: editedNotes });
      setIsEditingNotes(false);
    }
  };

  const handleReorderChapters = async (newOrder: Chapter[]) => {
    const updatedChapters = newOrder.map((chap, index) => ({
      ...chap,
      chapter_number: index + 1
    }));
    setChapters(updatedChapters);

    const updates = updatedChapters.map(chap => 
      supabase.from('chapters').update({ chapter_number: chap.chapter_number }).eq('id', chap.id)
    );

    const results = await Promise.all(updates);
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Errors updating chapter order:', errors);
      if (novel) fetchChapters(novel.id);
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
    if (!novel || chapters.length === 0) return;

    const start = parseInt(downloadRangeStart);
    const end = parseInt(downloadRangeEnd);

    let translatedChapters = chapters
      .filter(c => c.content_arabic && c.content_arabic.trim().length > 0);

    if (!isNaN(start) && !isNaN(end)) {
      translatedChapters = translatedChapters.filter(c => c.chapter_number >= start && c.chapter_number <= end);
    }

    translatedChapters.sort((a, b) => a.chapter_number - b.chapter_number);

    if (translatedChapters.length === 0) {
      alert('لا توجد فصول مترجمة في هذا النطاق لتحميلها');
      return;
    }

    const content = translatedChapters
      .map(c => `الفصل ${c.chapter_number}\n\n${c.content_arabic}`)
      .join('\n\n' + '='.repeat(30) + '\n\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const rangeSuffix = !isNaN(start) && !isNaN(end) ? `_من_${start}_إلى_${end}` : '';
    a.download = `${novel.title}${rangeSuffix}_ترجمة.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowDownloadModal(false);
  };

  const checkMissingChapters = () => {
    if (chapters.length === 0 && !novel?.total_chapters) return;

    const numbers = chapters.map(c => c.chapter_number).sort((a, b) => a - b);
    const min = 1;
    const max = novel?.total_chapters || Math.max(...numbers);
    const missing = [];

    const numSet = new Set(numbers);
    for (let i = min; i <= max; i++) {
      if (!numSet.has(i)) {
        missing.push(i);
      }
    }

    setCheckResults({ missing, max });
    setShowCheckModal(true);
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

  if (!novel) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-stone-400">
        <Loader2 className="animate-spin mb-4" size={40} />
        <p>جاري تحميل الرواية...</p>
      </div>
    );
  }

  return (
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
          src={novel.cover_url} 
          alt={novel.title} 
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
                  <h2 className="text-3xl font-black text-stone-900">{novel.title}</h2>
                  <button 
                    onClick={() => {
                      setEditedTitle(novel.title);
                      setIsEditingTitle(true);
                    }}
                    className="p-2 text-stone-400 hover:text-emerald-600 transition-colors"
                  >
                    <Edit size={20} />
                  </button>
                </div>
                {novel.original_title && (
                  <p className="text-stone-500 font-medium">{novel.original_title}</p>
                )}
                {novel.source_url && (
                  <a 
                    href={novel.source_url} 
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

          {/* Notes Section */}
          <div className="mt-6 bg-stone-50 rounded-xl p-4 border border-stone-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-stone-700 font-bold">
                <StickyNote size={18} className="text-emerald-600" />
                <span>ملاحظات الرواية</span>
              </div>
              {!isEditingNotes && (
                <button 
                  onClick={() => setIsEditingNotes(true)}
                  className="text-stone-400 hover:text-emerald-600 transition-colors"
                >
                  <Edit size={16} />
                </button>
              )}
            </div>
            
            {isEditingNotes ? (
              <div className="space-y-3">
                <textarea
                  className="w-full bg-white border border-stone-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px]"
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  placeholder="أضف ملاحظاتك هنا..."
                />
                <div className="flex justify-end gap-2">
                  <button 
                    onClick={() => setIsEditingNotes(false)}
                    className="px-3 py-1.5 text-sm text-stone-500 hover:text-stone-700"
                  >
                    إلغاء
                  </button>
                  <button 
                    onClick={handleUpdateNotes}
                    className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-1"
                  >
                    <Check size={16} />
                    <span>حفظ الملاحظات</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-stone-600 text-sm whitespace-pre-wrap leading-relaxed">
                {novel.notes ? novel.notes : (
                  <span className="text-stone-400 italic">لا توجد ملاحظات لهذه الرواية بعد.</span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 mt-6">
            <div className="bg-stone-100 px-4 py-2 rounded-lg text-sm font-medium text-stone-600 flex items-center gap-2">
              <span>الفصول المخزنة: {chapters.length}</span>
            </div>
            
            {isEditingTotalChapters ? (
              <div className="flex items-center gap-2 bg-stone-100 px-2 py-1 rounded-lg">
                <input 
                  type="number"
                  className="w-20 bg-white border border-stone-200 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                  value={editedTotalChapters}
                  onChange={(e) => setEditedTotalChapters(e.target.value)}
                  placeholder="الإجمالي"
                  autoFocus
                />
                <button onClick={handleUpdateTotalChapters} className="text-emerald-600 hover:text-emerald-700">
                  <Check size={16} />
                </button>
                <button onClick={() => setIsEditingTotalChapters(false)} className="text-stone-400 hover:text-stone-600">
                  <Plus size={16} className="rotate-45" />
                </button>
              </div>
            ) : (
              <div className="bg-stone-100 px-4 py-2 rounded-lg text-sm font-medium text-stone-600 flex items-center gap-2">
                <span>إجمالي الفصول: {novel.total_chapters || 'غير محدد'}</span>
                <button 
                  onClick={() => {
                    setEditedTotalChapters(novel.total_chapters?.toString() || '');
                    setIsEditingTotalChapters(true);
                  }}
                  className="text-stone-400 hover:text-emerald-600 transition-colors"
                >
                  <Edit size={14} />
                </button>
              </div>
            )}
            <div className="bg-emerald-100 px-4 py-2 rounded-lg text-sm font-medium text-emerald-700 flex items-center gap-2">
              <span>المترجمة: {translatedCount}</span>
              <span className="text-xs opacity-60">({Math.round((translatedCount / (novel.total_chapters || chapters.length || 1)) * 100)}%)</span>
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
              onClick={() => {
                setDownloadRangeStart('1');
                setDownloadRangeEnd(chapters.length.toString());
                setShowDownloadModal(true);
              }}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <Download size={16} />
              <span>تحميل الترجمة (.txt)</span>
            </button>
            <button 
              onClick={checkMissingChapters}
              className="bg-stone-100 text-stone-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-stone-200 transition-colors flex items-center gap-2 border border-stone-200"
              title="فحص الفصول المفقودة"
            >
              <FileSearch size={16} />
              <span>فحص النقص</span>
            </button>
          </div>
          
          <div className="pt-4 flex gap-4">
            <motion.label 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-xl cursor-pointer hover:bg-stone-800 transition-all shadow-lg"
            >
              <Upload size={20} />
              <span>رفع ملف الرواية (TXT / EPUB)</span>
              <input 
                type="file" 
                accept=".txt,.epub" 
                className="hidden" 
                onChange={handleFileUpload}
                disabled={isUploading}
              />
            </motion.label>
            <motion.button 
              onClick={() => setIsScraperOpen(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 bg-white text-stone-700 px-6 py-3 rounded-xl border border-stone-200 hover:bg-stone-50 transition-all shadow-sm"
            >
              <Link2 size={20} className="text-emerald-600" />
              <span>سحب من رابط</span>
            </motion.button>
            <motion.button 
              onClick={() => setIsCleaningRulesOpen(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 bg-white text-stone-700 px-6 py-3 rounded-xl border border-stone-200 hover:bg-stone-50 transition-all shadow-sm"
              title="قواعد تنظيف الفصول"
            >
              <Settings2 size={20} className="text-amber-600" />
              <span>تنظيف الفصول</span>
            </motion.button>
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
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors shadow-sm",
                        !isOnline ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      )}
                    >
                      {isSyncing ? <Loader2 className="animate-spin" size={18} /> : (!isOnline ? <CloudUpload size={18} /> : <Save size={18} />)}
                      <span className="hidden sm:inline">{!isOnline ? 'حفظ محلي' : 'حفظ الترجمة'}</span>
                    </button>
                  </div>
                </div>

                {!isOnline && (
                  <div className="bg-amber-50 px-6 py-2 border-b border-amber-100 flex items-center gap-2 text-amber-700 text-xs font-bold">
                    <WifiOff size={14} />
                    <span>أنت تعمل بدون إنترنت. سيتم حفظ التغييرات محلياً ومزامنتها لاحقاً.</span>
                  </div>
                )}

                {Object.keys(pendingSync).length > 0 && isOnline && (
                  <div className="bg-emerald-50 px-6 py-2 border-b border-emerald-100 flex items-center justify-between text-emerald-700 text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <CloudUpload size={14} />
                      <span>لديك {Object.keys(pendingSync).length} تعديلات بانتظار المزامنة.</span>
                    </div>
                    <button onClick={syncPending} disabled={isSyncing} className="underline hover:no-underline">
                      {isSyncing ? 'جاري المزامنة...' : 'مزامنة الآن'}
                    </button>
                  </div>
                )}

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

      {/* Scraper Modal */}
      <AnimatePresence>
        {isScraperOpen && novel && (
          <ScraperModal 
            isOpen={isScraperOpen}
            onClose={() => setIsScraperOpen(false)}
            novels={[novel]}
            initialNovelId={novel.id}
            onSuccess={fetchChapters}
          />
        )}
      </AnimatePresence>

      {/* Cleaning Rules Modal */}
      <AnimatePresence>
        {isCleaningRulesOpen && novel && (
          <CleaningRulesModal 
            isOpen={isCleaningRulesOpen}
            onClose={() => setIsCleaningRulesOpen(false)}
            novelId={novel.id}
          />
        )}
      </AnimatePresence>

      {/* Check Missing Chapters Modal */}
      <AnimatePresence>
        {showCheckModal && checkResults && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCheckModal(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <h3 className="text-xl font-bold">نتائج فحص الفصول</h3>
                <button onClick={() => setShowCheckModal(false)} className="text-stone-400 hover:text-stone-600">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                {checkResults.missing.length === 0 ? (
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                      <CheckCircle2 size={32} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-stone-800">التسلسل مكتمل!</h4>
                      <p className="text-sm text-stone-500">لا توجد فصول مفقودة في التسلسل من 1 إلى {checkResults.max}.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-amber-600">
                      <AlertCircle size={24} />
                      <h4 className="text-lg font-bold">تم العثور على نقص</h4>
                    </div>
                    <p className="text-sm text-stone-600">
                      هناك <span className="font-bold text-stone-900">{checkResults.missing.length}</span> فصل مفقود في التسلسل:
                    </p>
                    <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 max-h-40 overflow-y-auto">
                      <p className="font-mono text-sm text-stone-600 leading-relaxed">
                        {checkResults.missing.join(', ')}
                      </p>
                    </div>
                    <p className="text-xs text-stone-400 italic">
                      * الفحص يعتمد على أرقام الفصول من 1 إلى {checkResults.max}.
                    </p>
                  </div>
                )}

                <button 
                  onClick={() => setShowCheckModal(false)}
                  className="w-full bg-stone-900 text-white py-4 rounded-xl font-bold hover:bg-stone-800 transition-all"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Download Range Modal */}
      <AnimatePresence>
        {showDownloadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDownloadModal(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <h3 className="text-xl font-bold">تحميل الفصول المترجمة</h3>
                <button onClick={() => setShowDownloadModal(false)} className="text-stone-400 hover:text-stone-600">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <p className="text-sm text-stone-500">اختر نطاق الفصول التي تريد تحميلها في ملف نصي واحد.</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-600 uppercase">من فصل</label>
                    <input 
                      type="number" 
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={downloadRangeStart}
                      onChange={(e) => setDownloadRangeStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-600 uppercase">إلى فصل</label>
                    <input 
                      type="number" 
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={downloadRangeEnd}
                      onChange={(e) => setDownloadRangeEnd(e.target.value)}
                    />
                  </div>
                </div>

                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                  <p className="text-xs text-emerald-700 font-medium">
                    سيتم تحميل الفصول المترجمة فقط ضمن هذا النطاق.
                  </p>
                </div>

                <button 
                  onClick={handleDownloadTranslated}
                  className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
                >
                  <Download size={20} />
                  تحميل الملف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload Preview Modal */}
      <AnimatePresence>
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
    </motion.div>
  );
};
