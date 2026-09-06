// Utility for parsing and extracting chapter numbers from text and EPUB files
// Supports Chinese numerals (e.g. 第一章, 第一百二十章, 第1章), English (Chapter 1), and Arabic (الفصل 1)

export function parseChineseNumber(raw: string): number {
  if (!raw) return NaN;
  // Remove whitespace
  const str = raw.replace(/\s+/g, '').trim();
  if (!str) return NaN;

  // Convert fullwidth numbers to standard ASCII digits
  const normalizedStr = str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
  );

  // If entirely digits
  if (/^\d+$/.test(normalizedStr)) {
    return parseInt(normalizedStr, 10);
  }

  const digitMap: Record<string, number> = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    '零': 0, '〇': 0,
    '一': 1, '壹': 1,
    '二': 2, '贰': 2, '两': 2, '兩': 2,
    '三': 3, '叁': 3, '仨': 3,
    '四': 4, '肆': 4,
    '五': 5, '伍': 5,
    '六': 6, '陆': 6,
    '七': 7, '柒': 7,
    '八': 8, '捌': 8,
    '九': 9, '玖': 9,
  };

  const unitMap: Record<string, number> = {
    '十': 10, '拾': 10,
    '百': 100, '佰': 100,
    '千': 1000, '仟': 1000,
    '万': 10000, '萬': 10000,
    '亿': 100000000, '億': 100000000,
  };

  const hasUnit = /[十拾百佰千仟万萬亿億]/.test(normalizedStr);

  if (!hasUnit) {
    // Positional digits (e.g. "一二三" -> 123, "〇〇一" -> 1)
    let digits = '';
    for (const char of normalizedStr) {
      if (digitMap[char] !== undefined) {
        digits += digitMap[char].toString();
      } else if (/\d/.test(char)) {
        digits += char;
      }
    }
    if (digits.length > 0) {
      return parseInt(digits, 10);
    }
    return NaN;
  }

  // Multiplicative Chinese number system (e.g. 第一百二十三章, 第十一章, 第一千零五章)
  let total = 0;
  let section = 0;
  let currentNum = 0;
  let hasProcessedDigit = false;

  for (let i = 0; i < normalizedStr.length; i++) {
    const char = normalizedStr[i];

    if (digitMap[char] !== undefined || /\d/.test(char)) {
      currentNum = digitMap[char] !== undefined ? digitMap[char] : parseInt(char, 10);
      hasProcessedDigit = true;
    } else if (unitMap[char] !== undefined) {
      const unit = unitMap[char];
      if (unit === 10000 || unit === 100000000) {
        section = (section + currentNum) * unit;
        total += section;
        section = 0;
        currentNum = 0;
        hasProcessedDigit = false;
      } else {
        if (!hasProcessedDigit && unit === 10) {
          // Special case: "十一" (11) where leading "一" before "十" is omitted
          currentNum = 1;
        }
        section += currentNum * unit;
        currentNum = 0;
        hasProcessedDigit = false;
      }
    }
  }

  section += currentNum;
  total += section;

  return total > 0 ? total : NaN;
}

export interface ParsedChapterItem {
  novel_id: string;
  chapter_number: number;
  title: string;
  content_original: string;
  content_arabic?: string;
  isDuplicate: boolean;
}

// Regex matching chapter headers in Chinese, English, Arabic, and numeric forms
// Handles leading symbols/punctuation like: ! ! 第九章, 【第9章】, === 第九章 ===, 10: Chapter 10, Volume 1 Chapter 1
export const CHAPTER_START_REGEX = /^[^a-zA-Z\u4e00-\u9fa5\u0600-\u06ff\r\n]*(?:(?:Volume|Vol\.|Vol|Book|Part|الجزء|المجلد|第\s*\d+\s*卷)\s*\d*[^a-zA-Z\u4e00-\u9fa5\u0600-\u06ff\r\n]*)?(?:第\s*([0-9０-９零〇一壹二贰两兩三叁仨四肆五伍六陆七柒八捌九玖十拾百佰千仟万萬亿億\d\s]+?)\s*(?:章|节|回|折|幕|集|话|話)|(?:Chapter|Chap\.|Chap|Ch\.|Ch)\s*(\d+)|(?:الفصل|فصل)\s*(\d+))/gim;

