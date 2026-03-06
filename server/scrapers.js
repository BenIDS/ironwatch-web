const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
};

function stripTags(str) {
  return (str || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const PLANT_KEYWORDS = ['excavator','digger','jcb','caterpillar',' cat ','komatsu','volvo','hitachi','doosan','case','liebherr','terex','bobcat','backhoe','bulldozer','dozer','loader','crane','dumper','telehandler','roller','compactor','paver','forklift','grader','tracked','crawler','skid steer','mini digger','kubota','takeuchi','kobelco','hyundai'];

function isRelevant(title) {
  if (!title) return false;
  const t = title.toLowerCase();
  return PLANT_KEYWORDS.some(k => t.includes(k));
}

function scoreRelevance(title) {
  if (!title) return 50;
  const t = title.toLowerCase();
  let score = 50;
  if (t.includes('excavator') || t.includes('digger')) score += 20;
  if (t.includes('jcb') || t.includes('cat') || t.includes('komatsu') || t.includes('volvo') || t.includes('kubota') || t.includes('hitachi')) score += 15;
  if (t.match(/\b(20\d{2})\b/)) score += 5;
  if (t.match(/\d+\s*h(ours?|rs?)?\b/i)) score += 5;
  return Math.min(score, 99);
}

let idCounter = Date.now();
function nextId() { return ++idCounter; }

// ─── MASCUS ────────────────────────────────────────────────────────────────────
// Mascus UK serves real HTML with listings in a consistent format
// URL pattern confirmed: /construction/excavators, /construction/backhoe-loaders etc
async function scrapeMascus(keywords) {
  const listings = [];
  const urls = [
    'https://www.mascus.co.uk/construction/excavators',
    'https://www.mascus.co.uk/construction/backhoe-loaders',
    'https://www.mascus.co.uk/construction/wheel-loaders',
    'https://www.mascus.co.uk/construction/crawler-dozers',
    'https://www.mascus.co.uk/construction/cranes',
    'https://www.mascus.co.uk/construction/dumpers',
    'https://www.mascus.co.uk/construction/telehandlers',
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { ...HEADERS, 'Referer': 'https://www.mascus.co.uk/' },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) { console.log(`Mascus ${url}: HTTP ${res.status}`); continue; }
      const html = await res.text();

      // Mascus listing rows: each has class "listing-item" or similar
      // The listing data appears as: Title • Year • Hours • Location • Seller
      // Links follow pattern /[category]/[subcategory]/[id].html

      // Extract all internal listing links
      const linkRe = /href="(\/construction\/[^"]+\/[a-z0-9\-]+-[a-z0-9]+\.html)"/g;
      const titleRe = /class="[^"]*title[^"]*"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/g;

      // Try to extract structured data from JSON-LD
      const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
      if (jsonLdMatch) {
        for (const block of jsonLdMatch) {
          try {
            const data = JSON.parse(block.replace(/<script[^>]*>/, '').replace('</script>', ''));
            const items = Array.isArray(data) ? data : data['@graph'] || [data];
            for (const item of items) {
              if (item['@type'] === 'Product' || item['@type'] === 'Offer') {
                const title = item.name || '';
                if (!isRelevant(title)) continue;
                const price = item.offers?.price || item.price || 0;
                listings.push({
                  id: nextId(),
                  title: title.slice(0, 80),
                  platform: 'mascus',
                  price: parseInt(price) || 0,
                  location: item.location || 'UK',
                  lat: 52.5 + (Math.random() - 0.5) * 4,
                  lng: -1.5 + (Math.random() - 0.5) * 4,
                  endsAt: new Date(Date.now() + (48 + Math.random() * 240) * 3600000),
                  relevanceScore: scoreRelevance(title),
                  condition: 'Good', conditionScore: 3,
                  year: parseInt(title.match(/\b(20\d{2})\b/)?.[1]) || 2018,
                  hours: parseInt(title.match(/([\d,]+)\s*h/i)?.[1]?.replace(/,/g, '')) || null,
                  isNew: true, imageColor: '#1A3A6B',
                  listingUrl: item.url || url,
                  source: 'live',
                });
              }
            }
          } catch {}
        }
      }

      // HTML fallback: parse listing rows directly
      // Mascus rows look like: <li class="...listing-item...">...<a href="/construction/...">TITLE</a>...• YEAR • HOURS • LOCATION
      const rowRe = /<li[^>]*class="[^"]*listing[^"]*"[\s\S]*?<\/li>/g;
      let rowMatch;
      while ((rowMatch = rowRe.exec(html)) !== null) {
        const row = rowMatch[0];
        const linkMatch = row.match(/href="(\/[^"]+\.html)"/);
        const titleMatch = row.match(/<a[^>]+href="\/[^"]+\.html"[^>]*>([^<]{5,80})<\/a>/);
        if (!titleMatch) continue;
        const title = stripTags(titleMatch[1]);
        if (!isRelevant(title)) continue;

        const priceMatch = row.match(/£\s*([\d\s,]+)/);
        const yearMatch = row.match(/\b(20\d{2}|19\d{2})\b/);
        const hoursMatch = row.match(/([\d,]+)\s*h\b/i);
        const locationMatch = row.match(/([A-Z][a-zA-Z\s]+,\s*(?:UK|England|Scotland|Wales|Ireland))/);

        listings.push({
          id: nextId(),
          title: title.slice(0, 80),
          platform: 'mascus',
          price: priceMatch ? parseInt(priceMatch[1].replace(/[\s,]/g, '')) : 0,
          location: locationMatch ? locationMatch[1] : 'UK',
          lat: 52.5 + (Math.random() - 0.5) * 4,
          lng: -1.5 + (Math.random() - 0.5) * 4,
          endsAt: new Date(Date.now() + (48 + Math.random() * 240) * 3600000),
          relevanceScore: scoreRelevance(title),
          condition: 'Good', conditionScore: 3,
          year: yearMatch ? parseInt(yearMatch[1]) : 2018,
          hours: hoursMatch ? parseInt(hoursMatch[1].replace(/,/g, '')) : null,
          isNew: true, imageColor: '#1A3A6B',
          listingUrl: linkMatch ? 'https://www.mascus.co.uk' + linkMatch[1] : url,
          source: 'live',
        });
      }
    } catch (err) {
      console.error(`Mascus error (${url}):`, err.message);
    }
    await delay(1000);
  }

  console.log(`Mascus: found ${listings.length} listings`);
  return listings;
}

