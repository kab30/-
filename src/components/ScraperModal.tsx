import React, { useState } from 'react';
import { Link2, Loader2, Check, AlertCircle, BookOpen, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, type Novel } from '../supabase';

interface ScraperModalProps {
  isOpen: boolean;
  onClose: () => void;
  novels: Novel[];
  onSuccess: () => void;
  initialNovelId?: string;
}

export const ScraperModal: React.FC<ScraperModalProps> = ({ isOpen, onClose, novels, onSuccess, initialNovelId }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [scrapedData, setScrapedData] = useState<{ title: string; content: string; originalContent: string } | null>(null);
  const [selectedNovelId, setSelectedNovelId] = useState(initialNovelId || '');
  const [error, setError] = useState('');

  const applyRules = async (content: string, novelId: string) => {
    if (!novelId) return content;
    
    const { data: rules } = await supabase
      .from('cleaning_rules')
      .select('*')
      .eq('novel_id', novelId);
    
    let cleaned = content;
    if (rules && rules.length > 0) {
      rules.forEach(rule => {
        if (rule.is_regex) {
          try {
            const regex = new RegExp(rule.pattern, 'g');
            cleaned = cleaned.replace(regex, rule.replacement);
          } catch (e) {
            console.error('Invalid regex:', rule.pattern);
          }
        } else {
          cleaned = cleaned.split(rule.pattern).join(rule.replacement);
        }
      });
    }
    return cleaned;
  };

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('استجابة غير صالحة من الخادم. يرجى المحاولة مرة أخرى.');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape');
      }

      const cleanedContent = await applyRules(data.content, selectedNovelId);

      setScrapedData({ 
        title: data.title, 
        content: cleanedContent, 
        originalContent: data.content 
      });
      setStep('preview');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNovelChange = async (novelId: string) => {
    setSelectedNovelId(novelId);
    if (scrapedData) {
      setIsLoading(true);
      const cleaned = await applyRules(scrapedData.originalContent, novelId);
      setScrapedData({ ...scrapedData, content: cleaned });
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!scrapedData || !selectedNovelId) return;

    setIsLoading(true);
    try {
      // Get current max order
      const { data: chapters } = await supabase
        .from('chapters')
        .select('order_index')
        .eq('novel_id', selectedNovelId)
        .order('order_index', { ascending: false })
        .limit(1);

      const nextOrder = chapters && chapters.length > 0 ? chapters[0].order_index + 1 : 1;

      const { error: insertError } = await supabase
        .from('chapters')
        .insert([{
          novel_id: selectedNovelId,
          title: scrapedData.title || `فصل جديد (${nextOrder})`,
          content_original: scrapedData.content,
          order_index: nextOrder
        }]);

      if (insertError) throw insertError;

      onSuccess();
      onClose();
      // Reset state
      setStep('input');
      setUrl('');
      setScrapedData(null);
      setSelectedNovelId('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
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
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-2xl bg-bg-secondary rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-border-primary"
      >
        <div className="p-6 border-b border-border-primary flex items-center justify-between bg-bg-secondary sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500/10 text-emerald-500 rounded-lg flex items-center justify-center">
              <Link2 size={20} />
            </div>
            <h3 className="text-xl font-bold text-text-primary">سحب فصل من رابط</h3>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {step === 'input' ? (
            <form onSubmit={handleScrape} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary">رابط الفصل (يدعم حالياً 69shuba ومواقع أخرى)</label>
                <div className="relative">
                  <input 
                    type="url" 
                    required
                    className="w-full p-4 bg-bg-primary border border-border-primary rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none pr-12 text-text-primary"
                    placeholder="https://www.69shuba.cx/txt/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                  <Link2 className="absolute right-4 top-4 text-text-secondary" size={20} />
                </div>
                <p className="text-xs text-text-secondary">الصق رابط الفصل الصيني وسنقوم باستخراج النص لك تلقائياً.</p>
              </div>

              {error && (
                <div className="bg-red-500/10 text-red-500 p-4 rounded-xl flex items-center gap-3 text-sm font-medium border border-red-500/20">
                  <AlertCircle size={20} />
                  <span>{error}</span>
                </div>
              )}

              <button 
                type="submit"
                disabled={isLoading || !url}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <Link2 size={20} />}
                <span>بدء السحب</span>
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
                <div className="flex items-center gap-2 text-emerald-500 font-bold mb-1">
                  <Check size={18} />
                  <span>تم سحب المحتوى بنجاح!</span>
                </div>
                <h4 className="text-text-primary font-bold">{scrapedData?.title}</h4>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary">اختر الرواية لإضافة الفصل إليها</label>
                <select 
                  className="w-full p-4 bg-bg-primary border border-border-primary rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none appearance-none text-text-primary"
                  value={selectedNovelId}
                  onChange={(e) => handleNovelChange(e.target.value)}
                >
                  <option value="" className="bg-bg-secondary">-- اختر الرواية --</option>
                  {novels.map(novel => (
                    <option key={novel.id} value={novel.id} className="bg-bg-secondary">{novel.title}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary">معاينة النص المسحوب</label>
                <div className="bg-bg-primary p-4 rounded-2xl border border-border-primary max-h-60 overflow-y-auto text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                  {scrapedData?.content}
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setStep('input')}
                  className="flex-1 bg-bg-primary text-text-secondary py-4 rounded-2xl font-bold hover:bg-border-primary transition-all"
                >
                  تغيير الرابط
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isLoading || !selectedNovelId}
                  className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : <BookOpen size={20} />}
                  <span>حفظ في الرواية</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </motion.div>
    </div>
  );
};
