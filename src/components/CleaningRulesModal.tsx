import React, { useState, useEffect } from 'react';
import { Trash2, Plus, X, AlertCircle, Settings2, Sparkles, Loader2, CheckCircle2, AlertTriangle, History, RotateCcw, ListFilter, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, type CleaningRule, type CleaningLog, type CleaningLogDetail } from '../supabase';

interface CleaningRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  novelId: string;
}

export const CleaningRulesModal: React.FC<CleaningRulesModalProps> = ({ isOpen, onClose, novelId }) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'history'>('rules');
  const [rules, setRules] = useState<CleaningRule[]>([]);
  const [logs, setLogs] = useState<CleaningLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [newRule, setNewRule] = useState({ pattern: '', replacement: '', is_regex: false });
  const [applyProgress, setApplyProgress] = useState({ current: 0, total: 0 });
  const [cleanTarget, setCleanTarget] = useState<'original' | 'arabic' | 'both'>('original');
  const [detectionStats, setDetectionStats] = useState<Record<string, number>>({});
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    if (isOpen && novelId) {
      fetchRules();
      fetchLogs();
    }
  }, [isOpen, novelId]);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('cleaning_rules')
        .select('*')
        .eq('novel_id', novelId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setRules(data || []);
    } catch (err: any) {
      setError('فشل في تحميل القواعد');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('cleaning_logs')
        .select('*')
        .eq('novel_id', novelId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      console.error('Error fetching logs:', err);
    }
  };

  const handleAddRule = async () => {
    if (!newRule.pattern) return;
    setIsLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('cleaning_rules')
        .insert([{ novel_id: novelId, ...newRule }])
        .select();
      if (error) throw error;
      setRules([...rules, ...data]);
      setNewRule({ pattern: '', replacement: '', is_regex: false });
    } catch (err: any) {
      setError('فشل في إضافة القاعدة');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      const { error } = await supabase.from('cleaning_rules').delete().eq('id', id);
      if (error) throw error;
      setRules(rules.filter(r => r.id !== id));
    } catch (err: any) {
      setError('فشل في حذف القاعدة');
    }
  };

  const handlePreview = async () => {
    if (rules.length === 0) return;
    setIsLoading(true);
    setError('');
    try {
      const { data: chapters, error: fetchError } = await supabase
        .from('chapters')
        .select('content_original, content_arabic')
        .eq('novel_id', novelId);

      if (fetchError) throw fetchError;
      if (!chapters || chapters.length === 0) {
        setError('لا توجد فصول لتحليلها');
        return;
      }

      const stats: Record<string, number> = {};
      rules.forEach(rule => stats[rule.pattern] = 0);

      chapters.forEach(chapter => {
        rules.forEach(rule => {
          const contentToSearch = [];
          if (cleanTarget === 'original' || cleanTarget === 'both') contentToSearch.push(chapter.content_original);
          if ((cleanTarget === 'arabic' || cleanTarget === 'both') && chapter.content_arabic) contentToSearch.push(chapter.content_arabic);

          contentToSearch.forEach(content => {
            if (rule.is_regex) {
              try {
                const regex = new RegExp(rule.pattern, 'g');
                const matches = content.match(regex);
                if (matches) stats[rule.pattern] += matches.length;
              } catch (e) {}
            } else {
              const count = content.split(rule.pattern).length - 1;
              stats[rule.pattern] += count;
            }
          });
        });
      });

      setDetectionStats(stats);
      setIsPreviewing(true);
    } catch (err: any) {
      setError('فشل في تحليل الفصول');
    } finally {
      setIsLoading(false);
    }
  };

  const startCleaning = async () => {
    setIsPreviewing(false);
    setIsApplying(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const { data: chapters, error: fetchError } = await supabase
        .from('chapters')
        .select('id, content_original, content_arabic')
        .eq('novel_id', novelId);

      if (fetchError) throw fetchError;
      if (!chapters || chapters.length === 0) return;

      // 1. Create Log Entry
      const { data: logData, error: logError } = await supabase
        .from('cleaning_logs')
        .insert([{
          novel_id: novelId,
          operation_type: 'bulk_clean',
          target: cleanTarget,
          rules_applied: rules,
          stats: detectionStats
        }])
        .select()
        .single();

      if (logError) throw logError;

      setApplyProgress({ current: 0, total: chapters.length });

      const batchSize = 10;
      for (let i = 0; i < chapters.length; i += batchSize) {
        const batch = chapters.slice(i, i + batchSize);
        
        // 2. Save Old Content for Undo
        const logDetails = batch.map(chapter => ({
          log_id: logData.id,
          chapter_id: chapter.id,
          old_content_original: chapter.content_original,
          old_content_arabic: chapter.content_arabic
        }));

        const { error: detailError } = await supabase.from('cleaning_log_details').insert(logDetails);
        if (detailError) throw detailError;

        // 3. Apply Cleaning and Update
        const updates = batch.map(chapter => {
          let cleanedOriginal = chapter.content_original;
          let cleanedArabic = chapter.content_arabic;

          rules.forEach(rule => {
            if (rule.is_regex) {
              try {
                const regex = new RegExp(rule.pattern, 'g');
                if (cleanTarget === 'original' || cleanTarget === 'both') cleanedOriginal = cleanedOriginal.replace(regex, rule.replacement);
                if ((cleanTarget === 'arabic' || cleanTarget === 'both') && cleanedArabic) cleanedArabic = cleanedArabic.replace(regex, rule.replacement);
              } catch (e) {}
            } else {
              if (cleanTarget === 'original' || cleanTarget === 'both') cleanedOriginal = cleanedOriginal.split(rule.pattern).join(rule.replacement);
              if ((cleanTarget === 'arabic' || cleanTarget === 'both') && cleanedArabic) cleanedArabic = cleanedArabic.split(rule.pattern).join(rule.replacement);
            }
          });

          return supabase
            .from('chapters')
            .update({ content_original: cleanedOriginal, content_arabic: cleanedArabic })
            .eq('id', chapter.id);
        });

        await Promise.all(updates);
        setApplyProgress(prev => ({ ...prev, current: Math.min(i + batchSize, chapters.length) }));
      }
      
      setSuccessMessage('تم التنظيف الشامل بنجاح! تم حفظ نسخة احتياطية في السجل.');
      fetchLogs();
    } catch (err: any) {
      setError('حدث خطأ أثناء عملية التنظيف الشامل');
    } finally {
      setIsApplying(false);
    }
  };

  const handleUndo = async (logId: string) => {
    if (!confirm('هل أنت متأكد من التراجع عن هذه العملية؟ سيتم استعادة النصوص السابقة.')) return;

    setIsApplying(true);
    setError('');
    try {
      const { data: details, error: fetchError } = await supabase
        .from('cleaning_log_details')
        .select('*')
        .eq('log_id', logId);

      if (fetchError) throw fetchError;
      if (!details || details.length === 0) throw new Error('لا توجد بيانات للتراجع');

      setApplyProgress({ current: 0, total: details.length });

      const batchSize = 10;
      for (let i = 0; i < details.length; i += batchSize) {
        const batch = details.slice(i, i + batchSize);
        const updates = batch.map(detail => 
          supabase
            .from('chapters')
            .update({ 
              content_original: detail.old_content_original, 
              content_arabic: detail.old_content_arabic 
            })
            .eq('id', detail.chapter_id)
        );

        await Promise.all(updates);
        setApplyProgress(prev => ({ ...prev, current: Math.min(i + batchSize, details.length) }));
      }

      // Delete log and details after undo
      await supabase.from('cleaning_logs').delete().eq('id', logId);
      setSuccessMessage('تم التراجع عن العملية واستعادة البيانات بنجاح!');
      fetchLogs();
    } catch (err: any) {
      setError('فشل التراجع عن العملية');
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
              <Settings2 size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold">إدارة تنظيف الفصول</h3>
              <p className="text-xs text-stone-400">يدعم الصينية والإنجليزية والعربية</p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={24} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-100 px-6 bg-stone-50/50">
          <button 
            onClick={() => setActiveTab('rules')}
            className={`px-6 py-4 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === 'rules' ? 'border-amber-600 text-amber-600' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
          >
            <ListFilter size={18} />
            <span>القواعد والتنظيف</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-6 py-4 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === 'history' ? 'border-amber-600 text-amber-600' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
          >
            <History size={18} />
            <span>سجل العمليات</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Messages */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 text-sm font-bold">
                <AlertCircle size={20} />
                <span>{error}</span>
              </motion.div>
            )}
            {successMessage && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-emerald-50 text-emerald-600 p-4 rounded-xl flex items-center gap-3 text-sm font-bold">
                <CheckCircle2 size={20} />
                <span>{successMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {activeTab === 'rules' ? (
            <>
              {/* Add Rule Form */}
              <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500">النص المراد حذفه (صيني/إنجليزي/عربي)</label>
                    <input type="text" className="w-full p-3 bg-white border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500" placeholder="مثال: www.69shuba.com" value={newRule.pattern} onChange={e => setNewRule({ ...newRule, pattern: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500">الاستبدال بـ (اختياري)</label>
                    <input type="text" className="w-full p-3 bg-white border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500" placeholder="نص البديل..." value={newRule.replacement} onChange={e => setNewRule({ ...newRule, replacement: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-stone-600">
                    <input type="checkbox" className="w-4 h-4 text-amber-600 rounded" checked={newRule.is_regex} onChange={e => setNewRule({ ...newRule, is_regex: e.target.checked })} />
                    استخدام Regex
                  </label>
                  <motion.button 
                    onClick={handleAddRule} 
                    disabled={!newRule.pattern || isLoading} 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="bg-amber-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-amber-700 flex items-center gap-2 disabled:opacity-50 transition-all shadow-sm active:shadow-inner"
                  >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                    إضافة قاعدة
                  </motion.button>
                </div>
              </div>

              {/* Rules List */}
              <div className="space-y-3">
                <h4 className="font-bold text-stone-800">القواعد الحالية ({rules.length})</h4>
                <div className="space-y-2">
                  {rules.length === 0 ? (
                    <div className="text-center py-8 text-stone-400 border-2 border-dashed border-stone-100 rounded-2xl text-sm">لا توجد قواعد مضافة حالياً</div>
                  ) : (
                    rules.map(rule => (
                      <div key={rule.id} className="flex items-center justify-between p-3 bg-white border border-stone-100 rounded-xl hover:border-amber-200 transition-all">
                        <div className="truncate flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-stone-800">{rule.pattern}</span>
                            {rule.is_regex && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">Regex</span>}
                          </div>
                          <span className="text-xs text-stone-400 block mt-1">بديل: <span className="text-stone-600 italic">{rule.replacement || '(حذف)'}</span></span>
                        </div>
                        <button onClick={() => handleDeleteRule(rule.id)} className="text-stone-300 hover:text-red-500 p-2 transition-colors"><Trash2 size={18} /></button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Comprehensive Cleaning Section */}
              {rules.length > 0 && (
                <div className="pt-6 border-t border-stone-100 space-y-4">
                  <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 space-y-4">
                    <div className="flex items-center gap-3 text-emerald-800 font-bold">
                      <Sparkles size={20} />
                      <span>التنظيف الشامل للمخزن</span>
                    </div>
                    
                    {!isPreviewing && !isApplying && (
                      <>
                        <div className="flex gap-2">
                          {(['original', 'arabic', 'both'] as const).map(t => (
                            <button key={t} onClick={() => setCleanTarget(t)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${cleanTarget === t ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600 border border-emerald-200'}`}>
                              {t === 'original' ? 'الأصلي' : t === 'arabic' ? 'العربي' : 'الكل'}
                            </button>
                          ))}
                        </div>
                        <motion.button 
                          onClick={handlePreview} 
                          disabled={isLoading}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-50 transition-all"
                        >
                          {isLoading ? <Loader2 className="animate-spin" /> : <BarChart3 size={20} />}
                          تحليل الفصول واكتشاف الكلمات
                        </motion.button>
                      </>
                    )}

                    {isPreviewing && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-5 rounded-xl border border-emerald-200 space-y-4">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-stone-800 flex items-center gap-2">
                            <BarChart3 size={18} className="text-emerald-600" />
                            نتائج التحليل
                          </h5>
                          <button onClick={() => setIsPreviewing(false)} className="text-xs text-stone-400 hover:text-stone-600">إلغاء</button>
                        </div>
                        
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                          {Object.entries(detectionStats).map(([pattern, count]) => (
                            <div key={pattern} className="flex items-center justify-between text-sm p-2 bg-stone-50 rounded-lg">
                              <span className="font-mono text-stone-600 truncate flex-1">{pattern}</span>
                              <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${(count as number) > 0 ? 'bg-amber-100 text-amber-700' : 'bg-stone-200 text-stone-400'}`}>
                                {count as number} اكتشاف
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2">
                          <div className="flex items-center gap-2 text-amber-600 font-bold text-xs mb-3">
                            <AlertTriangle size={16} />
                            <span>سيتم حفظ نسخة احتياطية تلقائياً قبل البدء.</span>
                          </div>
                          <motion.button 
                            onClick={startCleaning} 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 transition-all"
                          >
                            <Sparkles size={20} />
                            تأكيد وبدء التنظيف الشامل
                          </motion.button>
                        </div>
                      </motion.div>
                    )}

                    {isApplying && (
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs font-bold text-emerald-700">
                          <div className="flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            <span>جاري معالجة الفصول...</span>
                          </div>
                          <span>{applyProgress.current} / {applyProgress.total}</span>
                        </div>
                        <div className="h-2 bg-emerald-200 rounded-full overflow-hidden">
                          <motion.div className="h-full bg-emerald-600" initial={{ width: 0 }} animate={{ width: `${(applyProgress.current / applyProgress.total) * 100}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* History Tab */
            <div className="space-y-4">
              {logs.length === 0 ? (
                <div className="text-center py-20 text-stone-400 border-2 border-dashed border-stone-100 rounded-3xl">
                  <History size={48} className="mx-auto mb-4 opacity-10" />
                  <p>لا توجد عمليات تنظيف مسجلة حالياً</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:border-amber-200 transition-all">
                      <div className="p-4 flex items-center justify-between bg-stone-50/50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                            <Sparkles size={18} />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-stone-800">تنظيف شامل للمخزن</div>
                            <div className="text-[10px] text-stone-400">{new Date(log.created_at).toLocaleString('ar-EG')}</div>
                          </div>
                        </div>
                        <motion.button 
                          onClick={() => handleUndo(log.id)}
                          disabled={isApplying}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-all border border-amber-100"
                        >
                          <RotateCcw size={14} />
                          <span>تراجع عن العملية</span>
                        </motion.button>
                      </div>
                      <div className="p-4 grid grid-cols-2 gap-4 border-t border-stone-100">
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold text-stone-400 uppercase">الهدف</div>
                          <div className="text-xs font-bold text-stone-600">
                            {log.target === 'original' ? 'النص الأصلي' : log.target === 'arabic' ? 'النص العربي' : 'الكل'}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold text-stone-400 uppercase">إجمالي الاكتشافات</div>
                          <div className="text-xs font-bold text-emerald-600">
                            {Object.values(log.stats).reduce((a, b) => (a as number) + (b as number), 0) as number} كلمة/جملة
                          </div>
                        </div>
                      </div>
                      <div className="px-4 pb-4">
                        <div className="text-[10px] font-bold text-stone-400 uppercase mb-2">تفاصيل الاكتشافات</div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(log.stats).map(([pattern, count]) => (
                            <div key={pattern} className="text-[10px] bg-stone-100 text-stone-600 px-2 py-1 rounded-md flex items-center gap-1">
                              <span className="font-mono truncate max-w-[100px]">{pattern}</span>
                              <span className="font-bold text-amber-600">({count})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