// ─── BIDSPOTTER ────────────────────────────────────────────────────────────────
// Confirmed URLs from search: /en-gb/search-excavator, /en-gb/for-sale/plant-and-machinery
// Lot data is in HTML with rich descriptions
async function scrapeBidspotter(keywords) {
  const listings = [];
  const urls = [
    'https://www.bidspotter.co.uk/en-gb/search-excavator',
    'https://www.bidspotter.co.uk/en-gb/search-mini-excavator',
    'https://www.bidspotter.co.uk/en-gb/for-sale/plant-and-machinery',
    'https://www.bidspotter.co.uk/en-gb/for-sale/plant-and-machinery/dumpers',
    'https://www.bidspotter.co.uk/en-gb/for-sale/plant-and-machinery/telehandlers',
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { ...HEADERS, 'Referer': 'https://www.bidspotter.co.uk/' },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) { console.log(`Bidspotter ${url}: HTTP ${res.status}`); continue; }
      const html = await res.text();

      // Bidspotter lots: each lot has a title and a link to /en-gb/auction-catalogues/.../lot-id
      // From search results we can see titles like "2019 Kobelco SK140SRLC-5...", "2017 CAT 303E CR..."
      // Links follow: href="/en-gb/auction-catalogues/[auctioneer]/catalogue-id-[id]/lot-id-[n]"

      const lotRe = /href="(\/en-gb\/auction-catalogues\/[^"]+\/lot-id-\d+)"[^>]*>[\s\S]{0,600}?(?=href="\/en-gb\/auction-catalogues|$)/g;
      let m;
      while ((m = lotRe.exec(html)) !== null) {
        const path = m[1];
        const block = m[0];

        // Extract title — Bidspotter shows it in <h3> or as link text
        const titleMatch = block.match(/<h[23][^>]*>([\s\S]{3,100}?)<\/h[23]>/) ||
                           block.match(/title="([^"]{5,100})"/) ||
                           block.match(/>([A-Z0-9][^<]{10,80})</);
        if (!titleMatch) continue;
        const title = stripTags(titleMatch[1]).replace(/\s+/g, ' ').trim();
        if (!isRelevant(title)) continue;

        const priceMatch = block.match(/£\s*([\d,]+)/);
        const yearMatch = title.match(/\b(20\d{2})\b/);
        const hoursMatch = title.match(/([\d,]+)\s*(?:hours?|hrs?|h\b)/i) ||
                           block.match(/Hours?:?\s*([\d,]+)/i);

        listings.push({
          id: nextId(),
          title: title.slice(0, 80),
          platform: 'bidspotter',
          price: priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0,
          location: 'UK',
          lat: 52.5 + (Math.random() - 0.5) * 4,
          lng: -1.5 + (Math.random() - 0.5) * 4,
          endsAt: new Date(Date.now() + (24 + Math.random() * 120) * 3600000),
          relevanceScore: scoreRelevance(title),
          condition: 'Good', conditionScore: 3,
          year: yearMatch ? parseInt(yearMatch[1]) : 2018,
          hours: hoursMatch ? parseInt(hoursMatch[1].replace(/,/g, '')) : null,
          isNew: true, imageColor: '#E8500A',
          listingUrl: 'https://www.bidspotter.co.uk' + path,
          source: 'live',
        });

        if (listings.length >= 40) break;
      }

      // Also try plain text extraction from the search results page
      // The search pages show lot descriptions directly in the HTML
      const descRe = /(\d{4}\s+(?:JCB|CAT|Caterpillar|Komatsu|Kubota|Hitachi|Kobelco|Volvo|Case|Doosan|Terex|Bobcat|Liebherr|Takeuchi|Yanmar|Hyundai)[^<\n]{10,100})/g;
      let dm;
      while ((dm = descRe.exec(html)) !== null) {
        const title = dm[1].trim().replace(/\s+/g, ' ');
        if (listings.some(l => l.title.includes(title.slice(0, 20)))) continue;

        const yearMatch = title.match(/\b(20\d{2})\b/);
        const hoursMatch = title.match(/([\d,]+)\s*(?:hours?|hrs?|h\b)/i);

        listings.push({
          id: nextId(),
          title: title.slice(0, 80),
          platform: 'bidspotter',
          price: 0,
          location: 'UK',
          lat: 52.5 + (Math.random() - 0.5) * 4,
          lng: -1.5 + (Math.random() - 0.5) * 4,
          endsAt: new Date(Date.now() + (24 + Math.random() * 120) * 3600000),
          relevanceScore: scoreRelevance(title),
          condition: 'Good', conditionScore: 3,
          year: yearMatch ? parseInt(yearMatch[1]) : 2018,
          hours: hoursMatch ? parseInt(hoursMatch[1].replace(/,/g, '')) : null,
          isNew: true, imageColor: '#E8500A',
          listingUrl: url,
          source: 'live',
        });
      }

    } catch (err) {
      console.error(`Bidspotter error (${url}):`, err.message);
    }
    await delay(1500);
  }

  console.log(`Bidspotter: found ${listings.length} listings`);
  return listings;
}

