import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, type Novel, type Chapter } from '../supabase';
import { 
  Book, 
  Upload, 
  Copy, 
  Clipboard,
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
  Eye,
  Download,
  Plus,
  Wifi,
  WifiOff,
  CloudUpload,
  FileSearch,
  AlertCircle,
  CheckCircle2,
  StickyNote,
  Link2,
  ExternalLink,
  Maximize2,
  Minimize2,
  RefreshCw,
  Globe,
  Sparkles,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ePub from 'epubjs';
import { ScraperModal } from './ScraperModal';
import { CleaningRulesModal } from './CleaningRulesModal';
import { GeminiTranslateModal } from './GeminiTranslateModal';
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
  const [isGeminiTranslateOpen, setIsGeminiTranslateOpen] = useState(false);
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
  const [previewPendingChapter, setPreviewPendingChapter] = useState<any | null>(null);
  const [showEmbeddedBrowser, setShowEmbeddedBrowser] = useState(false);
  const [browserWidth, setBrowserWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
  const [isQuickCopyMode, setIsQuickCopyMode] = useState(false);
  const [quickCopyNumbers, setQuickCopyNumbers] = useState<number[]>([]);
  const [quickCopyStates, setQuickCopyStates] = useState<Record<number, 'idle' | 'copied' | 'saving'>>({});

  useEffect(() => {
    if (id) {
      fetchNovel(id);
      fetchChapters(id);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = window.innerWidth - e.clientX;
        setBrowserWidth(Math.max(300, Math.min(window.innerWidth * 0.8, newWidth)));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [id, isResizing]);

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
    const chapterIds = Array.from(selectedChapterIds);
    const batchSize = 100;
    let hasError = false;

    for (let i = 0; i < chapterIds.length; i += batchSize) {
      const batch = chapterIds.slice(i, i + batchSize);
      const { error } = await supabase
        .from('chapters')
        .delete()
        .in('id', batch);
      
      if (error) {
        console.error('Error deleting batch:', error);
        hasError = true;
        break;
      }
    }

    if (hasError) {
      alert('حدث خطأ أثناء حذف بعض الفصول');
    } else {
      if (selectedChapter && chapterIds.includes(selectedChapter.id)) {
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
      // alert(`تم رفع ${finalChaptersToUpload.length} فصل بنجاح.`);
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
        await book.ready;
        
        const parsedChapters: any[] = [];
        let currentMax = maxExistingNum;

        // Iterate through spine items
        for (const item of (book.spine as any).spineItems) {
          try {
            const content = await item.load(book.load.bind(book));
            const doc = (typeof content === 'string') 
              ? new DOMParser().parseFromString(content, 'text/html')
              : content as Document;
            
            if (!doc || !doc.body) continue;

            // Try to get title from headers
            let title = "";
            const header = doc.querySelector('h1, h2, h3, h4, h5, h6');
            if (header) {
              title = header.textContent?.trim() || "";
            }

            const textContent = doc.body.textContent || "";
            const trimmedText = textContent.trim();
            
            // Skip very short sections (like nav, title page)
            if (trimmedText.length < 20) continue;

            const chapterRegex = /(?:第\s*(\d+)\s*(?:章|节|回)|Chapter\s*(\d+)|الفصل\s*(\d+))/i;
            const match = trimmedText.match(chapterRegex);
            
            let chapterNum: number;
            if (match) {
              chapterNum = parseInt(match[1] || match[2] || match[3] || match[4]);
            } else {
              chapterNum = currentMax + 1;
            }
            
            if (!isNaN(chapterNum)) {
              currentMax = Math.max(currentMax, chapterNum);
              
              if (!title) {
                const lines = trimmedText.split('\n');
                title = lines[0].trim().substring(0, 100);
              }

              const lines = trimmedText.split('\n');
              const content = lines.length > 1 ? lines.slice(1).join('\n').trim() : trimmedText;

              parsedChapters.push({
                novel_id: novel.id,
                chapter_number: chapterNum,
                title: title || `الفصل ${chapterNum}`,
                content_original: content || trimmedText,
                isDuplicate: existingNumbers.has(chapterNum)
              });
            }
          } catch (itemErr) {
            console.error('Error parsing spine item:', itemErr);
          }
        }
        
        setPendingChapters(parsedChapters);
        setSelectedPendingIndices(new Set(
          parsedChapters
            .map((c, idx) => (c.isDuplicate || !c.content_original?.trim()) ? -1 : idx)
            .filter(idx => idx !== -1)
        ));
        setShowUploadPreview(true);
        setIsUploading(false);
        return;
      } catch (err) {
        console.error('Error parsing EPUB:', err);
        alert('حدث خطأ أثناء قراءة ملف EPUB. تأكد من أن الملف غير محمي (DRM-free).');
        setIsUploading(false);
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      
      // Improved regex: matches at start of line, removed aggressive (\d+): which caught timestamps
      const chapterRegex = /^\s*(?:第\s*(\d+)\s*(?:章|节|回)|Chapter\s*(\d+)|الفصل\s*(\d+))/gim;
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
        // Handle content before the first marker (e.g., intro, title page)
        const firstMarkerIndex = markers[0].index!;
        if (firstMarkerIndex > 10) {
          const introText = text.substring(0, firstMarkerIndex).trim();
          if (introText.length > 50) { // Only add if it's substantial
            parsedChapters.push({
              novel_id: novel.id,
              chapter_number: 0,
              title: "مقدمة / تمهيد",
              content_original: introText,
              isDuplicate: false
            });
          }
        }

        for (let i = 0; i < markers.length; i++) {
          const match = markers[i];
          const extractedNum = parseInt(match[1] || match[2] || match[3] || "");
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
          .map((c, idx) => (c.isDuplicate || !c.content_original?.trim()) ? -1 : idx)
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
      // alert('تم حفظ الترجمة بنجاح');
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
      }
    } catch (err) {
      console.error('Failed to copy: ', err);
      // alert('فشل النسخ. يرجى المحاولة مرة أخرى أو النسخ يدوياً.');
    }
  };

  const handlePaste = async () => {
    try {
      let text = "";
      if (navigator.clipboard && window.isSecureContext) {
        try {
          text = await navigator.clipboard.readText();
        } catch (e) {
          console.error("Clipboard read failed, using prompt fallback", e);
          text = prompt("يرجى لصق النص هنا:") || "";
        }
      } else {
        text = prompt("يرجى لصق النص هنا:") || "";
      }

      if (text) {
        setArabicContent(text);
      }
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
      alert('فشل في قراءة الحافظة. يرجى استخدام Ctrl+V يدوياً.');
    }
  };

  const handlePasteToOriginal = async () => {
    if (!selectedChapter) return;
    try {
      let text = "";
      if (navigator.clipboard && window.isSecureContext) {
        try {
          text = await navigator.clipboard.readText();
        } catch (e) {
          console.error("Clipboard read failed, using prompt fallback", e);
          text = prompt("يرجى لصق النص الأصلي هنا:") || "";
        }
      } else {
        text = prompt("يرجى لصق النص الأصلي هنا:") || "";
      }

      if (text) {
        const { error } = await supabase
          .from('chapters')
          .update({ content_original: text })
          .eq('id', selectedChapter.id);
        
        if (error) throw error;
        
        setChapters(prev => prev.map(c => c.id === selectedChapter.id ? { ...c, content_original: text } : c));
        setSelectedChapter(prev => prev ? { ...prev, content_original: text } : null);
      }
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
      alert('فشل في قراءة الحافظة. يرجى استخدام Ctrl+V يدوياً.');
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

  const enterQuickCopyMode = () => {
    const lastTranslatedChapter = [...chapters]
      .filter(c => c.content_arabic && c.content_arabic.trim().length > 0)
      .sort((a, b) => b.chapter_number - a.chapter_number)[0];
    const lastNum = lastTranslatedChapter ? lastTranslatedChapter.chapter_number : 1;
    
    const initialNums = chapters
      .map(c => c.chapter_number)
      .filter(num => num >= lastNum)
      .sort((a, b) => a - b)
      .slice(0, 4);
      
    setQuickCopyNumbers(initialNums);
    setIsQuickCopyMode(true);
  };

  const handleQuickCopy = async (num: number) => {
    const chapter = chapters.find(c => c.chapter_number === num);
    if (!chapter) {
      alert(`الفصل ${num} غير موجود في المستودع`);
      return;
    }

    const currentState = quickCopyStates[num] || 'idle';

    if (currentState === 'idle') {
      // First Click: Copy chapter content and turn red
      await copyToClipboard(`${chapter.title}\n\n${chapter.content_original}`);
      setQuickCopyStates(prev => ({ ...prev, [num]: 'copied' }));
    } else if (currentState === 'copied') {
      // Second Click: Try to paste and save automatically
      try {
        setQuickCopyStates(prev => ({ ...prev, [num]: 'saving' }));
        
        let pastedText = "";
        try {
          if (navigator.clipboard && window.isSecureContext) {
            pastedText = await navigator.clipboard.readText();
          } else {
            throw new Error("Clipboard API not available");
          }
        } catch (e) {
          console.error("Automatic clipboard read failed:", e);
          alert("فشل اللصق التلقائي. يرجى التأكد من منح إذن الوصول للحافظة في المتصفح، أو استخدم زر اللصق اليدوي في صفحة الفصل.");
          setQuickCopyStates(prev => ({ ...prev, [num]: 'copied' }));
          return;
        }

        if (pastedText && pastedText.trim().length > 0) {
          // Save the translation
          const { error } = await supabase
            .from('chapters')
            .update({ content_arabic: pastedText })
            .eq('id', chapter.id);

          if (error) throw error;

          // Update local state
          setChapters(prev => prev.map(c => c.id === chapter.id ? { ...c, content_arabic: pastedText } : c));
          
          // Advance logic
          setQuickCopyNumbers(prev => {
            const currentMax = Math.max(...prev);
            const nextChapter = chapters
              .map(c => c.chapter_number)
              .filter(n => n > currentMax)
              .sort((a, b) => a - b)[0];
            
            if (nextChapter) {
              return prev.map(n => n === num ? nextChapter : n).sort((a, b) => a - b);
            } else {
              return prev.filter(n => n !== num).sort((a, b) => a - b);
            }
          });
          
          // Reset state for this number
          setQuickCopyStates(prev => {
            const newState = { ...prev };
            delete newState[num];
            return newState;
          });
        } else {
          alert("الحافظة فارغة! يرجى نسخ النص المترجم أولاً.");
          setQuickCopyStates(prev => ({ ...prev, [num]: 'copied' }));
        }
      } catch (err) {
        console.error("Failed to save translation in Quick Copy Mode:", err);
        setQuickCopyStates(prev => ({ ...prev, [num]: 'copied' }));
      }
    }
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
      <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
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
      {/* Quick Copy Mode Overlay */}
      <AnimatePresence>
        {isQuickCopyMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-bg-primary/95 backdrop-blur-md flex flex-col items-center justify-center p-6"
          >
            <button 
              onClick={() => setIsQuickCopyMode(false)}
              className="absolute top-4 right-4 sm:top-8 sm:right-8 p-2 sm:p-4 bg-bg-secondary border border-border-primary rounded-full text-text-secondary hover:text-red-500 transition-all shadow-lg"
            >
              <Plus size={24} className="rotate-45 sm:w-8 sm:h-8" />
            </button>
            
            <div className="text-center mb-8 sm:mb-12 space-y-2 sm:space-y-4">
              <motion.div 
                initial={{ y: -20 }}
                animate={{ y: 0 }}
                className="w-12 h-12 sm:w-20 sm:h-20 bg-emerald-600 rounded-2xl sm:rounded-3xl mx-auto flex items-center justify-center text-white shadow-2xl shadow-emerald-500/20 mb-4 sm:mb-6"
              >
                <Zap size={24} className="sm:w-10 sm:h-10" fill="currentColor" />
              </motion.div>
              <h2 className="text-2xl sm:text-4xl font-black text-text-primary">وضع النسخ السريع</h2>
              <p className="text-text-secondary text-sm sm:text-lg font-medium">اضغط على الفصل لنسخ النص الأصلي</p>
            </div>

            <div className="flex items-center gap-3 bg-bg-secondary p-2 px-4 rounded-2xl border border-border-primary mb-8 shadow-sm">
              <span className="text-text-secondary text-xs sm:text-sm font-bold">البدء من الفصل:</span>
              <input
                type="number"
                className="w-16 sm:w-24 bg-bg-primary border border-border-primary rounded-xl px-2 py-1 sm:py-2 text-center font-black text-emerald-600 focus:border-emerald-500 outline-none transition-colors"
                value={quickCopyNumbers[0] || ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) {
                    const newNums = chapters
                      .map(c => c.chapter_number)
                      .filter(num => num >= val)
                      .sort((a, b) => a - b)
                      .slice(0, 4);
                    setQuickCopyNumbers(newNums);
                  } else {
                    setQuickCopyNumbers([]);
                  }
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-6 w-full max-w-2xl">
              {quickCopyNumbers.map((num) => (
                <motion.button
                  key={num}
                  layout
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  whileHover={{ scale: 1.05, translateY: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleQuickCopy(num)}
                  className={`group relative overflow-hidden border-2 p-4 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl transition-all flex flex-col items-center gap-1 sm:gap-4 ${
                    quickCopyStates[num] === 'copied' 
                      ? "bg-red-500/10 border-red-500 text-red-600" 
                      : quickCopyStates[num] === 'saving'
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-600"
                        : "bg-bg-secondary border-border-primary hover:border-emerald-500"
                  }`}
                >
                  <div className={`absolute top-0 right-0 p-2 sm:p-3 rounded-bl-xl sm:rounded-bl-2xl transition-opacity ${
                    quickCopyStates[num] === 'copied' ? "bg-red-500/20 text-red-500 opacity-100" : "bg-emerald-500/10 text-emerald-500 opacity-0 group-hover:opacity-100"
                  }`}>
                    {quickCopyStates[num] === 'copied' ? <Zap size={14} className="sm:w-5 sm:h-5" /> : <Copy size={14} className="sm:w-5 sm:h-5" />}
                  </div>
                  <span className="text-[10px] sm:text-sm font-bold text-text-secondary uppercase tracking-widest">الفصل</span>
                  <span className={`text-3xl sm:text-6xl font-black transition-colors ${
                    quickCopyStates[num] === 'copied' ? "text-red-600" : "text-text-primary group-hover:text-emerald-600"
                  }`}>{num}</span>
                  {quickCopyStates[num] === 'copied' && (
                    <span className="text-[10px] sm:text-xs font-bold text-red-500 animate-pulse mt-1">اضغط للحفظ التلقائي</span>
                  )}
                  {quickCopyStates[num] === 'saving' && (
                    <Loader2 className="animate-spin text-emerald-500" size={20} />
                  )}
                </motion.button>
              ))}
            </div>
            
            <div className="mt-8 sm:mt-16 text-text-secondary text-xs sm:text-sm font-medium flex items-center gap-2 bg-bg-secondary px-4 py-2 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl border border-border-primary">
              <Sparkles size={16} className="sm:w-5 sm:h-5 text-emerald-500" />
              <span>سيتم نسخ النص الأصلي تلقائياً</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Novel Header Info */}
      <div className="flex flex-col md:flex-row gap-6 sm:gap-8 items-center sm:items-start bg-bg-primary p-4 sm:p-6 rounded-3xl border border-border-primary shadow-sm">
        <img 
          src={novel.cover_url} 
          alt={novel.title} 
          className="w-32 h-48 sm:w-40 sm:h-60 object-cover rounded-xl shadow-lg"
          referrerPolicy="no-referrer"
        />
        <div className="flex-1 space-y-4 w-full text-center sm:text-right">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
            {isEditingTitle ? (
              <div className="flex items-center gap-2 w-full">
                <input 
                  type="text"
                  className="text-xl sm:text-3xl font-black text-text-primary bg-bg-secondary border border-border-primary rounded-xl px-4 py-1 w-full outline-none focus:ring-2 focus:ring-emerald-500"
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
                  className="p-2 bg-bg-secondary text-text-secondary rounded-xl hover:bg-border-primary transition-colors"
                >
                  <Plus size={20} className="rotate-45" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1 w-full">
                <div className="flex items-center justify-center sm:justify-start gap-3">
                  <h2 className="text-2xl sm:text-3xl font-black text-text-primary">{novel.title}</h2>
                  <button 
                    onClick={() => {
                      setEditedTitle(novel.title);
                      setIsEditingTitle(true);
                    }}
                    className="p-2 text-text-secondary hover:text-emerald-600 transition-colors"
                  >
                    <Edit size={18} className="sm:w-5 sm:h-5" />
                  </button>
                </div>
                {novel.original_title && (
                  <p className="text-text-secondary font-medium text-sm sm:text-base">{novel.original_title}</p>
                )}
                {novel.source_url && (
                  <a 
                    href={novel.source_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-emerald-600 text-xs sm:text-sm hover:underline flex items-center justify-center sm:justify-start gap-1"
                  >
                    <ImageIcon size={14} />
                    رابط الرواية الأصلي
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div className="mt-4 sm:mt-6 bg-bg-secondary rounded-xl p-3 sm:p-4 border border-border-primary text-right">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-text-primary font-bold text-sm sm:text-base">
                <StickyNote size={16} className="text-emerald-600 sm:w-[18px] sm:h-[18px]" />
                <span>ملاحظات الرواية</span>
              </div>
              {!isEditingNotes && (
                <button 
                  onClick={() => setIsEditingNotes(true)}
                  className="text-text-secondary hover:text-emerald-600 transition-colors"
                >
                  <Edit size={14} className="sm:w-4 sm:h-4" />
                </button>
              )}
            </div>
            
            {isEditingNotes ? (
              <div className="space-y-3">
                <textarea
                  className="w-full bg-bg-primary border border-border-primary rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 min-h-[80px] sm:min-h-[100px] text-text-primary"
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  placeholder="أضف ملاحظاتك هنا..."
                />
                <div className="flex justify-end gap-2">
                  <button 
                    onClick={() => setIsEditingNotes(false)}
                    className="px-3 py-1.5 text-xs sm:text-sm text-text-secondary hover:text-text-primary"
                  >
                    إلغاء
                  </button>
                  <button 
                    onClick={handleUpdateNotes}
                    className="bg-emerald-600 text-white px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-1"
                  >
                    <Check size={14} className="sm:w-4 sm:h-4" />
                    <span>حفظ</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-text-secondary text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                {novel.notes ? novel.notes : (
                  <span className="text-text-secondary opacity-60 italic">لا توجد ملاحظات.</span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-center sm:justify-start gap-2 sm:gap-3 mt-4 sm:mt-6">
            <div className="bg-bg-secondary px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium text-text-secondary flex items-center gap-2">
              <span>المخزنة: {chapters.length}</span>
            </div>
            
            {isEditingTotalChapters ? (
              <div className="flex items-center gap-2 bg-bg-secondary px-2 py-1 rounded-lg">
                <input 
                  type="number"
                  className="w-16 sm:w-20 bg-bg-primary border border-border-primary rounded px-2 py-1 text-xs sm:text-sm outline-none focus:ring-1 focus:ring-emerald-500 text-text-primary"
                  value={editedTotalChapters}
                  onChange={(e) => setEditedTotalChapters(e.target.value)}
                  placeholder="الإجمالي"
                  autoFocus
                />
                <button onClick={handleUpdateTotalChapters} className="text-emerald-600 hover:text-emerald-700">
                  <Check size={14} className="sm:w-4 sm:h-4" />
                </button>
                <button onClick={() => setIsEditingTotalChapters(false)} className="text-text-secondary hover:text-text-primary">
                  <Plus size={14} className="rotate-45 sm:w-4 sm:h-4" />
                </button>
              </div>
            ) : (
              <div className="bg-bg-secondary px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium text-text-secondary flex items-center gap-2">
                <span>الإجمالي: {novel.total_chapters || '؟'}</span>
                <button 
                  onClick={() => {
                    setEditedTotalChapters(novel.total_chapters?.toString() || '');
                    setIsEditingTotalChapters(true);
                  }}
                  className="text-text-secondary hover:text-emerald-600 transition-colors"
                >
                  <Edit size={12} className="sm:w-[14px] sm:h-[14px]" />
                </button>
              </div>
            )}
            <div className="bg-emerald-500/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium text-emerald-500 flex items-center gap-2">
              <span>المترجمة: {translatedCount}</span>
              <span className="text-[10px] sm:text-xs opacity-60">({Math.round((translatedCount / (novel.total_chapters || chapters.length || 1)) * 100)}%)</span>
            </div>
            {nextUntranslated && (
              <button 
                onClick={handleGoToNextUntranslated}
                className="bg-stone-900 dark:bg-emerald-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-stone-800 dark:hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <span>التالي: {nextUntranslated.chapter_number}</span>
                <ChevronRight size={14} className="sm:w-4 sm:h-4" />
              </button>
            )}
            <button 
              onClick={() => {
                setDownloadRangeStart('1');
                setDownloadRangeEnd(chapters.length.toString());
                setShowDownloadModal(true);
              }}
              className="bg-emerald-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <Download size={14} className="sm:w-4 sm:h-4" />
              <span>تحميل (.txt)</span>
            </button>
            <button 
              onClick={checkMissingChapters}
              className="bg-bg-secondary text-text-secondary px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-border-primary transition-colors flex items-center gap-2 border border-border-primary"
              title="فحص الفصول المفقودة"
            >
              <FileSearch size={14} className="sm:w-4 sm:h-4" />
              <span>فحص النقص</span>
            </button>
          </div>
          
          <div className="pt-4 flex flex-wrap justify-center sm:justify-start gap-2 sm:gap-4">
            <motion.label 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 bg-stone-900 dark:bg-emerald-600 text-white px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl cursor-pointer hover:bg-stone-800 dark:hover:bg-emerald-700 transition-all shadow-lg text-xs sm:text-sm"
            >
              <Upload size={18} className="sm:w-5 sm:h-5" />
              <span>رفع ملف (TXT/EPUB)</span>
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
              className="flex items-center gap-2 bg-bg-primary text-text-primary px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl border border-border-primary hover:bg-bg-secondary transition-all shadow-sm text-xs sm:text-sm"
            >
              <Link2 size={18} className="text-emerald-600 sm:w-5 sm:h-5" />
              <span>سحب رابط</span>
            </motion.button>
            <motion.button 
              onClick={() => setIsGeminiTranslateOpen(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 text-xs sm:text-sm"
            >
              <Sparkles size={18} className="sm:w-5 sm:h-5" />
              <span>ترجمة Gemini</span>
            </motion.button>
            <motion.button 
              onClick={() => setShowEmbeddedBrowser(!showEmbeddedBrowser)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl border transition-all shadow-sm text-xs sm:text-sm",
                showEmbeddedBrowser 
                  ? "bg-emerald-600 text-white border-emerald-600" 
                  : "bg-bg-primary text-text-primary border-border-primary hover:bg-bg-secondary"
              )}
              title="فتح المتصفح المدمج للموقع الأصلي"
            >
              <Globe size={18} className={cn("sm:w-5 sm:h-5", showEmbeddedBrowser ? "text-white" : "text-blue-600")} />
              <span>المتصفح</span>
            </motion.button>
            <motion.button 
              onClick={() => setIsCleaningRulesOpen(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 bg-bg-primary text-text-primary px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl border border-border-primary hover:bg-bg-secondary transition-all shadow-sm text-xs sm:text-sm"
              title="قواعد تنظيف الفصول"
            >
              <Settings2 size={18} className="text-amber-600 sm:w-5 sm:h-5" />
              <span>تنظيف</span>
            </motion.button>
            <motion.button 
              onClick={enterQuickCopyMode}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 bg-emerald-600/10 text-emerald-600 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl border border-emerald-600/20 hover:bg-emerald-600/20 transition-all shadow-sm text-xs sm:text-sm"
              title="وضع النسخ السريع"
            >
              <Zap size={18} className="sm:w-5 sm:h-5" fill="currentColor" />
              <span>نسخ سريع</span>
            </motion.button>
            {isUploading && (
              <div className="flex items-center gap-2 text-emerald-600 font-medium text-xs sm:text-sm">
                <Loader2 className="animate-spin sm:w-5 sm:h-5" size={18} />
                <span>جاري الرفع...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chapter Viewer */}
      {chapters.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Chapter Sidebar/Selector */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-bg-primary p-4 rounded-2xl border border-border-primary shadow-sm">
              <h4 className="font-bold mb-4 flex items-center gap-2 text-text-primary">
                <Book size={18} className="text-emerald-600" />
                قائمة الفصول
              </h4>
              
              {/* Search Bar */}
              <div className="relative mb-4">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                <input 
                  type="text"
                  placeholder="بحث في محتوى الفصول..."
                  className="w-full p-2 pr-10 bg-bg-secondary border border-border-primary rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-text-primary"
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
                            : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
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
              <div className="flex gap-1 mb-4 bg-bg-secondary p-1 rounded-xl">
                <button 
                  onClick={() => setChapterFilter('all')}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors",
                    chapterFilter === 'all' ? "bg-bg-primary text-emerald-500 shadow-sm" : "text-text-secondary hover:text-text-primary"
                  )}
                >الكل</button>
                <button 
                  onClick={() => setChapterFilter('translated')}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors",
                    chapterFilter === 'translated' ? "bg-bg-primary text-emerald-500 shadow-sm" : "text-text-secondary hover:text-text-primary"
                  )}
                >المترجمة</button>
                <button 
                  onClick={() => setChapterFilter('untranslated')}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors",
                    chapterFilter === 'untranslated' ? "bg-bg-primary text-emerald-500 shadow-sm" : "text-text-secondary hover:text-text-primary"
                  )}
                >غير المترجمة</button>
              </div>

              <select 
                className="w-full p-3 bg-bg-secondary border border-border-primary rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-text-primary"
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
                  <option key={chap.id} value={chap.id} className="bg-bg-primary">
                    {chap.title || `الفصل ${chap.chapter_number}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-3 p-3 bg-bg-secondary rounded-2xl border border-border-primary">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-secondary">إجراءات جماعية</span>
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
                    className="w-full p-2 text-xs bg-bg-primary border border-border-primary rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 text-text-primary"
                    value={deleteRangeStart}
                    onChange={(e) => setDeleteRangeStart(e.target.value)}
                  />
                  <input 
                    type="number" 
                    placeholder="إلى" 
                    className="w-full p-2 text-xs bg-bg-primary border border-border-primary rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 text-text-primary"
                    value={deleteRangeEnd}
                    onChange={(e) => setDeleteRangeEnd(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleApplyDeleteRangeSelection}
                    className="flex-1 py-1.5 text-[10px] font-bold bg-bg-primary border border-border-primary text-text-primary rounded-lg hover:bg-bg-secondary transition-colors"
                  >
                    تحديد النطاق
                  </button>
                  <button 
                    onClick={handleDeleteRange}
                    className="flex-1 py-1.5 text-[10px] font-bold bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
                  >
                    حذف النطاق
                  </button>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedChapterIds(new Set(chapters.map(c => c.id)))}
                    className="flex-1 py-1 text-[10px] font-bold text-emerald-500 hover:underline"
                  >
                    تحديد الكل
                  </button>
                  <button 
                    onClick={() => setSelectedChapterIds(new Set())}
                    className="flex-1 py-1 text-[10px] font-bold text-text-secondary hover:underline"
                  >
                    إلغاء التحديد
                  </button>
                </div>
              </div>

              <div className="hidden lg:block max-h-[500px] overflow-y-auto bg-bg-primary rounded-2xl border border-border-primary shadow-sm">
                <div className="p-3 text-xs font-bold text-text-secondary border-b border-border-primary flex justify-between items-center">
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
                        "w-full text-right p-4 border-b border-border-primary last:border-0 hover:bg-bg-secondary transition-colors text-sm flex items-center gap-3 group",
                        !searchQuery && "cursor-move",
                        selectedChapter?.id === chap.id ? "bg-emerald-500/10 text-emerald-500 font-bold border-r-4 border-r-emerald-600" : "text-text-secondary"
                      )}
                    >
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleChapterSelection(chap.id);
                        }}
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer shrink-0",
                          selectedChapterIds.has(chap.id) ? "bg-emerald-500 border-emerald-500 text-white" : "border-border-primary bg-bg-primary"
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
                      {!searchQuery && <GripVertical size={14} className="text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
                    </div>
                  ))}
                {filteredChapters.length === 0 && (
                  <div className="p-8 text-center text-text-secondary text-sm">
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
              <div className="bg-bg-primary rounded-3xl border border-border-primary shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border-primary flex items-center justify-between bg-bg-secondary/50">
                  <h3 className="text-xl font-bold text-text-primary">{selectedChapter.title}</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => copyToClipboard(`${selectedChapter.title}\n\n${selectedChapter.content_original}`)}
                      className="p-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary hover:text-emerald-600 transition-colors shadow-sm flex items-center gap-2"
                      title="نسخ النص الأصلي"
                    >
                      <Copy size={18} />
                      <span className="text-xs font-bold hidden sm:inline">نسخ الأصلي</span>
                    </button>
                    <button 
                      onClick={() => copyToClipboard(`${selectedChapter.title}\n\n${arabicContent}`)}
                      className="p-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary hover:text-emerald-600 transition-colors shadow-sm flex items-center gap-2"
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
                  <div className="bg-amber-500/10 px-6 py-2 border-b border-amber-500/20 flex items-center gap-2 text-amber-600 text-xs font-bold">
                    <WifiOff size={14} />
                    <span>أنت تعمل بدون إنترنت. سيتم حفظ التغييرات محلياً ومزامنتها لاحقاً.</span>
                  </div>
                )}

                {Object.keys(pendingSync).length > 0 && isOnline && (
                  <div className="bg-emerald-500/10 px-6 py-2 border-b border-emerald-500/20 flex items-center justify-between text-emerald-500 text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <CloudUpload size={14} />
                      <span>لديك {Object.keys(pendingSync).length} تعديلات بانتظار المزامنة.</span>
                    </div>
                    <button onClick={syncPending} disabled={isSyncing} className="underline hover:no-underline">
                      {isSyncing ? 'جاري المزامنة...' : 'مزامنة الآن'}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-border-primary">
                  {/* Original Text */}
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1">
                        <Languages size={14} />
                        النص الأصلي
                      </span>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={handlePasteToOriginal}
                          className="p-1.5 text-text-secondary hover:text-emerald-600 transition-colors"
                          title="لصق النص الأصلي من الحافظة"
                        >
                          <Clipboard size={14} />
                        </button>
                        <button 
                          onClick={() => copyToClipboard(`${selectedChapter.title}\n\n${selectedChapter.content_original}`)}
                          className="p-1.5 text-text-secondary hover:text-emerald-600 transition-colors"
                          title="نسخ النص الأصلي"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="prose prose-stone dark:prose-invert max-w-none h-[600px] overflow-y-auto p-4 bg-bg-secondary rounded-xl text-lg leading-relaxed whitespace-pre-wrap font-mono text-text-primary">
                      {selectedChapter.content_original}
                    </div>
                  </div>

                  {/* Arabic Translation */}
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1">
                        <Languages size={14} />
                        الترجمة العربية
                      </span>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={handlePaste}
                          className="p-1.5 text-text-secondary hover:text-emerald-600 transition-colors"
                          title="لصق الترجمة"
                        >
                          <Clipboard size={14} />
                        </button>
                        <button 
                          onClick={() => copyToClipboard(`${selectedChapter.title}\n\n${arabicContent}`)}
                          className="p-1.5 text-text-secondary hover:text-emerald-600 transition-colors"
                          title="نسخ الترجمة"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                    <textarea
                      className="w-full h-[600px] p-4 bg-bg-primary border border-border-primary rounded-xl text-lg leading-relaxed focus:ring-2 focus:ring-emerald-500 outline-none resize-none text-text-primary"
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
      )}

      {/* Check Missing Chapters Modal */}
      <AnimatePresence>
        {showCheckModal && checkResults && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCheckModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-bg-primary rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border-primary flex items-center justify-between">
                <h3 className="text-xl font-bold text-text-primary">نتائج فحص الفصول</h3>
                <button onClick={() => setShowCheckModal(false)} className="text-text-secondary hover:text-text-primary">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                {checkResults.missing.length === 0 ? (
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
                      <CheckCircle2 size={32} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-text-primary">التسلسل مكتمل!</h4>
                      <p className="text-sm text-text-secondary">لا توجد فصول مفقودة في التسلسل من 1 إلى {checkResults.max}.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-amber-600">
                      <AlertCircle size={24} />
                      <h4 className="text-lg font-bold">تم العثور على نقص</h4>
                    </div>
                    <p className="text-sm text-text-secondary">
                      هناك <span className="font-bold text-text-primary">{checkResults.missing.length}</span> فصل مفقود في التسلسل:
                    </p>
                    <div className="bg-bg-secondary p-4 rounded-xl border border-border-primary max-h-40 overflow-y-auto">
                      <p className="font-mono text-sm text-text-secondary leading-relaxed">
                        {checkResults.missing.join(', ')}
                      </p>
                    </div>
                    <p className="text-xs text-text-secondary opacity-60 italic">
                      * الفحص يعتمد على أرقام الفصول من 1 إلى {checkResults.max}.
                    </p>
                  </div>
                )}

                <button 
                  onClick={() => setShowCheckModal(false)}
                  className="w-full bg-stone-900 dark:bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-stone-800 dark:hover:bg-emerald-700 transition-all"
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
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-bg-primary rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border-primary flex items-center justify-between">
                <h3 className="text-xl font-bold text-text-primary">تحميل الفصول المترجمة</h3>
                <button onClick={() => setShowDownloadModal(false)} className="text-text-secondary hover:text-text-primary">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <p className="text-sm text-text-secondary">اختر نطاق الفصول التي تريد تحميلها في ملف نصي واحد.</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase">من فصل</label>
                    <input 
                      type="number" 
                      className="w-full p-3 bg-bg-secondary border border-border-primary rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-text-primary"
                      value={downloadRangeStart}
                      onChange={(e) => setDownloadRangeStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase">إلى فصل</label>
                    <input 
                      type="number" 
                      className="w-full p-3 bg-bg-secondary border border-border-primary rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-text-primary"
                      value={downloadRangeEnd}
                      onChange={(e) => setDownloadRangeEnd(e.target.value)}
                    />
                  </div>
                </div>

                <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                  <p className="text-xs text-emerald-500 font-medium">
                    سيتم تحميل الفصول المترجمة فقط ضمن هذا النطاق.
                  </p>
                </div>

                <button 
                  onClick={handleDownloadTranslated}
                  className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2"
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
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-bg-primary rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-border-primary flex items-center justify-between bg-bg-primary sticky top-0 z-10">
                <div>
                  <h3 className="text-xl font-bold text-text-primary">معاينة الفصول المستخرجة</h3>
                  <p className="text-sm text-text-secondary">تم العثور على {pendingChapters.length} فصل</p>
                </div>
                <button onClick={() => setShowUploadPreview(false)} className="text-text-secondary hover:text-text-primary">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <div className="p-6 bg-bg-secondary border-b border-border-primary space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-bold text-text-secondary uppercase">تحديد نطاق (من - إلى)</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        placeholder="من"
                        className="w-20 p-2 bg-bg-primary border border-border-primary rounded-lg text-sm text-text-primary"
                        value={rangeStart}
                        onChange={(e) => setRangeStart(e.target.value)}
                      />
                      <input 
                        type="number" 
                        placeholder="إلى"
                        className="w-20 p-2 bg-bg-primary border border-border-primary rounded-lg text-sm text-text-primary"
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(e.target.value)}
                      />
                      <button 
                        onClick={handleApplyRange}
                        className="px-4 py-2 bg-stone-900 dark:bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-stone-800 dark:hover:bg-emerald-700"
                      >
                        تطبيق النطاق
                      </button>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <p className="text-sm font-bold text-text-secondary">المحدد: {selectedPendingIndices.size}</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSelectedPendingIndices(new Set(pendingChapters.map((_, i) => i)))}
                        className="text-xs text-emerald-500 font-bold hover:underline"
                      >
                        تحديد الكل
                      </button>
                      <button 
                        onClick={() => setSelectedPendingIndices(new Set())}
                        className="text-xs text-red-500 font-bold hover:underline"
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
                        ? "bg-emerald-500/10 border-emerald-500/20" 
                        : "bg-bg-primary border-border-primary hover:border-text-secondary",
                      chapter.isDuplicate && "opacity-60"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded border flex items-center justify-center",
                      selectedPendingIndices.has(idx) ? "bg-emerald-500 border-emerald-500 text-white" : "border-border-primary"
                    )}>
                      {selectedPendingIndices.has(idx) && <Check size={12} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-text-secondary opacity-60">#{chapter.chapter_number}</span>
                        <span className="font-bold text-text-primary">{chapter.title}</span>
                        {!chapter.content_original?.trim() && (
                          <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">فارغ</span>
                        )}
                      </div>
                      {chapter.isDuplicate && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">موجود مسبقاً</span>
                      )}
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewPendingChapter(chapter);
                      }}
                      className="p-2 text-text-secondary hover:text-emerald-600 transition-colors"
                      title="معاينة المحتوى"
                    >
                      <Eye size={18} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-border-primary bg-bg-primary">
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

      {/* Pending Chapter Preview Modal */}
      <AnimatePresence>
        {previewPendingChapter && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewPendingChapter(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-bg-primary rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-border-primary flex items-center justify-between bg-bg-primary sticky top-0 z-10">
                <div>
                  <h3 className="text-xl font-bold text-text-primary">معاينة: {previewPendingChapter.title}</h3>
                  <p className="text-sm text-text-secondary">الفصل رقم {previewPendingChapter.chapter_number}</p>
                </div>
                <button onClick={() => setPreviewPendingChapter(null)} className="text-text-secondary hover:text-text-primary">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 prose prose-stone dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap font-mono text-text-primary leading-relaxed">
                  {previewPendingChapter.content_original || <span className="italic opacity-60">لا يوجد محتوى لهذا الفصل</span>}
                </div>
              </div>
              <div className="p-6 border-t border-border-primary bg-bg-primary">
                <button 
                  onClick={() => setPreviewPendingChapter(null)}
                  className="w-full bg-bg-secondary text-text-primary py-3 rounded-xl font-bold hover:bg-border-primary transition-all"
                >
                  إغلاق المعاينة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      {/* Gemini Translate Modal */}
      <AnimatePresence>
        {isGeminiTranslateOpen && novel && (
          <GeminiTranslateModal 
            isOpen={isGeminiTranslateOpen}
            onClose={() => setIsGeminiTranslateOpen(false)}
            novelId={novel.id}
            chapters={chapters}
            onSuccess={() => {
              fetchChapters(novel.id);
            }}
          />
        )}
      </AnimatePresence>

      {/* Embedded Browser Side Panel */}
      <AnimatePresence>
        {showEmbeddedBrowser && novel && (
          <>
            {/* Resizer Overlay */}
            {isResizing && (
              <div className="fixed inset-0 z-[110] cursor-col-resize" />
            )}
            
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{ width: browserWidth }}
              className="fixed top-0 right-0 h-full bg-bg-primary border-l border-border-primary shadow-2xl z-[100] flex flex-col"
            >
              {/* Resize Handle */}
              <div 
                onMouseDown={() => setIsResizing(true)}
                className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-emerald-500 transition-colors z-[101]"
              />

              {/* Browser Header */}
              <div className="p-4 border-b border-border-primary flex items-center justify-between bg-bg-secondary/50">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 bg-blue-500 text-white rounded-lg shrink-0">
                    <Globe size={18} />
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-text-primary truncate text-sm">المتصفح المدمج</h3>
                    <p className="text-[10px] text-text-secondary truncate">{novel.source_url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      const iframe = document.getElementById('novel-iframe') as HTMLIFrameElement;
                      if (iframe) iframe.src = iframe.src;
                    }}
                    className="p-2 hover:bg-bg-primary rounded-lg text-text-secondary transition-colors"
                    title="تحديث الصفحة"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <a 
                    href={novel.source_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-bg-primary rounded-lg text-text-secondary transition-colors"
                    title="فتح في تبويب جديد"
                  >
                    <ExternalLink size={16} />
                  </a>
                  <button 
                    onClick={() => setShowEmbeddedBrowser(false)}
                    className="p-2 hover:bg-bg-primary rounded-lg text-text-secondary transition-colors"
                  >
                    <Plus size={20} className="rotate-45" />
                  </button>
                </div>
              </div>

              {/* Browser Content */}
              <div className="flex-1 bg-white relative">
                <iframe 
                  id="novel-iframe"
                  src={novel.source_url}
                  className="w-full h-full border-none"
                  title="Novel Source"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                />
                
                {/* Overlay for when resizing to prevent iframe from capturing mouse events */}
                {isResizing && <div className="absolute inset-0 z-10" />}
              </div>

              {/* Browser Footer */}
              <div className="p-4 border-t border-border-primary bg-bg-secondary/30 text-[10px] text-text-secondary text-center">
                <p>ملاحظة: بعض المواقع قد تمنع عرضها هنا لأسباب أمنية. إذا لم يظهر المحتوى، استخدم زر "الفتح في تبويب جديد".</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
