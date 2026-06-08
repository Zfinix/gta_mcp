// Rockstar Newswire client for the weekly GTA Online event. The Newswire HTML is
// a JS shell, so we hit the persisted-query GraphQL API instead: list the GTA
// Online tag feed (tagId 702), find the active event post, then pull its full
// content for bonus lines and dates. Best-effort with graceful fallback.
import { fetchJson } from "../lib/http.js";

const GRAPH_URL = "https://graph.rockstargames.com/";
const GTA_ONLINE_TAG_ID = 702;
const EVENTS_TAG_ID = 13;
const LIST_HASH =
  "aef12205cdcce5be34d9a2aa5e118635df895336ea5ea87e73b6b5d8a18ccc1a";
const POST_HASH =
  "555658813abe5acc8010de1a1feddd6fd8fddffbdc35d3723d4dc0fe4ded6810";

export interface WeeklyUpdate {
  title: string;
  url: string;
  summary: string;
  bonuses: string[];
  podiumVehicle?: string;
  startDate?: string;
  endDate?: string;
  source: string;
}

interface ListResult {
  id: string;
  url: string;
  title: string;
}

interface NewswirePost {
  id: string;
  title: string;
  url?: string;
  secondary_tags?: { id: number; name: string }[] | null;
  tina?: { payload?: { template?: string } };
}

function isWeeklyEvent(post: NewswirePost): boolean {
  return (
    post.secondary_tags?.some((t) => t.id === EVENTS_TAG_ID) === true ||
    post.tina?.payload?.template === "event"
  );
}

function graphUrl(
  operationName: string,
  variables: Record<string, unknown>,
  hash: string,
): string {
  const params = new URLSearchParams({
    operationName,
    variables: JSON.stringify(variables),
    extensions: JSON.stringify({
      persistedQuery: { version: 1, sha256Hash: hash },
    }),
  });
  return `${GRAPH_URL}?${params.toString()}`;
}

async function fetchList(): Promise<ListResult[]> {
  const url = graphUrl(
    "NewswireList",
    {
      tagId: GTA_ONLINE_TAG_ID,
      page: 1,
      metaUrl: "/newswire",
      limit: 20,
      locale: "en_us",
    },
    LIST_HASH,
  );
  const res = await fetchJson<{ data?: { posts?: { results?: ListResult[] } } }>(
    url,
    { accept: "*/*" },
  );
  return res.data?.posts?.results ?? [];
}

async function fetchPost(idHash: string): Promise<NewswirePost | undefined> {
  const url = graphUrl(
    "NewswirePost",
    { locale: "en_us", id_hash: idHash },
    POST_HASH,
  );
  const res = await fetchJson<{ data?: { post?: NewswirePost } }>(url, {
    accept: "*/*",
  });
  return res.data?.post;
}

function absolute(url: string | undefined, id: string): string {
  if (!url) return `https://www.rockstargames.com/newswire/article/${id}`;
  if (url.startsWith("http")) return url;
  return `https://www.rockstargames.com${url}`;
}

/** Flatten the post JSON to plain text via its embedded HTML content blocks. */
function postToText(post: unknown): string {
  const json = JSON.stringify(post);
  const html: string[] = [];
  const re = /"content":"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(json))) html.push(m[1]);
  return html
    .join(" ")
    .replace(/\\u003C/gi, "<")
    .replace(/\\u003E/gi, ">")
    .replace(/\\u0026/g, "&")
    .replace(/\\n|\\r|\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function firstDate(
  post: unknown,
  key: "startDate" | "endDate",
): string | undefined {
  const m = JSON.stringify(post).match(new RegExp(`"${key}":"([^"]+)"`));
  return m ? m[1] : undefined;
}

function parseBonuses(text: string): string[] {
  const bonuses: string[] = [];
  const seen = new Set<string>();
  const bonusRe =
    /([A-Z][^.]{0,90}?(2X|3X|4X|Double|Triple|GTA\$ and RP|GTA\$\d)[^.]{0,90}?)\./g;
  let m: RegExpExecArray | null;
  while ((m = bonusRe.exec(text)) && bonuses.length < 15) {
    const line = m[1].trim();
    const key = line.toLowerCase();
    if (line.length > 8 && !seen.has(key)) {
      seen.add(key);
      bonuses.push(line);
    }
  }
  return bonuses;
}

function parsePodium(text: string): string | undefined {
  const m = text.match(
    /Podium (?:Vehicle|Car)[:\s-]+([A-Z][A-Za-z0-9 .'-]{2,40})/,
  );
  return m ? m[1].trim() : undefined;
}

export async function getWeeklyUpdate(): Promise<WeeklyUpdate> {
  const list = await fetchList();
  if (!list.length) throw new Error("Newswire returned no GTA Online posts");

  // Scan the newest posts for an event-template article (the weekly update),
  // falling back to the most recent GTA Online post if none is tagged event.
  let chosen: { post: NewswirePost; meta: ListResult } | undefined;
  let fallback: { post: NewswirePost; meta: ListResult } | undefined;

  for (const meta of list.slice(0, 6)) {
    let post: NewswirePost | undefined;
    try {
      post = await fetchPost(meta.id);
    } catch {
      continue;
    }
    if (!post) continue;
    if (!fallback) fallback = { post, meta };
    if (isWeeklyEvent(post)) {
      chosen = { post, meta };
      break;
    }
  }

  const picked = chosen ?? fallback;
  if (!picked) throw new Error("Could not load any GTA Online article");

  const fullText = postToText(picked.post);
  return {
    title: picked.post.title?.trim() || picked.meta.title,
    url: absolute(picked.post.url || picked.meta.url, picked.meta.id),
    summary: fullText.slice(0, 600),
    bonuses: parseBonuses(fullText),
    podiumVehicle: parsePodium(fullText),
    startDate: firstDate(picked.post, "startDate"),
    endDate: firstDate(picked.post, "endDate"),
    source: GRAPH_URL,
  };
}
