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
  content: string;
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

  const handleApplyRange = () => {
    const from = parseInt(rangeFrom);
    const to = parseInt(rangeTo);
    if (isNaN(from) || isNaN(to)) return;

    const newSelection = new Set<number>();
    chapters.forEach((chapter, index) => {
      if (chapter.number >= from && chapter.number <= to) {
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
    const detectedChapters: GeminiChapter[] = [];
    let counter = 1;

    parts.forEach(part => {
      const trimmed = part.trim();
      
      // Word count check: Chinese characters don't use spaces
      const isChinese = /[\u4e00-\u9fa5]/.test(trimmed);
      const wordCount = isChinese ? trimmed.length : trimmed.split(/\s+/).length;
      
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

      detectedChapters.push({
        number: num,
        title: title,
        content: trimmed
      });
    });

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

  const handleSave = async () => {
    if (!selectedNovelId || selectedIndices.size === 0) return;
    setIsSaving(true);
    setError('');

    try {
      const chaptersToSave = chapters
        .filter((_, i) => selectedIndices.has(i))
        .map(c => ({
          novel_id: selectedNovelId,
          chapter_number: c.number,
          title: c.title,
          content_original: '', // We don't have the original from Gemini share usually
          content_arabic: c.content,
          created_at: new Date().toISOString()
        }));

      // Batch insert/upsert
      const { error: saveError } = await supabase
        .from('chapters')
        .upsert(chaptersToSave, { onConflict: 'novel_id,chapter_number' });

      if (saveError) throw saveError;

      alert(`تم حفظ ${chaptersToSave.length} فصل بنجاح!`);
      onClose();
    } catch (err: any) {
      setError('خطأ أثناء حفظ الفصول: ' + err.message);
    } finally {
      setIsSaving(false);
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
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tabs */}
          <div className="flex p-1 bg-stone-100 rounded-2xl">
            <button 
              onClick={() => setImportMode('url')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${importMode === 'url' ? 'bg-white shadow-sm text-blue-600' : 'text-stone-500 hover:text-stone-700'}`}
            >
              عبر الرابط
            </button>
            <button 
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
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                <h4 className="font-bold text-stone-800 flex items-center gap-2 shrink-0">
                  <Book size={18} className="text-emerald-500" />
                  الفصول المكتشفة ({chapters.length})
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
                    onClick={handleApplyRange}
                    className="bg-stone-800 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-black transition-colors"
                  >
                    تطبيق
                  </button>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button 
                    onClick={() => setSelectedIndices(new Set(chapters.map((_, i) => i)))}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    تحديد الكل
                  </button>
                  <span className="text-stone-300">|</span>
                  <button 
                    onClick={() => setSelectedIndices(new Set())}
                    className="text-xs font-bold text-stone-400 hover:underline"
                  >
                    إلغاء التحديد
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {chapters.map((chapter, index) => (
                  <div 
                    key={index}
                    className={`group p-4 rounded-2xl border transition-all flex items-center justify-between ${
                      selectedIndices.has(index) 
                        ? 'bg-emerald-50 border-emerald-200 shadow-sm' 
                        : 'bg-white border-stone-100 hover:border-stone-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button 
                        onClick={() => toggleSelect(index)}
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          selectedIndices.has(index) 
                            ? 'bg-emerald-500 border-emerald-500 text-white' 
                            : 'border-stone-200 bg-white'
                        }`}
                      >
                        {selectedIndices.has(index) && <Check size={14} />}
                      </button>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-stone-400 uppercase tracking-wider">فصل {chapter.number}</div>
                        <div className="font-bold text-stone-800 truncate">{chapter.title}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setPreviewChapter(chapter)}
                      className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      title="معاينة الفصل"
                    >
                      <Eye size={20} />
                    </button>
                  </div>
                ))}
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
                  onClick={handleSave}
                  disabled={isSaving || !selectedNovelId || selectedIndices.size === 0}
                  className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
                  <span>حفظ الفصول المختارة ({selectedIndices.size})</span>
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
                <button onClick={() => setPreviewChapter(null)} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 overflow-y-auto text-stone-700 leading-relaxed whitespace-pre-wrap font-medium">
                {previewChapter.content}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
