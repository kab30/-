import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Link2, 
  Loader2, 
  Sparkles, 
  Check, 
  Eye, 
  Save, 
  AlertCircle,
  ChevronRight,
  Book
} from 'lucide-react';
import { supabase, type Novel } from '../supabase';

interface GeminiImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  novels: Novel[];
}

interface GeminiChapter {
  number: number;
  title: string;
  content_original: string;
  content_arabic: string;
}

export const GeminiImportModal: React.FC<GeminiImportModalProps> = ({ isOpen, onClose, novels }) => {
  const [url, setUrl] = useState('');
  const [manualText, setManualText] = useState('');
  const [importMode, setImportMode] = useState<'url' | 'manual'>('url');
  const [isLoading, setIsLoading] = useState(false);
  const [chapters, setChapters] = useState<GeminiChapter[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [previewChapter, setPreviewChapter] = useState<GeminiChapter | null>(null);
  const [selectedNovelId, setSelectedNovelId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'arabic' | 'original'>('all');

  const filteredChapters = chapters.filter(chapter => {
    if (filterType === 'arabic') return !!chapter.content_arabic;
    if (filterType === 'original') return !!chapter.content_original;
    return true;
  });

  const handleApplyRange = () => {
    const from = parseInt(rangeFrom);
    const to = parseInt(rangeTo);
    if (isNaN(from) || isNaN(to)) return;

    const newSelection = new Set<number>(selectedIndices);
    chapters.forEach((chapter, index) => {
      // Only apply to filtered chapters if we want to be precise, 
      // but usually range applies to the whole set.
      // Let's make it apply to the visible ones for better UX.
      const isVisible = filteredChapters.some(fc => fc.number === chapter.number);
      if (isVisible && chapter.number >= from && chapter.number <= to) {
        newSelection.add(index);
      }
    });
    setSelectedIndices(newSelection);
  };

  const handleFetch = async () => {
    if (!url) return;
    setIsLoading(true);
    setError('');
    setChapters([]);
    setSelectedIndices(new Set());

    try {
      const response = await fetch('/api/gemini-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'فشل جلب البيانات');

      if (data.chapters && data.chapters.length > 0) {
        setChapters(data.chapters);
        setSelectedIndices(new Set(data.chapters.map((_: any, i: number) => i)));
      } else {
        setError('لم يتم العثور على فصول مترجمة في هذا الرابط. جرب طريقة اللصق اليدوي.');
      }
    } catch (err: any) {
      setError(err.message + '. جرب طريقة اللصق اليدوي.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualParse = () => {
    if (!manualText) return;
    setError('');
    
    // Split by common chapter indicators
    const parts = manualText.split(/(?=Chapter|الفصل|第\s*\d+\s*章|فصل\s*\d+)/i);
    const chaptersMap: Map<number, GeminiChapter> = new Map();
    let counter = 1;

    parts.forEach(part => {
      const trimmed = part.trim();
      
      // Word count check: Chinese characters don't use spaces
      const hasArabic = /[\u0600-\u06FF]/.test(trimmed);
      const isCJK = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/.test(trimmed);
      const wordCount = isCJK ? trimmed.length : trimmed.split(/\s+/).length;
      
      if (wordCount < 400) return; // Skip if less than 400 words/chars

      const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) return;
      
      const firstLine = lines[0];
      const chapterMatch = trimmed.match(/^(?:Chapter|الفصل|فصل|第)\s*([0-9\u4e00-\u9fa5]+)(?:\s*章)?/i) ||
                           firstLine.match(/(?:Chapter|الفصل|فصل|第)\s*([0-9\u4e00-\u9fa5]+)(?:\s*章)?/i);
      
      // Check if it really looks like a chapter header
      const isChapterHeader = chapterMatch || 
                             /^(?:Chapter|الفصل|فصل|第)/i.test(firstLine);

      if (!isChapterHeader) return;

      let numStr = chapterMatch ? chapterMatch[1] : String(counter++);
      const num = /^\d+$/.test(numStr) ? parseInt(numStr) : counter++;
      const title = firstLine.length < 150 ? firstLine : `فصل ${num}`;

      if (!chaptersMap.has(num)) {
        chaptersMap.set(num, {
          number: num,
          title: title,
          content_original: !hasArabic ? trimmed : '',
          content_arabic: hasArabic ? trimmed : ''
        });
      } else {
        const existing = chaptersMap.get(num)!;
        if (!hasArabic) {
          existing.content_original = trimmed;
          if (existing.title.startsWith('فصل ') && !title.startsWith('فصل ')) existing.title = title;
        } else {
          existing.content_arabic = trimmed;
          if (existing.title.startsWith('فصل ') && !title.startsWith('فصل ')) existing.title = title;
        }
      }
    });

    const detectedChapters = Array.from(chaptersMap.values()).sort((a, b) => a.number - b.number);

    if (detectedChapters.length > 0) {
      setChapters(detectedChapters);
      setSelectedIndices(new Set(detectedChapters.map((_, i) => i)));
    } else {
      setError('لم نتمكن من العثور على فصول مطابقة (يجب أن يبدأ بـ "فصل" أو "Chapter" ويكون طوله 400 كلمة على الأقل).');
    }
  };

  const toggleSelect = (index: number) => {
    const newSelection = new Set(selectedIndices);
    if (newSelection.has(index)) newSelection.delete(index);
    else newSelection.add(index);
    setSelectedIndices(newSelection);
  };

  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });

  const handleSave = async (e: React.MouseEvent) => {
    console.log('Save button clicked!');
    e.preventDefault();
    if (!selectedNovelId || selectedIndices.size === 0) {
      setError('يرجى اختيار رواية وتحديد فصل واحد على الأقل.');
      return;
    }
    
    setIsSaving(true);
    setError('');
    setSaveProgress({ current: 0, total: selectedIndices.size });

    try {
      const chaptersToSave = chapters
        .filter((_, i) => selectedIndices.has(i))
        .map(c => ({
          novel_id: selectedNovelId,
          chapter_number: c.number,
          title: c.title,
          content_original: c.content_original, 
          content_arabic: c.content_arabic,
          created_at: new Date().toISOString()
        }));

      if (chaptersToSave.length === 0) {
        setError('لا توجد فصول مختارة صالحة للحفظ.');
        setIsSaving(false);
        return;
      }

      // Smaller chunk size for better reliability
      const chunkSize = 10;
      let savedCount = 0;
      
      for (let i = 0; i < chaptersToSave.length; i += chunkSize) {
        const chunk = chaptersToSave.slice(i, i + chunkSize);
        
        const { error: saveError } = await supabase
          .from('chapters')
          .upsert(chunk, { 
            onConflict: 'novel_id,chapter_number'
          });

        if (saveError) {
          throw new Error(saveError.message);
        }
        
        savedCount += chunk.length;
        setSaveProgress(prev => ({ ...prev, current: savedCount }));
      }

      alert(`تم حفظ ${savedCount} فصل بنجاح!`);
      onClose();
    } catch (err: any) {
      console.error('Save error:', err);
      setError('خطأ أثناء حفظ الفصول: ' + (err.message || 'حدث خطأ غير متوقع'));
    } finally {
      setIsSaving(false);
      setSaveProgress({ current: 0, total: 0 });
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
        className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
              <Sparkles size={28} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-stone-900">جلب من Gemini</h3>
              <p className="text-xs text-stone-400 font-medium">استخراج الفصول المترجمة من روابط المشاركة</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tabs */}
          <div className="flex p-1 bg-stone-100 rounded-2xl">
            <button 
              type="button"
              onClick={() => setImportMode('url')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${importMode === 'url' ? 'bg-white shadow-sm text-blue-600' : 'text-stone-500 hover:text-stone-700'}`}
            >
              عبر الرابط
            </button>
            <button 
              type="button"
              onClick={() => setImportMode('manual')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${importMode === 'manual' ? 'bg-white shadow-sm text-blue-600' : 'text-stone-500 hover:text-stone-700'}`}
            >
              لصق يدوي
            </button>
          </div>

          {/* URL Input */}
          {importMode === 'url' ? (
            <div className="space-y-3 animate-in fade-in duration-300">
              <label className="text-sm font-bold text-stone-600 flex items-center gap-2">
                <Link2 size={16} className="text-blue-500" />
                رابط مشاركة Gemini
              </label>
              <div className="flex gap-3">
                <input 
                  type="url"
                  className="flex-1 p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                  placeholder="https://gemini.google.com/share/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <button 
                  type="button"
                  onClick={handleFetch}
                  disabled={isLoading || !url}
                  className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : <ChevronRight size={20} />}
                  <span>جلب</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 animate-in fade-in duration-300">
              <label className="text-sm font-bold text-stone-600 flex items-center gap-2">
                <Save size={16} className="text-blue-500" />
                الصق محتوى صفحة Gemini هنا
              </label>
              <textarea 
                className="w-full h-40 p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium resize-none"
                placeholder="انسخ محتوى المحادثة بالكامل من Gemini والصقه هنا..."
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
              />
              <button 
                type="button"
                onClick={handleManualParse}
                disabled={!manualText}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
              >
                تحليل النص المستخرج
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold border border-red-100">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {/* Results Area */}
          {chapters.length > 0 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Filters & Actions */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-xl">
                    <button 
                      type="button"
                      onClick={() => setFilterType('all')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'all' ? 'bg-white shadow-sm text-blue-600' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                      الكل
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFilterType('arabic')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'arabic' ? 'bg-white shadow-sm text-blue-600' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                      العربية فقط
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFilterType('original')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'original' ? 'bg-white shadow-sm text-blue-600' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                      الأصلية (الصينية)
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => {
                        const newSelection = new Set(selectedIndices);
                        filteredChapters.forEach(fc => {
                          const idx = chapters.findIndex(c => c.number === fc.number);
                          if (idx !== -1) newSelection.add(idx);
                        });
                        setSelectedIndices(newSelection);
                      }}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      تحديد المفلتر
                    </button>
                    <span className="text-stone-300">|</span>
                    <button 
                      type="button"
                      onClick={() => {
                        const newSelection = new Set(selectedIndices);
                        filteredChapters.forEach(fc => {
                          const idx = chapters.findIndex(c => c.number === fc.number);
                          if (idx !== -1) newSelection.delete(idx);
                        });
                        setSelectedIndices(newSelection);
                      }}
                      className="text-xs font-bold text-stone-400 hover:underline"
                    >
                      إلغاء المفلتر
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                  <h4 className="font-bold text-stone-800 flex items-center gap-2 shrink-0">
                    <Book size={18} className="text-emerald-500" />
                    الفصول ({filteredChapters.length} من {chapters.length})
                  </h4>
                  
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs font-bold text-stone-500 shrink-0">تحديد من:</span>
                    <input 
                      type="number" 
                      className="w-16 p-2 bg-white border border-stone-200 rounded-lg text-center text-sm font-bold"
                      value={rangeFrom}
                      onChange={(e) => setRangeFrom(e.target.value)}
                      placeholder="1"
                    />
                    <span className="text-xs font-bold text-stone-500 shrink-0">إلى:</span>
                    <input 
                      type="number" 
                      className="w-16 p-2 bg-white border border-stone-200 rounded-lg text-center text-sm font-bold"
                      value={rangeTo}
                      onChange={(e) => setRangeTo(e.target.value)}
                      placeholder="10"
                    />
                    <button 
                      type="button"
                      onClick={handleApplyRange}
                      className="bg-stone-800 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-black transition-colors"
                    >
                      تطبيق
                    </button>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button 
                      type="button"
                      onClick={() => setSelectedIndices(new Set(chapters.map((_, i) => i)))}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      تحديد الكل
                    </button>
                    <span className="text-stone-300">|</span>
                    <button 
                      type="button"
                      onClick={() => setSelectedIndices(new Set())}
                      className="text-xs font-bold text-stone-400 hover:underline"
                    >
                      إلغاء التحديد
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredChapters.map((chapter) => {
                  const originalIndex = chapters.findIndex(c => c.number === chapter.number);
                  return (
                    <div 
                      key={chapter.number}
                      className={`group p-4 rounded-2xl border transition-all flex items-center justify-between ${
                        selectedIndices.has(originalIndex) 
                          ? 'bg-emerald-50 border-emerald-200 shadow-sm' 
                          : 'bg-white border-stone-100 hover:border-stone-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button 
                          type="button"
                          onClick={() => toggleSelect(originalIndex)}
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            selectedIndices.has(originalIndex) 
                              ? 'bg-emerald-500 border-emerald-500 text-white' 
                              : 'border-stone-200 bg-white'
                          }`}
                        >
                          {selectedIndices.has(originalIndex) && <Check size={14} />}
                        </button>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2">
                            فصل {chapter.number}
                            <div className="flex gap-1">
                              {chapter.content_original && (
                                <span className="px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded text-[10px]">أصلي</span>
                              )}
                              {chapter.content_arabic && (
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-500 rounded text-[10px]">مترجم</span>
                              )}
                            </div>
                          </div>
                          <div className="font-bold text-stone-800 truncate">{chapter.title}</div>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setPreviewChapter(chapter)}
                        className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="معاينة الفصل"
                      >
                        <Eye size={20} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Novel Selection & Save */}
              <div className="pt-6 border-t border-stone-100 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-600">اختر الرواية للتخزين فيها</label>
                  <select 
                    className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-stone-700"
                    value={selectedNovelId}
                    onChange={(e) => setSelectedNovelId(e.target.value)}
                  >
                    <option value="">-- اختر رواية --</option>
                    {novels.map(novel => (
                      <option key={novel.id} value={novel.id}>{novel.title}</option>
                    ))}
                  </select>
                </div>

                <button 
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !selectedNovelId || selectedIndices.size === 0}
                  className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="animate-spin" size={24} />
                      <span>جاري الحفظ ({saveProgress.current} / {saveProgress.total})...</span>
                    </>
                  ) : (
                    <>
                      <Save size={24} />
                      <span>حفظ الفصول المختارة ({selectedIndices.size})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewChapter && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewChapter(null)}
              className="absolute inset-0 bg-stone-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-white sticky top-0">
                <h4 className="text-lg font-bold text-stone-900">{previewChapter.title}</h4>
                <button type="button" onClick={() => setPreviewChapter(null)} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 overflow-y-auto text-stone-700 leading-relaxed whitespace-pre-wrap font-medium space-y-6">
                {previewChapter.content_original && (
                  <div>
                    <div className="text-xs font-bold text-stone-400 uppercase mb-2 border-b border-stone-100 pb-1">النص الأصلي</div>
                    <div className="bg-stone-50 p-4 rounded-xl text-sm">{previewChapter.content_original}</div>
                  </div>
                )}
                {previewChapter.content_arabic && (
                  <div>
                    <div className="text-xs font-bold text-blue-400 uppercase mb-2 border-b border-blue-50 pb-1">الترجمة العربية</div>
                    <div className="bg-blue-50/30 p-4 rounded-xl">{previewChapter.content_arabic}</div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
