const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// ─── SHARED HELPERS ────────────────────────────────────────────────────────────

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

// Simple HTML text extractor — avoids needing cheerio
function extractText(html, start, end) {
  const si = html.indexOf(start);
  if (si === -1) return '';
  const ei = html.indexOf(end, si + start.length);
  if (ei === -1) return '';
  return html.slice(si + start.length, ei).replace(/<[^>]+>/g, '').trim();
}

function extractAll(html, pattern) {
  const results = [];
  const regex = new RegExp(pattern, 'gs');
  let m;
  while ((m = regex.exec(html)) !== null) results.push(m);
  return results;
}

function stripTags(str) {
  return str.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

let idCounter = Date.now();
function nextId() { return ++idCounter; }

// Keywords that match plant & machinery
const PLANT_KEYWORDS = [
  'excavator', 'digger', 'jcb', 'caterpillar', 'cat', 'komatsu', 'volvo', 'hitachi',
  'doosan', 'case', 'liebherr', 'terex', 'bobcat', 'backhoe', 'bulldozer', 'dozer',
  'loader', 'crane', 'dumper', 'telehandler', 'roller', 'compactor', 'paver',
  'plant', 'machinery', 'forklift', 'grader', 'scraper', 'drill', 'piling',
  'tracked', 'crawler', 'wheeled', 'skid steer', 'mini digger'
];

function isRelevant(title) {
  if (!title) return false;
  const t = title.toLowerCase();
  return PLANT_KEYWORDS.some(k => t.includes(k));
}

function scoreRelevance(title) {
  if (!title) return 50;
  const t = title.toLowerCase();
  let score = 50;
  if (t.includes('excavator') || t.includes('digger')) score += 25;
  if (t.includes('jcb') || t.includes('cat') || t.includes('komatsu') || t.includes('volvo')) score += 15;
  if (t.includes('uk') || t.includes('england') || t.includes('britain')) score += 10;
  if (t.match(/\d{4}/)) score += 5; // has year
  if (t.match(/\d+h\b/)) score += 5; // has hours
  return Math.min(score, 99);
}

// ─── MASCUS SCRAPER ────────────────────────────────────────────────────────────
// Mascus serves real HTML — most reliable of the four

async function scrapeMascus(keywords) {
  const listings = [];
  const categories = [
    'https://www.mascus.co.uk/construction/excavators',
    'https://www.mascus.co.uk/construction/backhoe-loaders',
    'https://www.mascus.co.uk/construction/wheel-loaders',
    'https://www.mascus.co.uk/construction/crawler-dozers',
    'https://www.mascus.co.uk/construction/cranes',
  ];

  for (const url of categories) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      const html = await res.text();

      // Extract listing blocks — Mascus wraps each in <div class="listing-item"> or similar
      // Match listing rows by their link pattern
      const linkMatches = extractAll(
        html,
        /href="(\/[a-z0-9\-]+\/[a-z0-9\-]+\/[a-z0-9\-]+-[a-z0-9]+\.html)"[^>]*>[\s\S]{0,400}?<\/a>/
      );

      for (const m of linkMatches.slice(0, 20)) {
        const block = m[0];
        const path = m[1];
        if (!path || path.includes('search') || path.includes('category')) continue;

        const title = stripTags(block.match(/title="([^"]+)"/)?.[1] || block.match(/alt="([^"]+)"/)?.[1] || '');
        if (!title || !isRelevant(title)) continue;

        // Extract price
        const priceMatch = block.match(/£\s*([\d,]+)/);
        const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0;

        // Extract year
        const yearMatch = title.match(/\b(20\d{2}|19\d{2})\b/) || block.match(/\b(20\d{2}|19\d{2})\b/);
        const year = yearMatch ? parseInt(yearMatch[1]) : null;

        // Extract hours
        const hoursMatch = block.match(/([\d,]+)\s*h\b/i);
        const hours = hoursMatch ? parseInt(hoursMatch[1].replace(/,/g, '')) : null;

        // Extract location
        const locationMatch = block.match(/([A-Z][a-zA-Z\s]+,\s*UK)/);
        const location = locationMatch ? locationMatch[1] : 'UK';

        listings.push({
          id: nextId(),
          title: title.replace(/\s+/g, ' ').slice(0, 80),
          platform: 'mascus',
          price,
          location,
          lat: 52.5 + (Math.random() - 0.5) * 4,
          lng: -1.5 + (Math.random() - 0.5) * 4,
          endsAt: new Date(Date.now() + (24 + Math.random() * 120) * 3600000),
          relevanceScore: scoreRelevance(title),
          condition: 'Good',
          conditionScore: 3,
          year: year || 2018,
          hours: hours || Math.floor(Math.random() * 8000 + 500),
          isNew: true,
          imageColor: '#1A3A6B',
          listingUrl: 'https://www.mascus.co.uk' + path,
          source: 'live',
        });
      }
    } catch (err) {
      console.error(`Mascus scrape error (${url}):`, err.message);
    }
    await delay(1500);
  }

  return listings;
}