// ─── EURO AUCTIONS ─────────────────────────────────────────────────────────────
// Correct domain is euroauctions.com — their lot search uses /lots/ path
async function scrapeEuroAuctions(keywords) {
  const listings = [];
  const urls = [
    'https://www.euroauctions.com/lots/?category=excavators',
    'https://www.euroauctions.com/lots/?category=plant-machinery',
    'https://www.euroauctions.com/lots/?q=excavator',
    'https://www.euroauctions.com/lots/?q=jcb',
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { ...HEADERS, 'Referer': 'https://www.euroauctions.com/' },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) { console.log(`Euro Auctions ${url}: HTTP ${res.status}`); continue; }
      const html = await res.text();

      // Try JSON-LD first
      const jsonMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
      for (const block of jsonMatches) {
        try {
          const json = JSON.parse(block.replace(/<script[^>]*>/, '').replace('</script>', '').trim());
          const items = json['@graph'] || (Array.isArray(json) ? json : [json]);
          for (const item of items) {
            if (!item.name) continue;
            const title = item.name;
            if (!isRelevant(title)) continue;
            listings.push({
              id: nextId(),
              title: title.slice(0, 80),
              platform: 'euroauctions',
              price: parseInt(item.offers?.price || item.price || 0) || 0,
              location: item.location || 'UK',
              lat: 52.5 + (Math.random() - 0.5) * 4,
              lng: -1.5 + (Math.random() - 0.5) * 4,
              endsAt: item.endDate ? new Date(item.endDate) : new Date(Date.now() + (48 + Math.random() * 96) * 3600000),
              relevanceScore: scoreRelevance(title),
              condition: 'Good', conditionScore: 3,
              year: parseInt(title.match(/\b(20\d{2})\b/)?.[1]) || 2018,
              hours: null, isNew: true, imageColor: '#0057B8',
              listingUrl: item.url || 'https://www.euroauctions.com',
              source: 'live',
            });
          }
        } catch {}
      }

      // HTML fallback — extract lot cards
      const cardRe = /<(?:div|article)[^>]*class="[^"]*(?:lot|item|card)[^"]*"[\s\S]*?<\/(?:div|article)>/g;
      let cm;
      while ((cm = cardRe.exec(html)) !== null) {
        const block = cm[0];
        const titleMatch = block.match(/<h[1-4][^>]*>([\s\S]{5,100}?)<\/h[1-4]>/);
        if (!titleMatch) continue;
        const title = stripTags(titleMatch[1]);
        if (!isRelevant(title)) continue;

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
          endsAt: new Date(Date.now() + (48 + Math.random() * 96) * 3600000),
          relevanceScore: scoreRelevance(title),
          condition: 'Good', conditionScore: 3,
          year: parseInt(title.match(/\b(20\d{2})\b/)?.[1]) || 2018,
          hours: null, isNew: true, imageColor: '#0057B8',
          listingUrl: linkMatch ? (linkMatch[1].startsWith('http') ? linkMatch[1] : 'https://www.euroauctions.com' + linkMatch[1]) : 'https://www.euroauctions.com',
          source: 'live',
        });
      }

    } catch (err) {
      console.error(`Euro Auctions error (${url}):`, err.message);
    }
    await delay(1500);
  }

  console.log(`Euro Auctions: found ${listings.length} listings`);
  return listings;
}

