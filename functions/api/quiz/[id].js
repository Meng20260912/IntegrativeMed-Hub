// POST /api/quiz/<id> → 匿名記錄一次作答（D1 binding QUIZ_DB）
// 只存選項索引、結果類型、總分、選填的 MBTI 與日期；不存 IP、User-Agent 或任何可識別資訊。
// 結果不對外提供讀取端點，只供作者查詢 D1。
const QUIZZES = { 'hospital-or-clinic': { questions: 14, options: 4, motives: 2, types: ['hospital', 'clinic'] } };
const MBTI = /^[EI][NS][FT][JP]$/;

const isIdx = (x, max) => Number.isInteger(x) && x >= 0 && x < max;

export async function onRequestPost({ request, env, params }) {
  const cfg = QUIZZES[params.id];
  if (!cfg) return new Response('not found', { status: 404 });

  let b;
  try { b = await request.json(); } catch { return new Response('bad json', { status: 400 }); }

  const ok = b && typeof b.v === 'string' && b.v.length <= 20
    && Array.isArray(b.a) && b.a.length === cfg.questions && b.a.every((x) => isIdx(x, cfg.options))
    && Array.isArray(b.m) && b.m.length === cfg.motives && b.m.every((x) => x === null || isIdx(x, cfg.options))
    && cfg.types.includes(b.t) && Number.isInteger(b.s) && Math.abs(b.s) <= 100
    && (b.mbti === null || (typeof b.mbti === 'string' && MBTI.test(b.mbti)));
  if (!ok) return new Response('bad payload', { status: 400 });

  if (!env.QUIZ_DB) return new Response(null, { status: 204 });

  const day = new Date().toISOString().slice(0, 10);
  await env.QUIZ_DB.prepare(
    'INSERT INTO responses (quiz, version, day, answers, motives, result, score, mbti) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(params.id, b.v, day, JSON.stringify(b.a), JSON.stringify(b.m), b.t, b.s, b.mbti).run();

  return new Response(null, { status: 204 });
}
