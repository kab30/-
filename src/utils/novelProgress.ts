import { supabase, type Novel } from '../supabase';

export interface NovelProgress {
  novelId: string;
  totalStored: number;
  translatedCount: number;
  lastTranslatedChapter: number;
  maxStoredChapter: number;
  totalChapters: number;
  percentage: number;
  nextChapterToTranslate: number;
}

export async function fetchAllNovelsProgress(novels: Novel[]): Promise<Record<string, NovelProgress>> {
  if (!novels || novels.length === 0) return {};

  try {
    // 1. Fetch lightweight list of all chapters (only novel_id and chapter_number)
    let allChapters: { novel_id: string; chapter_number: number }[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('chapters')
        .select('novel_id, chapter_number')
        .range(from, from + step - 1);

      if (error) {
        console.error('Error fetching all chapters for progress:', error);
        break;
      }

      const batch = data || [];
      allChapters = [...allChapters, ...batch];
      if (batch.length < step) {
        hasMore = false;
      } else {
        from += step;
      }
    }

    // 2. Fetch translated chapters (where content_arabic is not null and not empty)
    let translatedChapters: { novel_id: string; chapter_number: number }[] = [];
    from = 0;
    hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('chapters')
        .select('novel_id, chapter_number')
        .not('content_arabic', 'is', null)
        .neq('content_arabic', '')
        .range(from, from + step - 1);

      if (error) {
        console.error('Error fetching translated chapters for progress:', error);
        break;
      }

      const batch = data || [];
      translatedChapters = [...translatedChapters, ...batch];
      if (batch.length < step) {
        hasMore = false;
      } else {
        from += step;
      }
    }

    // Group stored chapters by novel
    const storedByNovel = new Map<string, number[]>();
    for (const c of allChapters) {
      if (!storedByNovel.has(c.novel_id)) {
        storedByNovel.set(c.novel_id, []);
      }
      storedByNovel.get(c.novel_id)!.push(c.chapter_number);
    }

    // Group translated chapters by novel
    const translatedByNovel = new Map<string, Set<number>>();
    for (const c of translatedChapters) {
      if (!translatedByNovel.has(c.novel_id)) {
        translatedByNovel.set(c.novel_id, new Set());
      }
      translatedByNovel.get(c.novel_id)!.add(c.chapter_number);
    }

    const progressMap: Record<string, NovelProgress> = {};

    for (const novel of novels) {
      const storedNums = storedByNovel.get(novel.id) || [];
      const translatedSet = translatedByNovel.get(novel.id) || new Set();

      const totalStored = storedNums.length;
      const maxStoredChapter = storedNums.length > 0 ? Math.max(...storedNums) : 0;
      
      const translatedCount = translatedSet.size;
      const translatedNums = Array.from(translatedSet);
      const lastTranslatedChapter = translatedNums.length > 0 ? Math.max(...translatedNums) : 0;

      // Find next untranslated chapter number
      let nextChapterToTranslate = 1;
      if (storedNums.length > 0) {
        const sortedStored = [...storedNums].sort((a, b) => a - b);
        const firstUntranslated = sortedStored.find(num => !translatedSet.has(num));
        nextChapterToTranslate = firstUntranslated !== undefined ? firstUntranslated : (lastTranslatedChapter + 1);
      }

      const totalChapters = novel.total_chapters && novel.total_chapters > 0 
        ? novel.total_chapters 
        : (maxStoredChapter > 0 ? maxStoredChapter : (totalStored > 0 ? totalStored : 0));

      const denominator = totalChapters > 0 ? totalChapters : (maxStoredChapter || totalStored || 1);
      const progressBasis = Math.max(lastTranslatedChapter, translatedCount);
      const percentage = denominator > 0 ? Math.min(100, Math.round((progressBasis / denominator) * 100)) : 0;

      progressMap[novel.id] = {
        novelId: novel.id,
        totalStored,
        translatedCount,
        lastTranslatedChapter,
        maxStoredChapter,
        totalChapters,
        percentage,
        nextChapterToTranslate
      };
    }

    return progressMap;
  } catch (err) {
    console.error('Error calculating novels progress:', err);
    return {};
  }
}
