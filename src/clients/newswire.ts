// Rockstar Newswire client for the weekly GTA Online event. The Newswire root is
// a JS shell, so we target the GTA Online tag feed and extract the latest weekly
// update article, then pull a text summary. Best-effort with graceful fallback.
import { fetchText } from "../lib/http.js";

const FEED_URLS = [
  "https://www.rockstargames.com/newswire/tags/GTA-Online",
  "https://www.rockstargames.com/newswire",
];

export interface WeeklyUpdate {
  title: string;
  url: string;
  summary: string;
  bonuses: string[];
  podiumVehicle?: string;
  source: string;
}

function absolute(url: string): string {
  if (url.startsWith("http")) return url;
  return `https://www.rockstargames.com${url}`;
}

/** Pull article links + titles out of the feed HTML. */
function extractArticles(html: string): { title: string; url: string }[] {
  const out: { title: string; url: string }[] = [];
  const seen = new Set<string>();
  const re = /href="(\/newswire\/article\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const url = m[1];
    const title = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!title || seen.has(url)) continue;
    seen.add(url);
    out.push({ url: absolute(url), title });
  }
  return out;
}

function pickWeekly(articles: { title: string; url: string }[]): { title: string; url: string } | undefined {
  const keywords = ["weekly update", "bonuses", "this week in gta", "discounts", "double"];
  return (
    articles.find((a) => keywords.some((k) => a.title.toLowerCase().includes(k))) || articles[0]
  );
}

/** Extract bonus bullet lines and the podium vehicle from an article page. */
function parseArticle(html: string): { summary: string; bonuses: string[]; podium?: string } {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  const bonuses: string[] = [];
  const bonusRe = /([A-Z][^.]{0,90}?(2X|3X|4X|Double|Triple|GTA\$ and RP)[^.]{0,90}?)\./g;
  let m: RegExpExecArray | null;
  while ((m = bonusRe.exec(text)) && bonuses.length < 15) {
    const line = m[1].trim();
    if (line.length > 8) bonuses.push(line);
  }

  const podiumMatch = text.match(/Podium (?:Vehicle|Car)[:\s-]+([A-Z][A-Za-z0-9 .'-]{2,40})/);

  return {
    summary: text.slice(0, 600),
    bonuses,
    podium: podiumMatch ? podiumMatch[1].trim() : undefined,
  };
}

export async function getWeeklyUpdate(): Promise<WeeklyUpdate> {
  let lastErr: unknown;
  for (const feed of FEED_URLS) {
    try {
      const feedHtml = await fetchText(feed, { accept: "text/html,*/*" });
      const articles = extractArticles(feedHtml);
      const picked = pickWeekly(articles);
      if (!picked) continue;
      let parsed: { summary: string; bonuses: string[]; podium?: string } = {
        summary: "",
        bonuses: [],
      };
      try {
        const articleHtml = await fetchText(picked.url, { accept: "text/html,*/*" });
        parsed = parseArticle(articleHtml);
      } catch (err) {
        console.error("[newswire] article fetch failed:", err);
      }
      return {
        title: picked.title,
        url: picked.url,
        summary: parsed.summary,
        bonuses: parsed.bonuses,
        podiumVehicle: parsed.podium,
        source: feed,
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("Newswire unavailable");
}
