#!/usr/bin/env node
// Submit all sitemap URLs to IndexNow (Bing, Yandex, Seznam, Naver...).
// Usage: npm run indexnow [-- <sitemap-url>]
const HOST = "ziggy-ai.fr";
const KEY = "5be039c7ba74dd2a264afc9c534b76e2";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const SITEMAP = process.argv[2] || `https://${HOST}/sitemap.xml`;

async function collect(url, seen = new Set()) {
  if (seen.has(url)) return [];
  seen.add(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sitemap fetch failed ${res.status}: ${url}`);
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  if (/<sitemapindex/i.test(xml)) {
    const out = [];
    for (const l of locs) out.push(...(await collect(l, seen)));
    return out;
  }
  return locs;
}

const urls = [...new Set(await collect(SITEMAP))]
  .filter((u) => new URL(u).host === HOST)
  .slice(0, 10000);
if (!urls.length) {
  console.error("No URLs found in sitemap");
  process.exit(1);
}
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls }),
});
console.log(`IndexNow: submitted ${urls.length} URLs -> HTTP ${res.status}`);
const body = await res.text();
if (body) console.log(body);
if (res.status >= 400) process.exit(1);
