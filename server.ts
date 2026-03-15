import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import jschardet from 'jschardet';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for scraping
  app.post('/api/scrape', async (req, res, next) => {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    try {
      // Try to fetch the page
      let response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Referer': 'https://www.google.com/',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 20000,
        validateStatus: () => true // Allow any status code to handle challenges
      });

      const buffer = Buffer.from(response.data);
      let encoding = 'utf-8';
      
      // ... (encoding detection logic remains same)
      const contentType = response.headers['content-type'];
      if (contentType && contentType.includes('charset=')) {
        encoding = contentType.split('charset=')[1].split(';')[0].trim();
      } else {
        const detected = jschardet.detect(buffer);
        if (detected && detected.confidence > 0.8) {
          encoding = detected.encoding;
        } else {
          const head = buffer.slice(0, 1024).toString('ascii');
          const match = head.match(/charset=["']?([\w-]+)["']?/i);
          if (match) {
            encoding = match[1];
          } else if (url.includes('69shuba') || url.includes('ptwxz') || url.includes('uukanshu') || url.includes('ixdzs8')) {
            encoding = 'gbk';
          }
        }
      }

      let html = iconv.decode(buffer, encoding);
      
      // Check for security challenges
      if (html.includes('验证') || html.includes('Cloudflare') || html.includes('Security Check') || html.includes('安全验证')) {
        return res.status(403).json({ 
          error: 'الموقع محمي بنظام حماية (Cloudflare). يرجى نسخ النص يدوياً أو تجربة موقع آخر.' 
        });
      }

      const $ = cheerio.load(html);
      
      let title = '';
      let content = '';

      // Common selectors for Chinese novel sites
      // 69shuba (handles .com, .cx, .me etc)
      if (url.includes('69shuba')) {
        // Try multiple possible selectors for 69shuba
        title = $('.txtnav h1').text().trim() || $('.bookname h1').text().trim() || $('h1').text().trim();
        
        // 69shuba chapter content is usually in .txtnav or #content
        let contentElement = $('.txtnav').length > 0 ? $('.txtnav') : $('#content');
        
        if (contentElement.length > 0) {
          // Clone to avoid modifying original
          const tempContent = contentElement.clone();
          // Remove unwanted elements like script, ads, and navigation
          tempContent.find('h1, .n_p, .n_n, script, style, div[style*="display:none"]').remove();
          
          content = tempContent.text().trim();
        }
        
        // Clean up common 69shuba noise
        content = content.replace(/69\s*书\s*吧/gi, '')
                        .replace(/www\.69shuba\.(cx|com|me|net)/gi, '')
                        .replace(/本章未完.*/g, '')
                        .replace(/第.*章/g, '')
                        .trim();
      } 
      // ptwxz.com
      else if (url.includes('ptwxz.com')) {
        title = $('h1').text().trim();
        content = $('#content').text().trim();
        content = content.replace(/www\.ptwxz\.com/g, '')
                        .replace(/飄天文學/g, '')
                        .trim();
      }
      // uukanshu.com
      else if (url.includes('uukanshu.com')) {
        title = $('#timu').text().trim();
        content = $('#contentbox').text().trim();
        content = content.replace(/UU看书/g, '')
                        .replace(/www\.uukanshu\.com/g, '')
                        .trim();
      }
      // ixdzs8.com
      else if (url.includes('ixdzs8.com')) {
        title = $('.chapter-title').text().trim() || $('h1').text().trim();
        content = $('#content').text().trim() || $('.content').text().trim() || $('.page-content').text().trim() || $('.read-content').text().trim();
        
        // Clean up ixdzs8 specific noise
        content = content.replace(/ixdzs8\.com/gi, '')
                        .replace(/本站.*最新章节/g, '')
                        .trim();
      }
      // General fallback with more aggressive selectors
      else {
        title = $('.chapter-title').text().trim() || $('h1').first().text().trim() || $('title').text().trim();
        const contentSelectors = [
          '#content', '.content', '.read-content', '.txtnav', 
          '#chaptercontent', 'article', '.article-content', '#article',
          '.page-content', '.post-content', '.entry-content'
        ];
        
        for (const selector of contentSelectors) {
          const found = $(selector);
          if (found.length > 0) {
            // Clean the found element
            const clone = found.clone();
            clone.find('script, style, ins, .ads, .advertisement, .nav, .footer, .header').remove();
            content = clone.text().trim();
            if (content.length > 100) break; // Found something substantial
          }
        }
      }

      if (!content) {
        console.log(`Extraction failed for URL: ${url}`);
        if (html.includes('验证') || html.includes('Cloudflare')) {
          console.log('Detected security challenge/Cloudflare');
        }
        return res.status(404).json({ error: 'Could not extract content' });
      }

      res.json({ title, content });
    } catch (error: any) {
      console.error('Scraping error:', error.message);
      res.status(500).json({ error: 'Failed to fetch or parse the URL' });
    }
  });

  // API Route for Gemini Share links
  app.post('/api/gemini-share', async (req, res) => {
    const { url } = req.body;
    if (!url || !url.includes('gemini.google.com/share')) {
      return res.status(400).json({ error: 'Valid Gemini share URL is required' });
    }

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      const html = response.data;
      const $ = cheerio.load(html);
      
      // Gemini share data is often in a script tag
      // We look for the script that contains the chat data
      let chatData: any = null;
      
      $('script').each((i, el) => {
        const text = $(el).text();
        // Pattern 1: AF_initDataCallback
        if (text.includes('AF_initDataCallback') && (text.includes('ds:1') || text.includes('sharedChat'))) {
          try {
            // More flexible regex for data extraction
            const match = text.match(/data:\s*(\[[\s\S]*?\])\s*,\s*sideChannel/);
            if (match) {
              chatData = JSON.parse(match[1]);
            }
          } catch (e) {
            console.error('Error parsing AF_initDataCallback:', e);
          }
        }
        
        // Pattern 2: window.WIZ_globalProps
        if (!chatData && text.includes('WIZ_globalProps')) {
          try {
            const match = text.match(/WIZ_globalProps\s*=\s*(\{[\s\S]*?\});/);
            if (match) {
              const props = JSON.parse(match[1]);
              if (props.data) chatData = props.data;
            }
          } catch (e) {}
        }
      });

      if (!chatData) {
        // Fallback: search for any large JSON-like array that might contain the chat
        $('script').each((i, el) => {
          if (chatData) return;
          const text = $(el).text();
          if (text.length > 5000 && text.includes('[[') && text.includes(']]')) {
             // Try to find the largest array
             const match = text.match(/\[\[[\s\S]*\]\]/);
             if (match) {
               try {
                 const potential = JSON.parse(match[0]);
                 if (Array.isArray(potential)) chatData = potential;
               } catch(e) {}
             }
          }
        });
      }

      if (!chatData) {
        return res.status(404).json({ error: 'Could not find chat data in the page. It might be private or expired.' });
      }

      const chaptersMap: Map<number, { number: number; title: string; content_original: string; content_arabic: string }> = new Map();
      let chapterCounter = 1;

      const findStrings = (obj: any) => {
        if (typeof obj === 'string') {
          // Split the string into potential chapters
          const parts = obj.split(/(?=Chapter|الفصل|فصل|第\s*[0-9\u0660-\u0669\u06f0-\u06f9\u4e00-\u9fa5]+\s*章|第\s*[0-9\u0660-\u0669\u06f0-\u06f9\u4e00-\u9fa5]+)/i);
          
          parts.forEach(part => {
            const trimmed = part.trim();
            if (trimmed.length < 100) return;

            const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length === 0) return;

            const firstLine = lines[0];
            
            // Permissive regex to catch chapter numbers including Arabic/Persian numerals
            const chapterMatch = trimmed.match(/^(?:Chapter|الفصل|فصل|第)[:\s]*([0-9\u0660-\u0669\u06f0-\u06f9\u4e00-\u9fa5]+)/i) ||
                                 firstLine.match(/(?:Chapter|الفصل|فصل|第)[:\s]*([0-9\u0660-\u0669\u06f0-\u06f9\u4e00-\u9fa5]+)/i);
            
            const hasArabic = /[\u0600-\u06FF]/.test(trimmed);
            const isCJK = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/.test(trimmed);
            const wordCount = isCJK ? trimmed.length : trimmed.split(/\s+/).length;
            
            if (wordCount >= 200) { // Lowered threshold to be more inclusive
              const hasChapterKeyword = /^(?:Chapter|الفصل|فصل|第)/i.test(firstLine) || 
                                       /^(?:Chapter|الفصل|فصل|第)/i.test(trimmed);

              if (hasChapterKeyword || chapterMatch) {
                let num: number;
                if (chapterMatch) {
                  const numStr = chapterMatch[1];
                  // Convert Arabic/Persian numerals to Western
                  const western = numStr.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
                                       .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString());
                  num = parseInt(western);
                  if (isNaN(num)) num = chapterCounter++;
                } else {
                  num = chapterCounter++;
                }
                
                const title = firstLine.length < 150 ? firstLine : `فصل ${num}`;
                
                // If a part contains BOTH a lot of original and Arabic, try to split it
                // This is a simple heuristic: if it has Arabic and is long, it might be both
                // For now, we'll stick to the existing logic but refine the hasArabic check
                // to be more specific about whether it's PRIMARILY Arabic or not.
                
                // Better heuristic: if it contains both, we might want to split.
                // But for now, let's just ensure they merge correctly if they are separate parts.
                
                if (!chaptersMap.has(num)) {
                  chaptersMap.set(num, {
                    number: num,
                    title: title,
                    content_original: !hasArabic ? trimmed : '',
                    content_arabic: hasArabic ? trimmed : ''
                  });
                } else {
                  const existing = chaptersMap.get(num)!;
                  if (hasArabic) {
                    // If it has Arabic, it's likely the translation
                    // But if it also has a lot of non-Arabic, it might be both
                    // For simplicity, we'll append to Arabic if it's already there, or set it
                    existing.content_arabic = (existing.content_arabic ? existing.content_arabic + '\n\n' : '') + trimmed;
                  } else {
                    existing.content_original = (existing.content_original ? existing.content_original + '\n\n' : '') + trimmed;
                  }
                  
                  if (existing.title.startsWith('فصل ') && !title.startsWith('فصل ')) {
                    existing.title = title;
                  }
                }
              }
            }
          });
        } else if (Array.isArray(obj)) {
          obj.forEach(findStrings);
        } else if (typeof obj === 'object' && obj !== null) {
          Object.values(obj).forEach(findStrings);
        }
      };

      findStrings(chatData);

      const chapters = Array.from(chaptersMap.values());
      // Sort chapters by number
      chapters.sort((a, b) => a.number - b.number);

      res.json({ chapters });
    } catch (error: any) {
      console.error('Gemini share error:', error.message);
      res.status(500).json({ error: 'Failed to fetch Gemini share link' });
    }
  });

  // Global error handler to ensure JSON responses for API
  app.use('/api', (err: any, req: any, res: any, next: any) => {
    console.error('API Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error'
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
