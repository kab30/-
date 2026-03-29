import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, CheckCircle2, Zap, Globe, Save, Clipboard, Eye } from 'lucide-react';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose, version }) => {
  const updates = [
    {
      title: 'الترجمة الآلية بواسطة Gemini (جديد)',
      description: 'إمكانية ترجمة الفصول المختارة آلياً وبسرعة عالية باستخدام ذكاء Gemini الاصطناعي.',
      icon: <Sparkles className="text-emerald-500" size={20} />
    },
    {
      title: 'المتصفح المدمج',
      description: 'فتح الموقع الأصلي في نافذة جانبية داخل الموقع لتسهيل النسخ واللصق وتجاوز الحماية.',
      icon: <Globe className="text-blue-500" size={20} />
    },
    {
      title: 'تحديث النص الأصلي',
      description: 'إضافة زر لصق لتحديث النص الأصلي للفصل مباشرة من الحافظة في حال فشل السحب.',
      icon: <Clipboard className="text-emerald-500" size={20} />
    },
    {
      title: 'تحسين سحب ملفات Text',
      description: 'تطوير منطق استخراج الفصول من ملفات التكست لتجنب التداخل مع الطوابع الزمنية ودعم المقدمات.',
      icon: <Zap className="text-amber-500" size={20} />
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
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
            className="relative w-full max-w-lg bg-bg-secondary rounded-3xl shadow-2xl overflow-hidden border border-border-primary"
          >
            <div className="p-6 border-b border-border-primary flex items-center justify-between bg-emerald-500/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-text-primary">ما الجديد في الإصدار {version}؟</h3>
                  <p className="text-xs text-text-secondary font-medium">تحديثات وتحسينات جديدة لتجربة أفضل</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={onClose} 
                className="p-2 hover:bg-bg-secondary rounded-full transition-colors text-text-secondary shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {updates.map((update, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex gap-4 p-4 rounded-2xl border border-border-primary hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group"
                >
                  <div className="shrink-0 p-3 bg-bg-secondary rounded-xl shadow-sm border border-border-primary group-hover:scale-110 transition-transform">
                    {update.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-text-primary mb-1">{update.title}</h4>
                    <p className="text-sm text-text-secondary leading-relaxed">{update.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="p-6 bg-bg-primary border-t border-border-primary">
              <button 
                type="button"
                onClick={onClose}
                className="w-full bg-text-primary text-bg-primary py-4 rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl shadow-text-primary/10"
              >
                فهمت، استمرار
              </button>
            </div>
          </motion.div>

        </div>
      )}
    </AnimatePresence>
  );
};
