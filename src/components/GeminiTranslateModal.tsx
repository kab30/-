import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sparkles, 
  Loader2, 
  Check, 
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
  Save,
  Book
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { supabase, type Chapter } from '../supabase';

interface GeminiTranslateModalProps {
  isOpen: boolean;
  onClose: () => void;
  novelId: string;
  chapters: Chapter[];
  onSuccess: () => void;
}

export const GeminiTranslateModal: React.FC<GeminiTranslateModalProps> = ({ 
  isOpen, 
  onClose, 
  novelId, 
  chapters,
  onSuccess 
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  // Default selection: chapters without translation
  useEffect(() => {
    if (isOpen) {
      const untranslated = chapters
        .filter(c => !c.content_arabic || c.content_arabic.trim().length === 0)
        .map(c => c.id);
      setSelectedIds(new Set(untranslated));
    }
  }, [isOpen, chapters]);

  const handleApplyRange = () => {
    const start = parseInt(rangeStart);
    const end = parseInt(rangeEnd);
    if (isNaN(start) || isNaN(end)) return;

    const newSelection = new Set<string>();
    chapters.forEach(c => {
      if (c.chapter_number >= start && c.chapter_number <= end) {
        newSelection.add(c.id);
      }
    });
    setSelectedIds(newSelection);
  };

  const toggleSelect = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedIds(newSelection);
  };

  const translateChapter = async (chapter: Chapter, ai: GoogleGenAI) => {
    const prompt = `Translate the following novel chapter from its original language to high-quality literary Arabic. 
Maintain the tone, style, and consistency of character names. 
Only output the translated text, no introductions or conclusions.

Chapter Title: ${chapter.title}
Content:
${chapter.content_original}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    return response.text;
  };

  const handleTranslate = async () => {
    if (selectedIds.size === 0) return;
    
    setIsTranslating(true);
    setIsPaused(false);
    setError('');
    setProgress({ current: 0, total: selectedIds.size });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const selectedChapters = chapters.filter(c => selectedIds.has(c.id));
    
    let currentCount = 0;
    
    for (const chapter of selectedChapters) {
      // Check for pause
      while (isPaused) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      try {
        const translatedText = await translateChapter(chapter, ai);
        
        if (translatedText) {
          const { error: updateError } = await supabase
            .from('chapters')
            .update({ content_arabic: translatedText })
            .eq('id', chapter.id);

          if (updateError) throw updateError;
        }

        currentCount++;
        setProgress(prev => ({ ...prev, current: currentCount }));
      } catch (err: any) {
        console.error(`Error translating chapter ${chapter.chapter_number}:`, err);
        setError(`خطأ في ترجمة الفصل ${chapter.chapter_number}: ${err.message}`);
        // Optionally stop on error or continue
        // For now, let's continue but show the error
      }
    }

    setIsTranslating(false);
    if (!error) {
      // alert('تمت الترجمة بنجاح!');
      onSuccess();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-3xl bg-bg-secondary rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-border-primary"
      >
        {/* Header */}
        <div className="p-6 border-b border-border-primary flex items-center justify-between bg-bg-secondary sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center shadow-inner">
              <Sparkles size={28} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-text-primary">ترجمة بواسطة Gemini</h3>
              <p className="text-xs text-text-secondary font-medium">ترجمة آلية ذكية للفصول المختارة</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-bg-primary rounded-full transition-colors text-text-secondary">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Selection Controls */}
          <div className="bg-bg-primary p-4 rounded-2xl border border-border-primary space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h4 className="font-bold text-text-primary flex items-center gap-2">
                <Book size={18} className="text-emerald-500" />
                تحديد الفصول ({selectedIds.size} مختار)
              </h4>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSelectedIds(new Set(chapters.map(c => c.id)))}
                  className="text-xs font-bold text-emerald-500 hover:underline"
                >تحديد الكل</button>
                <span className="text-border-primary">|</span>
                <button 
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs font-bold text-text-secondary hover:underline"
                >إلغاء التحديد</button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text-secondary">تحديد المدى من:</span>
              <input 
                type="number" 
                className="w-20 p-2 bg-bg-secondary border border-border-primary rounded-lg text-center text-sm font-bold text-text-primary"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                placeholder="1"
              />
              <span className="text-xs font-bold text-text-secondary">إلى:</span>
              <input 
                type="number" 
                className="w-20 p-2 bg-bg-secondary border border-border-primary rounded-lg text-center text-sm font-bold text-text-primary"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                placeholder="10"
              />
              <button 
                onClick={handleApplyRange}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
              >تطبيق</button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 text-red-500 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold border border-red-500/20">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {/* Progress Bar */}
          {isTranslating && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-bold">
                <span className="text-text-primary">جاري الترجمة...</span>
                <span className="text-emerald-500">{progress.current} / {progress.total}</span>
              </div>
              <div className="w-full h-3 bg-bg-primary rounded-full overflow-hidden border border-border-primary">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                  className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                />
              </div>
            </div>
          )}

          {/* Chapter List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {chapters.map((chapter) => (
              <div 
                key={chapter.id}
                onClick={() => !isTranslating && toggleSelect(chapter.id)}
                className={`p-4 rounded-2xl border transition-all flex items-center gap-3 cursor-pointer ${
                  selectedIds.has(chapter.id) 
                    ? 'bg-emerald-500/10 border-emerald-500/30' 
                    : 'bg-bg-secondary border-border-primary hover:border-emerald-500/30'
                } ${isTranslating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                  selectedIds.has(chapter.id) 
                    ? 'bg-emerald-500 border-emerald-500 text-white' 
                    : 'border-border-primary bg-bg-primary'
                }`}>
                  {selectedIds.has(chapter.id) && <Check size={14} />}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">فصل {chapter.chapter_number}</div>
                  <div className="font-bold text-text-primary truncate text-sm">{chapter.title}</div>
                  {chapter.content_arabic && (
                    <span className="text-[10px] text-emerald-500 font-bold">✓ مترجم مسبقاً</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border-primary bg-bg-secondary flex gap-3">
          {isTranslating ? (
            <>
              <button 
                onClick={() => setIsPaused(!isPaused)}
                className="flex-1 bg-amber-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-amber-600 transition-all"
              >
                {isPaused ? <Play size={20} /> : <Pause size={20} />}
                <span>{isPaused ? 'استئناف' : 'إيقاف مؤقت'}</span>
              </button>
              <button 
                onClick={() => {
                  if (confirm('هل أنت متأكد من إيقاف عملية الترجمة؟')) {
                    setIsTranslating(false);
                  }
                }}
                className="px-6 bg-red-500/10 text-red-500 py-4 rounded-2xl font-bold hover:bg-red-500/20 transition-all"
              >إلغاء</button>
            </>
          ) : (
            <button 
              onClick={handleTranslate}
              disabled={selectedIds.size === 0}
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Sparkles size={24} />
              <span>بدء الترجمة الآلية ({selectedIds.size})</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