// ─── BIDSPOTTER SCRAPER ────────────────────────────────────────────────────────
// Bidspotter has a search API endpoint we can hit directly

async function scrapeBidspotter(keywords) {
  const listings = [];

  const searchTerms = keywords.length > 0 ? keywords : ['excavator', 'plant machinery', 'loader', 'crane'];

  for (const term of searchTerms.slice(0, 3)) {
    try {
      const searchUrl = `https://www.bidspotter.co.uk/en-gb/for-sale?q=${encodeURIComponent(term)}&category=plant-and-machinery`;
      const res = await fetch(searchUrl, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      const html = await res.text();

      // Bidspotter listing cards have identifiable patterns
      const cardMatches = extractAll(
        html,
        /<article[^>]*class="[^"]*lot[^"]*"[\s\S]*?<\/article>/
      );

      for (const m of cardMatches.slice(0, 15)) {
        const block = m[0];

        const titleMatch = block.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/);
        const title = titleMatch ? stripTags(titleMatch[1]) : '';
        if (!title || !isRelevant(title)) continue;

        const linkMatch = block.match(/href="([^"]+\/lots\/[^"]+)"/);
        const listingUrl = linkMatch ? 'https://www.bidspotter.co.uk' + linkMatch[1] : 'https://www.bidspotter.co.uk';

        const priceMatch = block.match(/£\s*([\d,]+)/);
        const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0;

        const dateMatch = block.match(/(\d{1,2}\s+\w+\s+\d{4})/);
        const endsAt = dateMatch ? new Date(dateMatch[1]) : new Date(Date.now() + 48 * 3600000);

        listings.push({
          id: nextId(),
          title: title.slice(0, 80),
          platform: 'bidspotter',
          price,
          location: 'UK',
          lat: 52.5 + (Math.random() - 0.5) * 4,
          lng: -1.5 + (Math.random() - 0.5) * 4,
          endsAt: isNaN(endsAt) ? new Date(Date.now() + 48 * 3600000) : endsAt,
          relevanceScore: scoreRelevance(title),
          condition: 'Good',
          conditionScore: 3,
          year: parseInt(title.match(/\b(20\d{2})\b/)?.[1]) || 2018,
          hours: null,
          isNew: true,
          imageColor: '#E8500A',
          listingUrl,
          source: 'live',
        });
      }
    } catch (err) {
      console.error(`Bidspotter scrape error:`, err.message);
    }
    await delay(2000);
  }

  return listings;
}

// ─── EURO AUCTIONS SCRAPER ────────────────────────────────────────────────────
// Euro Auctions has a simpler site structure

async function scrapeEuroAuctions(keywords) {
  const listings = [];

  try {
    const url = 'https://www.euroauctions.com/lots/?q=excavator+loader+plant&country=GB';
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const cardMatches = extractAll(
      html,
      /<div[^>]*class="[^"]*lot[^"]*"[\s\S]*?(?=<div[^>]*class="[^"]*lot[^"]*"|$)/
    );

    for (const m of cardMatches.slice(0, 20)) {
      const block = m[0];
      const titleMatch = block.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/);
      const title = titleMatch ? stripTags(titleMatch[1]) : '';
      if (!title || !isRelevant(title)) continue;

      const linkMatch = block.match(/href="([^"]+)"/);
      const priceMatch = block.match(/£\s*([\d,]+)/);

      listings.push({
        id: nextId(),
        title: title.slice(0, 80),
        platform: 'euroauctions',
        price: priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0,
        location: 'UK',
        lat: 52.5 + (Math.random() - 0.5) * 4,
        lng: -1.5 + (Math.random() - 0.5) * 4,
        endsAt: new Date(Date.now() + (24 + Math.random() * 96) * 3600000),
        relevanceScore: scoreRelevance(title),
        condition: 'Good',
        conditionScore: 3,
        year: parseInt(title.match(/\b(20\d{2})\b/)?.[1]) || 2018,
        hours: null,
        isNew: true,
        imageColor: '#0057B8',
        listingUrl: linkMatch ? (linkMatch[1].startsWith('http') ? linkMatch[1] : 'https://www.euroauctions.com' + linkMatch[1]) : 'https://www.euroauctions.com',
        source: 'live',
      });
    }
  } catch (err) {
    console.error('Euro Auctions scrape error:', err.message);
  }

  return listings;
}

// ─── RITCHIE BROS SCRAPER ──────────────────────────────────────────────────────
// Ritchie Bros has a public search page we can parse

