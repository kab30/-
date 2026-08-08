import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Trash2, Edit3, Image as ImageIcon, Link2, BookOpen, FileText, Loader2, AlertTriangle } from 'lucide-react';
import { supabase, type Novel } from '../supabase';

interface EditNovelModalProps {
  isOpen: boolean;
  onClose: () => void;
  novel: Novel | null;
  onSave: (updatedNovel: Novel) => void;
  onDelete?: (novelId: string) => void;
}

export const EditNovelModal: React.FC<EditNovelModalProps> = ({
  isOpen,
  onClose,
  novel,
  onSave,
  onDelete
}) => {
  const [title, setTitle] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [totalChapters, setTotalChapters] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (novel) {
      setTitle(novel.title || '');
      setOriginalTitle(novel.original_title || '');
      setSourceUrl(novel.source_url || '');
      setCoverUrl(novel.cover_url || '');
      setTotalChapters(novel.total_chapters ? String(novel.total_chapters) : '');
      setNotes(novel.notes || '');
      setShowDeleteConfirm(false);
    }
  }, [novel, isOpen]);

  if (!isOpen || !novel) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('يرجى إدخال اسم الرواية');
      return;
    }

    setIsSaving(true);
    try {
      const parsedTotal = totalChapters.trim() ? parseInt(totalChapters.trim(), 10) : null;

      const updatedPayload = {
        title: title.trim(),
        original_title: originalTitle.trim() || null,
        source_url: sourceUrl.trim() || null,
        cover_url: coverUrl.trim() || 'https://picsum.photos/seed/novel/400/600',
        total_chapters: isNaN(parsedTotal as number) ? null : parsedTotal,
        notes: notes.trim() || null
      };

      const { data, error } = await supabase
        .from('novels')
        .update(updatedPayload)
        .eq('id', novel.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        onSave(data as Novel);
        onClose();
      }
    } catch (err: any) {
      console.error('Error updating novel:', err);
      alert('حدث خطأ أثناء حفظ التعديلات: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('novels')
        .delete()
        .eq('id', novel.id);

      if (error) {
        throw error;
      }

      if (onDelete) {
        onDelete(novel.id);
      }
      onClose();
    } catch (err: any) {
      console.error('Error deleting novel:', err);
      alert('حدث خطأ أثناء حذف الرواية: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-2xl max-h-[90vh] bg-bg-secondary rounded-3xl shadow-2xl overflow-hidden border border-border-primary flex flex-col"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-border-primary flex items-center justify-between bg-bg-secondary sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center">
                <Edit3 size={20} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-text-primary">تعديل معلومات الرواية</h3>
                <p className="text-xs text-text-secondary">تعديل العنوان، الغلاف، الرابط والملاحظات</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-primary rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Cover Image Preview & Input */}
              <div className="w-full sm:w-36 flex flex-col items-center gap-2 shrink-0">
                <div className="w-32 h-48 sm:w-36 sm:h-52 bg-bg-primary rounded-2xl overflow-hidden border border-border-primary relative group shadow-md">
                  <img
                    src={coverUrl || 'https://picsum.photos/seed/novel/400/600'}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/novel/400/600';
                    }}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                    معاينة الغلاف
                  </div>
                </div>
              </div>

              {/* Input Fields */}
              <div className="flex-1 space-y-4 w-full">
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-bold text-text-secondary flex items-center gap-1.5">
                    <BookOpen size={14} className="text-emerald-500" />
                    <span>اسم الرواية (بالعربية) *</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full p-3 bg-bg-primary border border-border-primary rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-text-primary text-sm font-medium"
                    placeholder="مثلاً: رواية ملك الآلهة"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-bold text-text-secondary flex items-center gap-1.5">
                    <BookOpen size={14} className="text-emerald-500" />
                    <span>الاسم الأصلي (بلغة الرواية الأصلية)</span>
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 bg-bg-primary border border-border-primary rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-text-primary text-sm font-medium"
                    placeholder="مثلاً: Sovereign of the Three Realms"
                    value={originalTitle}
                    onChange={(e) => setOriginalTitle(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-bold text-text-secondary flex items-center gap-1.5">
                      <Link2 size={14} className="text-emerald-500" />
                      <span>رابط المصدر / الرواية</span>
                    </label>
                    <input
                      type="url"
                      className="w-full p-3 bg-bg-primary border border-border-primary rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-text-primary text-sm font-medium"
                      placeholder="https://..."
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-bold text-text-secondary flex items-center gap-1.5">
                      <ImageIcon size={14} className="text-emerald-500" />
                      <span>رابط صورة الغلاف</span>
                    </label>
                    <input
                      type="url"
                      className="w-full p-3 bg-bg-primary border border-border-primary rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-text-primary text-sm font-medium"
                      placeholder="https://..."
                      value={coverUrl}
                      onChange={(e) => setCoverUrl(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-bold text-text-secondary flex items-center gap-1.5">
                    <FileText size={14} className="text-emerald-500" />
                    <span>إجمالي عدد الفصول المتوقع</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="w-full p-3 bg-bg-primary border border-border-primary rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-text-primary text-sm font-medium"
                    placeholder="مثال: 1500"
                    value={totalChapters}
                    onChange={(e) => setTotalChapters(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-text-secondary flex items-center gap-1.5">
                <FileText size={14} className="text-emerald-500" />
                <span>ملاحظات الرواية</span>
              </label>
              <textarea
                rows={3}
                className="w-full p-3 bg-bg-primary border border-border-primary rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-text-primary text-sm font-medium resize-none"
                placeholder="أضف أي ملاحظات أو روابط خاصة بهذه الرواية..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Delete Section */}
            <div className="pt-2 border-t border-border-primary">
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 text-red-500 hover:text-red-600 font-bold text-xs sm:text-sm transition-colors py-2"
                >
                  <Trash2 size={16} />
                  <span>حذف هذه الرواية نهائياً</span>
                </button>
              ) : (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-red-500 font-bold text-sm">
                    <AlertTriangle size={18} />
                    <span>تأكيد الحذف النهائي</span>
                  </div>
                  <p className="text-xs text-text-secondary">
                    هل أنت متأكد من حذف الرواية "{novel.title}" وكل الفصول التابعة لها؟ لا يمكن التراجع عن هذا الإجراء.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={handleDelete}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md flex items-center gap-2"
                    >
                      {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      <span>نعم، احذف الرواية</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="bg-bg-primary hover:bg-bg-secondary text-text-secondary px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all border border-border-primary"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-primary">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 rounded-xl font-bold text-text-secondary bg-bg-primary hover:bg-bg-secondary transition-all border border-border-primary text-sm"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>حفظ التغيرات</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