export function extractChapterNumberFromMatch(match: RegExpMatchArray | RegExpExecArray): number {
  // Group 1: Chinese or mixed numeral (e.g. 第一, 第1, 第百二十三)
  if (match[1]) {
    const num = parseChineseNumber(match[1]);
    if (!isNaN(num)) return num;
  }
  // Group 2: English Chapter number
  if (match[2]) {
    const num = parseInt(match[2], 10);
    if (!isNaN(num)) return num;
  }
  // Group 3: Arabic Chapter number
  if (match[3]) {
    const num = parseInt(match[3], 10);
    if (!isNaN(num)) return num;
  }
  return NaN;
}

export function cleanChapterTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  let title = rawTitle.trim();
  // Remove leading artifacts like ?, !, ¿, ¡, ■, ●, ★, ◆, ▲, ▼, #, =, *, ~, _, -, etc.
  title = title.replace(/^[?!¿¡■●★◆▲▼#=*~_\-\s]+/, '');
  // If title was prefixed with line number like "10: Chapter 10", clean it up
  title = title.replace(/^\d+:\s*(Chapter|Chap|Ch|第|الفصل|فصل)/i, '$1');
  return title.trim();
}

export function extractChapterNumberFromText(text: string): number {
  if (!text) return NaN;
  const regex = /(?:第\s*([0-9０-９零〇一壹二贰两兩三叁仨四肆五伍六陆七柒八捌九玖十拾百佰千仟万萬亿億\d\s]+?)\s*(?:章|节|回|折|幕|集|话|話)|(?:Chapter|Chap\.|Chap|Ch\.|Ch)\s*(\d+)|(?:الفصل|فصل)\s*(\d+))/i;
  const match = text.match(regex);
  if (match) {
    return extractChapterNumberFromMatch(match);
  }
  return NaN;
}

export function parseTextIntoChapters(
  text: string,
  novelId: string,
  maxExistingNum: number,
  existingNumbers: Set<number>
): ParsedChapterItem[] {
  // Enhanced regex matching line starts with optional symbols, numbers, and volume indicators
  const chapterRegex = /^[^a-zA-Z\u4e00-\u9fa5\u0600-\u06ff\r\n]*(?:(?:Volume|Vol\.|Vol|Book|Part|الجزء|المجلد|第\s*\d+\s*卷)\s*\d*[^a-zA-Z\u4e00-\u9fa5\u0600-\u06ff\r\n]*)?(?:第\s*([0-9０-９零〇一壹二贰两兩三叁仨四肆五伍六陆七柒八捌九玖十拾百佰千仟万萬亿億\d\s]+?)\s*(?:章|节|回|折|幕|集|话|話)|(?:Chapter|Chap\.|Chap|Ch\.|Ch)\s*(\d+)|(?:الفصل|فصل)\s*(\d+))/gim;
  const rawMarkers = Array.from(text.matchAll(chapterRegex));

  const parsedChapters: ParsedChapterItem[] = [];

  if (rawMarkers.length === 0) {
    const nextNum = maxExistingNum + 1;
    parsedChapters.push({
      novel_id: novelId,
      chapter_number: nextNum,
      title: `الفصل ${nextNum}`,
      content_original: text.trim(),
      isDuplicate: existingNumbers.has(nextNum)
    });
    return parsedChapters;
  }

  // 1. Detect and bypass Table of Contents (TOC) at the beginning of the file if present.
  // A TOC has many consecutive markers (>10) where the text between them is very short (<120 chars),
  // followed later by the actual story chapters with full content (>300 chars).
  let startIndex = 0;
  if (rawMarkers.length > 20) {
    let initialShortCount = 0;
    const testLimit = Math.min(rawMarkers.length - 1, 25);
    for (let i = 0; i < testLimit; i++) {
      const segLen = rawMarkers[i + 1].index! - rawMarkers[i].index!;
      if (segLen < 150) initialShortCount++;
    }
    // If the beginning consists of mostly short title stubs, scan forward to where the real chapters begin
    if (initialShortCount >= 18) {
      for (let i = 0; i < rawMarkers.length; i++) {
        const segEnd = rawMarkers[i + 1] ? rawMarkers[i + 1].index! : text.length;
        const segLen = segEnd - rawMarkers[i].index!;
        if (segLen >= 300) {
          startIndex = i;
          break;
        }
      }
    }
  }

  const markers = rawMarkers.slice(startIndex);

  // Handle preamble / introductory text before the first chapter
  const firstMarkerIndex = markers[0].index!;
  if (firstMarkerIndex > 10 && startIndex === 0) {
    const introText = text.substring(0, firstMarkerIndex).trim();
    if (introText.length > 50) {
      parsedChapters.push({
        novel_id: novelId,
        chapter_number: 0,
        title: "مقدمة / تمهيد",
        content_original: introText,
        isDuplicate: existingNumbers.has(0)
      });
    }
  }

  // 2. Extract sections in strict document file sequence
  interface RawSection {
    detectedNum: number;
    title: string;
    content: string;
  }

  const rawSections: RawSection[] = [];
  for (let i = 0; i < markers.length; i++) {
    const match = markers[i];
    const detectedNum = extractChapterNumberFromMatch(match);
    const start = match.index!;
    const end = markers[i + 1] ? markers[i + 1].index : text.length;
    const fullContent = text.substring(start, end).trim();

    const lines = fullContent.split('\n');
    const rawTitle = lines[0].trim();
    const cleanedTitle = cleanChapterTitle(rawTitle);
    const bodyLines = lines.slice(1).map(l => l.trim()).filter(Boolean);
    const content = bodyLines.join('\n');

    rawSections.push({
      detectedNum,
      title: cleanedTitle || (detectedNum ? `الفصل ${detectedNum}` : `فصل`),
      content: content || fullContent
    });
  }

  // 3. Filter out empty stubs if a substantial chapter with the same number exists
  const numToSections = new Map<number, RawSection[]>();
  for (const sec of rawSections) {
    if (!isNaN(sec.detectedNum) && sec.detectedNum > 0) {
      const list = numToSections.get(sec.detectedNum) || [];
      list.push(sec);
      numToSections.set(sec.detectedNum, list);
    }
  }

  const filteredSections: RawSection[] = [];
  for (const sec of rawSections) {
    if (!isNaN(sec.detectedNum) && sec.detectedNum > 0) {
      const peers = numToSections.get(sec.detectedNum);
      if (peers && peers.length > 1) {
        const hasSubstantial = peers.some(p => p.content.trim().length >= 250);
        // If there's a substantial chapter and this one is just a tiny stub (<150 chars), skip the stub
        if (hasSubstantial && sec.content.trim().length < 150) {
          continue;
        }
      }
    }
    filteredSections.push(sec);
  }

  // 4. Assign sequential, non-conflicting chapter numbers while strictly maintaining file order
  const usedNumbers = new Set<number>();
  let currentCounter = maxExistingNum;

  for (const sec of filteredSections) {
    let finalNum: number;
    if (!isNaN(sec.detectedNum) && sec.detectedNum > 0 && !usedNumbers.has(sec.detectedNum)) {
      finalNum = sec.detectedNum;
      currentCounter = Math.max(currentCounter, finalNum);
    } else {
      finalNum = ++currentCounter;
    }
    usedNumbers.add(finalNum);

    parsedChapters.push({
      novel_id: novelId,
      chapter_number: finalNum,
      title: sec.title,
      content_original: sec.content,
      isDuplicate: existingNumbers.has(finalNum)
    });
  }

  return parsedChapters;
}

