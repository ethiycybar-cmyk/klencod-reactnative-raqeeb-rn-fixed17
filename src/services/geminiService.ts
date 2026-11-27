import { getGeminiKey, getGeminiModel } from './appPrefs';

export type ProductReport = { text: string; sources: string[]; grounded: boolean };

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function buildPrompt(query: string): string {
  return [
    'أنت مساعد لصاحب متجر تجزئة. اكتب تقريراً موجزاً ومفيداً بالعربية عن هذا المنتج:',
    `"${query}"`,
    '',
    'اذكر بإيجاز، في نقاط قصيرة: (1) ما هو المنتج وعلامته التجارية، (2) بلد الصنع والشركة المصنّعة، (3) أشهر الموردين أو الموزعين المعروفين، (4) مدة الصلاحية المعتادة وطريقة التخزين، (5) منتجات مشابهة أو بدائل، (6) ملاحظات مفيدة للمتجر مثل السلامة أو أي سحب معلن.',
    'إن لم تتأكد من معلومة فقل إنك غير متأكد ولا تخترع. لا تتجاوز 200 كلمة.',
  ].join('\n');
}

async function callGemini(query: string, withSearch: boolean, key: string, model: string): Promise<ProductReport> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const body: Record<string, unknown> = { contents: [{ parts: [{ text: buildPrompt(query) }] }] };
    if (withSearch) body.tools = [{ google_search: {} }];
    const response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const err = new Error(`HTTP_${response.status}`);
      throw err;
    }
    const data = (await response.json()) as any;
    const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p?.text ?? '').join('').trim();
    if (!text) throw new Error('EMPTY');
    const chunks: any[] = data?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources = Array.from(new Set(chunks.map((c) => c?.web?.title).filter(Boolean))).slice(0, 4) as string[];
    return { text, sources, grounded: withSearch && sources.length > 0 };
  } finally {
    clearTimeout(timer);
  }
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : '';
  if (msg === 'HTTP_400' || msg === 'HTTP_403') return 'مفتاح Gemini غير صالح أو غير مسموح. تحقق منه في الإعدادات.';
  if (msg === 'HTTP_404') return 'اسم النموذج غير صحيح. عدّله من الإعدادات.';
  if (msg === 'HTTP_429') return 'تجاوزت حد الاستخدام المجاني حالياً. حاول بعد قليل.';
  if (msg === 'EMPTY') return 'لم يصل رد مفيد. جرّب وصفاً أدق للمنتج.';
  if (e instanceof Error && e.name === 'AbortError') return 'انتهت مهلة الاتصال. تحقق من الإنترنت وحاول مجدداً.';
  return 'تعذّر الاتصال. تحقق من الإنترنت وحاول مجدداً.';
}

/** تقرير عن منتج عبر Gemini مع بحث Google إن أمكن، وإلا يعود بدون بحث مباشر. */
export async function fetchProductReport(query: string): Promise<ProductReport> {
  const key = getGeminiKey();
  if (!key) throw new Error('NO_KEY');
  const model = getGeminiModel();
  try {
    return await callGemini(query, true, key, model);
  } catch (first) {
    const msg = first instanceof Error ? first.message : '';
    // البحث المباشر قد لا يكون متاحاً في الطبقة المجانية؛ نحاول بدونه قبل الاستسلام.
    if (msg === 'HTTP_400' || msg === 'HTTP_403' || msg === 'HTTP_429' || msg === 'EMPTY') {
      try {
        return await callGemini(query, false, key, model);
      } catch (second) {
        throw new Error(friendlyError(second));
      }
    }
    throw new Error(friendlyError(first));
  }
}
