import React, { useState } from 'react';
import { supabase, type Novel, type Chapter } from '../supabase';
import { Download, Upload, Loader2, Database, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const BackupManager: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

  const exportData = async () => {
    setIsExporting(true);
    setProgress(0);
    setStatus({ type: 'info', message: 'جاري تحضير البيانات...' });

    try {
      // 1. Fetch all novels
      const { data: novels, error: novelsError } = await supabase
        .from('novels')
        .select('*');

      if (novelsError) throw novelsError;

      // 2. Fetch all chapters in batches
      let allChapters: Chapter[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('chapters')
          .select('*')
          .range(from, from + step - 1);

        if (error) throw error;

        const batch = data || [];
        allChapters = [...allChapters, ...batch];
        
        if (batch.length < step) {
          hasMore = false;
        } else {
          from += step;
          setProgress(Math.min(90, (allChapters.length / (allChapters.length + 1000)) * 100));
        }
      }

      const backupData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        novels: novels || [],
        chapters: allChapters
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `novel_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgress(100);
      setStatus({ type: 'success', message: 'تم تصدير النسخة الاحتياطية بنجاح!' });
    } catch (error: any) {
      console.error('Export error:', error);
      setStatus({ type: 'error', message: `فشل التصدير: ${error.message}` });
    } finally {
      setIsExporting(false);
      setTimeout(() => setStatus(null), 5000);
    }
  };

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('تحذير: الاستيراد قد يؤدي لتحديث البيانات الموجودة. هل تريد الاستمرار؟')) {
      e.target.value = '';
      return;
    }

    setIsImporting(true);
    setProgress(0);
    setStatus({ type: 'info', message: 'جاري قراءة الملف...' });

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      if (!backupData.novels || !backupData.chapters) {
        throw new Error('ملف النسخة الاحتياطية غير صالح');
      }

      // 1. Import Novels
      setStatus({ type: 'info', message: 'جاري استيراد الروايات...' });
      const { error: novelsError } = await supabase
        .from('novels')
        .upsert(backupData.novels);

      if (novelsError) throw novelsError;

      // 2. Import Chapters in batches
      const chapters = backupData.chapters;
      const batchSize = 100;
      let importedCount = 0;

      for (let i = 0; i < chapters.length; i += batchSize) {
        const batch = chapters.slice(i, i + batchSize);
        setStatus({ type: 'info', message: `جاري استيراد الفصول (${i} / ${chapters.length})...` });
        
        const { error } = await supabase
          .from('chapters')
          .upsert(batch, { onConflict: 'novel_id,chapter_number' });

        if (error) throw error;
        
        importedCount += batch.length;
        setProgress((importedCount / chapters.length) * 100);
      }

      setStatus({ type: 'success', message: `تم استيراد ${backupData.novels.length} رواية و ${chapters.length} فصل بنجاح!` });
      // Refresh page to show new data
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      console.error('Import error:', error);
      setStatus({ type: 'error', message: `فشل الاستيراد: ${error.message}` });
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="bg-bg-secondary p-6 rounded-3xl border border-border-primary shadow-sm space-y-6">
      <div className="flex items-center gap-3 border-b border-border-primary pb-4">
        <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
          <Database size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-text-primary">إدارة النسخ الاحتياطي</h3>
          <p className="text-sm text-text-secondary">قم بتصدير أو استيراد كامل قاعدة البيانات</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={exportData}
          disabled={isExporting || isImporting}
          className="flex items-center justify-center gap-3 p-4 bg-text-primary text-bg-primary rounded-2xl hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-text-primary/10"
        >
          {isExporting ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
          <span className="font-bold">تصدير نسخة احتياطية (JSON)</span>
        </button>

        <label className="flex items-center justify-center gap-3 p-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-500/20">
          {isImporting ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
          <span className="font-bold">استيراد نسخة احتياطية</span>
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={importData}
            disabled={isExporting || isImporting}
          />
        </label>
      </div>

      <AnimatePresence>
        {(isExporting || isImporting) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <div className="flex justify-between text-xs font-bold text-text-secondary">
              <span>التقدم</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 bg-bg-primary rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
          </motion.div>
        )}

        {status && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={`p-4 rounded-2xl flex items-center gap-3 ${
              status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
              status.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
              'bg-blue-500/10 text-blue-500 border border-blue-500/20'
            }`}
          >
            {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <p className="text-sm font-bold">{status.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 flex gap-3">
        <AlertCircle className="text-amber-500 shrink-0" size={20} />
        <p className="text-xs text-amber-500 leading-relaxed">
          <strong>ملاحظة:</strong> عملية الاستيراد ستقوم بتحديث الروايات والفصول الموجودة (Upsert). إذا كان هناك فصل بنفس الرقم في نفس الرواية، سيتم استبداله ببيانات النسخة الاحتياطية.
        </p>
      </div>
    </div>
  );
};