async function scrapeRitchieBros(keywords) {
  const listings = [];

  const searchTerms = keywords.length > 0 ? keywords.slice(0, 2) : ['excavator', 'wheel loader'];

  for (const term of searchTerms) {
    try {
      const url = `https://www.rbauction.com/heavy-equipment?q=${encodeURIComponent(term)}&loc=GBR`;
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      const html = await res.text();

      // Look for JSON-LD or embedded data objects in the page
      const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          const items = data?.search?.results?.items || data?.items || [];
          for (const item of items.slice(0, 15)) {
            const title = item.title || item.name || item.description || '';
            if (!isRelevant(title)) continue;
            listings.push({
              id: nextId(),
              title: title.slice(0, 80),
              platform: 'ritchie',
              price: item.price || item.currentBid || 0,
              location: item.location || item.city || 'UK',
              lat: 52.5 + (Math.random() - 0.5) * 4,
              lng: -1.5 + (Math.random() - 0.5) * 4,
              endsAt: item.auctionDate ? new Date(item.auctionDate) : new Date(Date.now() + 72 * 3600000),
              relevanceScore: scoreRelevance(title),
              condition: 'Good',
              conditionScore: 3,
              year: item.year || parseInt(title.match(/\b(20\d{2})\b/)?.[1]) || 2018,
              hours: item.hours || null,
              isNew: true,
              imageColor: '#00843D',
              listingUrl: item.url ? 'https://www.rbauction.com' + item.url : 'https://www.rbauction.com',
              source: 'live',
            });
          }
          continue;
        } catch (e) { /* fall through to HTML parse */ }
      }

      // HTML fallback — parse listing cards
      const cardMatches = extractAll(
        html,
        /<div[^>]*data-testid="[^"]*item[^"]*"[\s\S]*?(?=<div[^>]*data-testid="[^"]*item[^"]*"|$)/
      );

      for (const m of cardMatches.slice(0, 15)) {
        const block = m[0];
        const titleMatch = block.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/);
        const title = titleMatch ? stripTags(titleMatch[1]) : '';
        if (!title || !isRelevant(title)) continue;

        const priceMatch = block.match(/\$\s*([\d,]+)/);
        const linkMatch = block.match(/href="([^"]+)"/);

        listings.push({
          id: nextId(),
          title: title.slice(0, 80),
          platform: 'ritchie',
          price: priceMatch ? Math.round(parseInt(priceMatch[1].replace(/,/g, '')) * 0.79) : 0, // USD→GBP approx
          location: 'UK',
          lat: 52.5 + (Math.random() - 0.5) * 4,
          lng: -1.5 + (Math.random() - 0.5) * 4,
          endsAt: new Date(Date.now() + (24 + Math.random() * 96) * 3600000),
          relevanceScore: scoreRelevance(title),
          condition: 'Good',
          conditionScore: 3,
          year: parseInt(title.match(/\b(20\d{2})\b/)?.[1]) || 2018,
          hours: null,
          isNew: true,
          imageColor: '#00843D',
          listingUrl: linkMatch ? 'https://www.rbauction.com' + linkMatch[1] : 'https://www.rbauction.com',
          source: 'live',
        });
      }
    } catch (err) {
      console.error(`Ritchie Bros scrape error:`, err.message);
    }
    await delay(2000);
  }

  return listings;
}

// ─── DELAY HELPER ─────────────────────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── CACHE ─────────────────────────────────────────────────────────────────────
let cachedListings = [];
let lastScrapeTime = 0;
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
async function scrapeAll(keywords = [], forceRefresh = false) {
  const now = Date.now();

  if (!forceRefresh && cachedListings.length > 0 && (now - lastScrapeTime) < CACHE_TTL) {
    console.log(`Returning ${cachedListings.length} cached listings`);
    return { listings: cachedListings, fromCache: true, lastUpdated: new Date(lastScrapeTime) };
  }

  console.log('Starting scrape of all platforms...');
  const results = await Promise.allSettled([
    scrapeMascus(keywords),
    scrapeBidspotter(keywords),
    scrapeEuroAuctions(keywords),
    scrapeRitchieBros(keywords),
  ]);

  const allListings = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .filter(l => l.title && l.title.length > 3);

  // Deduplicate by title similarity
  const seen = new Set();
  const deduped = allListings.filter(l => {
    const key = l.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by relevance
  deduped.sort((a, b) => b.relevanceScore - a.relevanceScore);

  const perPlatform = {
    mascus: results[0].status === 'fulfilled' ? results[0].value.length : 0,
    bidspotter: results[1].status === 'fulfilled' ? results[1].value.length : 0,
    euroauctions: results[2].status === 'fulfilled' ? results[2].value.length : 0,
    ritchie: results[3].status === 'fulfilled' ? results[3].value.length : 0,
  };

  console.log(`Scrape complete. Found: ${JSON.stringify(perPlatform)}. Total: ${deduped.length}`);

  if (deduped.length > 0) {
    cachedListings = deduped;
    lastScrapeTime = now;
  }

  return {
    listings: deduped.length > 0 ? deduped : cachedListings,
    fromCache: false,
    lastUpdated: new Date(now),
    perPlatform,
  };
}

module.exports = { scrapeAll };
