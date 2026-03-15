import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, CheckCircle2, Zap, Globe, Save } from 'lucide-react';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose, version }) => {
  const updates = [
    {
      title: 'تحسين دمج الفصول',
      description: 'حل مشكلة حفظ الفصول الأصلية والمترجمة بشكل منفصل ودعم الأرقام العربية والفارسية (١، ٢، ٣).',
      icon: <Zap className="text-amber-500" size={20} />
    },
    {
      title: 'الجلب الذكي من Gemini',
      description: 'دعم كامل للتعرف على اللغات (صيني، إنجليزي، ياباني) مقابل العربية وتوزيعها تلقائياً.',
      icon: <Globe className="text-blue-500" size={20} />
    },
    {
      title: 'شريط تقدم الحفظ',
      description: 'إضافة عداد ومتابعة حية لعملية حفظ الفصول لضمان عدم ضياع البيانات.',
      icon: <Save className="text-emerald-500" size={20} />
    },
    {
      title: 'تحسين استقرار النظام',
      description: 'حل مشكلة إعادة تحميل الصفحة المفاجئ أثناء عمليات الحفظ الكبيرة وتحسين دقة التعرف على الفصول.',
      icon: <CheckCircle2 className="text-indigo-500" size={20} />
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
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-emerald-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-200">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-stone-900">ما الجديد في الإصدار {version}؟</h3>
                  <p className="text-xs text-stone-500 font-medium">تحديثات وتحسينات جديدة لتجربة أفضل</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={onClose} 
                className="p-2 hover:bg-white rounded-full transition-colors text-stone-400 shadow-sm"
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
                  className="flex gap-4 p-4 rounded-2xl border border-stone-100 hover:border-emerald-100 hover:bg-emerald-50/30 transition-all group"
                >
                  <div className="shrink-0 p-3 bg-white rounded-xl shadow-sm border border-stone-50 group-hover:scale-110 transition-transform">
                    {update.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-800 mb-1">{update.title}</h4>
                    <p className="text-sm text-stone-500 leading-relaxed">{update.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="p-6 bg-stone-50 border-t border-stone-100">
              <button 
                type="button"
                onClick={onClose}
                className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-stone-200"
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