// ─── RITCHIE BROS ──────────────────────────────────────────────────────────────
// rbauction.com — try their search with UK filter
async function scrapeRitchieBros(keywords) {
  const listings = [];

  // Try their IronPlanet UK search which is more accessible
  const urls = [
    'https://www.ironplanet.com/uk',
    'https://www.rbauction.com/heavy-equipment?q=excavator&loc=GBR',
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          ...HEADERS,
          'Referer': 'https://www.google.com/',
          'sec-ch-ua': '"Chromium";v="122"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
        },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) { console.log(`Ritchie/IronPlanet ${url}: HTTP ${res.status}`); continue; }
      const html = await res.text();

      // Try __NEXT_DATA__ or __INITIAL_STATE__ embedded JSON
      const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextData) {
        try {
          const data = JSON.parse(nextData[1]);
          const items = data?.props?.pageProps?.items ||
                        data?.props?.pageProps?.results ||
                        data?.props?.pageProps?.listings || [];
          for (const item of items.slice(0, 20)) {
            const title = item.title || item.name || item.description || '';
            if (!isRelevant(title)) continue;
            listings.push({
              id: nextId(),
              title: title.slice(0, 80),
              platform: 'ritchie',
              price: Math.round((item.price || item.currentBid || 0) * 0.79),
              location: item.location || item.city || 'UK',
              lat: 52.5 + (Math.random() - 0.5) * 4,
              lng: -1.5 + (Math.random() - 0.5) * 4,
              endsAt: item.auctionDate ? new Date(item.auctionDate) : new Date(Date.now() + 72 * 3600000),
              relevanceScore: scoreRelevance(title),
              condition: 'Good', conditionScore: 3,
              year: item.year || parseInt(title.match(/\b(20\d{2})\b/)?.[1]) || 2018,
              hours: item.hours || null,
              isNew: true, imageColor: '#00843D',
              listingUrl: item.url ? 'https://www.rbauction.com' + item.url : 'https://www.rbauction.com',
              source: 'live',
            });
          }
        } catch {}
      }

      // HTML fallback
      const titleRe = /(\d{4}\s+(?:Cat|Caterpillar|Komatsu|Volvo|Hitachi|Case|JCB|Doosan|Liebherr|John Deere|Bobcat)[^\n<]{10,80})/g;
      let tm;
      while ((tm = titleRe.exec(html)) !== null) {
        const title = tm[1].trim().replace(/\s+/g, ' ');
        if (listings.some(l => l.title.includes(title.slice(0, 15)))) continue;
        listings.push({
          id: nextId(),
          title: title.slice(0, 80),
          platform: 'ritchie',
          price: 0,
          location: 'UK',
          lat: 52.5 + (Math.random() - 0.5) * 4,
          lng: -1.5 + (Math.random() - 0.5) * 4,
          endsAt: new Date(Date.now() + (48 + Math.random() * 96) * 3600000),
          relevanceScore: scoreRelevance(title),
          condition: 'Good', conditionScore: 3,
          year: parseInt(title.match(/\b(20\d{2})\b/)?.[1]) || 2018,
          hours: null, isNew: true, imageColor: '#00843D',
          listingUrl: url,
          source: 'live',
        });
      }

    } catch (err) {
      console.error(`Ritchie Bros error (${url}):`, err.message);
    }
    await delay(2000);
  }

  console.log(`Ritchie Bros: found ${listings.length} listings`);
  return listings;
}

// ─── CACHE ─────────────────────────────────────────────────────────────────────
let cachedListings = [];
let lastScrapeTime = 0;
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

// ─── MAIN ─────────────────────────────────────────────────────────────────────
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
    .filter(l => l.title && l.title.length > 5);

  // Deduplicate
  const seen = new Set();
  const deduped = allListings.filter(l => {
    const key = l.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 25);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

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
