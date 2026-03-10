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

// ─── BIDSPOTTER (direct API — no login, no Apify) ─────────────────────────────
// Uses three undocumented JSON endpoints discovered via browser DevTools:
//
//  1. GET  /en-gb/auction-catalogues/[auctioneer]/[catalogue-id]
//          → HTML page containing lot UUIDs and titles in embedded JSON
//
//  2. POST /en-gb/lots-images?take=N&skip=0&imageSize=400
//          Body: { lotIds: [...uuids] }
//          → { [lotId]: [imageUrls] }
//
//  3. GET  /en-gb/lot/reload-timed-bid-info?v=1.3.0.1&c=catalogue&fullReload=true&count=N
//          Referer: catalogue page URL
//          → [{ Model: { LotId, LeadingBid, Reserve, ReserveMet, EndTimeUtc, TotalBids } }]
//
// The catalogue list is discovered by scraping the Bidspotter plant/machinery
// search results page which lists active auctions with their catalogue URLs.

const BS_BASE = 'https://www.bidspotter.co.uk';
const BS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

function parseMsDate(val) {
  // Parses "/Date(1773171480000)/" format
  if (!val) return null;
  const m = String(val).match(/\/Date\((\d+)\)\//);
  return m ? new Date(parseInt(m[1])) : null;
}

async function bsFetchCatalogueUrls() {
  // Discover active UK plant & machinery catalogues from search page
  const searchUrl = `${BS_BASE}/en-gb/for-sale/plant-and-machinery`;
  try {
    const res = await fetch(searchUrl, {
      headers: { ...BS_HEADERS, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) { console.log(`Bidspotter catalogue discovery: HTTP ${res.status}`); return []; }
    const html = await res.text();

    // Catalogue URLs appear as href="/en-gb/auction-catalogues/[auctioneer]/catalogue-id-[id]"
    const re = /href="(\/en-gb\/auction-catalogues\/[^/]+\/catalogue-id-[^"]+)"/g;
    const found = new Set();
    let m;
    while ((m = re.exec(html)) !== null) found.add(m[1]);
    const urls = [...found].map(p => `${BS_BASE}${p}`);
    console.log(`Bidspotter: discovered ${urls.length} catalogues from search page`);
    return urls;
  } catch (err) {
    console.error('Bidspotter catalogue discovery error:', err.message);
    return [];
  }
}

async function bsFetchLotsFromCatalogue(catalogueUrl) {
  // Returns array of { lotId, title, lotNumber, lotUrl } extracted from catalogue HTML
  const lots = [];
  try {
    const res = await fetch(catalogueUrl, {
      headers: {
        ...BS_HEADERS,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': `${BS_BASE}/en-gb/for-sale/plant-and-machinery`,
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) { console.log(`Bidspotter catalogue ${catalogueUrl}: HTTP ${res.status}`); return lots; }
    const html = await res.text();

    // Lot UUIDs are embedded in the page as data-lot-id="[uuid]" or similar attributes
    // Also appear in lot anchor hrefs: /lot-[uuid]  or  href="...lot-[uuid]"
    const lotIdRe = /["\s](?:data-lot-id|data-id)="([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/gi;
    // Also pick up UUIDs from lot anchor hrefs
    const hrefLotRe = /href="(\/en-gb\/auction-catalogues\/[^"]+\/lot-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))"/gi;

    const seen = new Set();

    let m;
    while ((m = lotIdRe.exec(html)) !== null) {
      const lotId = m[1].toLowerCase();
      if (!seen.has(lotId)) { seen.add(lotId); lots.push({ lotId, lotUrl: `${catalogueUrl}`, title: '' }); }
    }
    while ((m = hrefLotRe.exec(html)) !== null) {
      const lotId = m[2].toLowerCase();
      const lotUrl = `${BS_BASE}${m[1]}`;
      if (!seen.has(lotId)) {
        seen.add(lotId);
        lots.push({ lotId, lotUrl, title: '' });
      } else {
        // Update URL if we already have the lot
        const existing = lots.find(l => l.lotId === lotId);
        if (existing) existing.lotUrl = lotUrl;
      }
    }

    // Extract titles — lot titles appear in aria-label, title attr, or heading tags near each lot
    // Pattern: data-lot-id="[uuid]"...>TITLE</  — grab the nearest h2/h3/strong/span after each UUID
    // Simpler: extract all lot title text blocks from the page using lot number + title pattern
    // Bidspotter renders: <span class="lot-number">123</span> ... <span class="lot-title">2018 JCB...</span>
    const titleBlockRe = /<[^>]+class="[^"]*lot[^"]*title[^"]*"[^>]*>\s*([^<]{5,120})\s*</gi;
    const titleList = [];
    while ((m = titleBlockRe.exec(html)) !== null) {
      const t = stripTags(m[1]).trim().replace(/\s+/g, ' ');
      if (t.length > 5) titleList.push(t);
    }

    // Also try: <h2 class="...">...</h2> or <h3> within lot cards
    const headingRe = /<h[23][^>]*class="[^"]*lot[^"]*"[^>]*>\s*([^<]{5,120})\s*<\/h[23]>/gi;
    while ((m = headingRe.exec(html)) !== null) {
      const t = stripTags(m[1]).trim().replace(/\s+/g, ' ');
      if (t.length > 5) titleList.push(t);
    }

    // Match titles to lots by position (title[i] → lot[i]) — best effort
    lots.forEach((lot, i) => {
      if (titleList[i]) lot.title = titleList[i];
    });

    // Fallback title extraction: grab ALL text that looks like a plant machinery title
    // from the full HTML, ordered as they appear on the page
    if (titleList.length === 0) {
      const BRANDS = 'JCB|CAT|Caterpillar|Komatsu|Kubota|Hitachi|Kobelco|Volvo|Case|Doosan|Terex|Bobcat|Liebherr|Takeuchi|Thwaites|Manitou|Merlo|Hyundai|Yanmar|Avant|Sany';
      const machineRe = new RegExp(`((?:20\\d{2}|19\\d{2})\\s+(?:${BRANDS})[^<\\n]{5,100})`, 'gi');
      const fallbackTitles = [];
      while ((m = machineRe.exec(html)) !== null) {
        const t = stripTags(m[1]).trim().replace(/\s+/g, ' ');
        if (t.length > 8) fallbackTitles.push(t);
      }
      lots.forEach((lot, i) => {
        if (fallbackTitles[i]) lot.title = fallbackTitles[i];
      });
    }

    console.log(`Bidspotter: catalogue ${catalogueUrl.split('/').slice(-1)[0]} → ${lots.length} lots`);
  } catch (err) {
    console.error(`Bidspotter lots error (${catalogueUrl}):`, err.message);
  }
  return lots;
}

async function bsFetchBidData(catalogueUrl, lotCount) {
  // GET reload-timed-bid-info with Referer = catalogue URL
  // Returns map of { [lotId]: Model }
  const bidMap = {};
  try {
    const url = `${BS_BASE}/en-gb/lot/reload-timed-bid-info?v=1.3.0.1&c=catalogue&fullReload=true&count=${lotCount}`;
    const res = await fetch(url, {
      headers: {
        ...BS_HEADERS,
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Referer': catalogueUrl,
        'X-Requested-With': 'XMLHttpRequest',
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) { console.log(`Bidspotter bid-info: HTTP ${res.status}`); return bidMap; }
    const data = await res.json();
    if (!Array.isArray(data)) return bidMap;
    for (const entry of data) {
      const m = entry?.Model;
      if (m?.LotId) bidMap[m.LotId.toLowerCase()] = m;
    }
    console.log(`Bidspotter: got bid data for ${Object.keys(bidMap).length} lots`);
  } catch (err) {
    console.error('Bidspotter bid-info error:', err.message);
  }
  return bidMap;
}

async function bsFetchImages(lotIds) {
  // POST /en-gb/lots-images with array of lot IDs
  // Returns { [lotId]: [imageUrl, ...] }
  const imageMap = {};
  if (!lotIds.length) return imageMap;
  try {
    const res = await fetch(`${BS_BASE}/en-gb/lots-images?take=${lotIds.length}&skip=0&imageSize=400`, {
      method: 'POST',
      headers: {
        ...BS_HEADERS,
        'Accept': '*/*',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(lotIds),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) { console.log(`Bidspotter images: HTTP ${res.status}`); return imageMap; }
    const data = await res.json();
    // Response is { [lotId]: [url, ...] }
    for (const [k, v] of Object.entries(data || {})) {
      imageMap[k.toLowerCase()] = Array.isArray(v) ? v : [v];
    }
  } catch (err) {
    console.error('Bidspotter images error:', err.message);
  }
  return imageMap;
}

async function scrapeBidspotter(keywords) {
  const listings = [];

  // Step 1: discover active catalogue URLs
  let catalogueUrls = await bsFetchCatalogueUrls();

  // Always include known-good catalogues as fallback seeds
  const knownCatalogues = [
    `${BS_BASE}/en-gb/auction-catalogues/universal-auctions/catalogue-id-univer10284`,
    `${BS_BASE}/en-gb/auction-catalogues/eamagroup/catalogue-id-eama-g11181`,
    `${BS_BASE}/en-gb/auction-catalogues/dunnbros/catalogue-id-dunn-b10036`,
    `${BS_BASE}/en-gb/auction-catalogues/cambridgeshire-auctions/catalogue-id-camauc10096`,
  ];
  for (const u of knownCatalogues) {
    if (!catalogueUrls.includes(u)) catalogueUrls.push(u);
  }

  // Limit to first 6 catalogues to keep response time reasonable
  catalogueUrls = catalogueUrls.slice(0, 6);
  console.log(`Bidspotter: processing ${catalogueUrls.length} catalogues`);

  for (const catalogueUrl of catalogueUrls) {
    try {
      // Step 2: extract lot IDs and titles from catalogue HTML
      const lots = await bsFetchLotsFromCatalogue(catalogueUrl);
      if (!lots.length) { await delay(1000); continue; }

      const lotIds = lots.map(l => l.lotId);

      // Steps 3 & 4: fetch bid data and images in parallel
      const [bidMap, imageMap] = await Promise.all([
        bsFetchBidData(catalogueUrl, lots.length),
        bsFetchImages(lotIds),
      ]);

      for (const lot of lots) {
        const bid = bidMap[lot.lotId];
        // Skip closed lots
        if (bid?.IsBiddingClosed || bid?.LotClosed) continue;

        // Use bid data title if we don't have one from HTML
        let title = lot.title || '';

        // Clean title: strip HTML artifacts, cut at structured fields
        title = stripTags(title)
          .replace(/\s*(Make\s*[:/]|Model\s*[:/]|Year of Manufacture|Key Features|Hours Showing|data-src|https?:).*$/i, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 100);

        if (!title || title.length < 8 || !isRelevant(title)) continue;

        const price = bid?.LeadingBid || bid?.HammerPrice || bid?.StartPrice || 0;
        const reserve = bid?.Reserve || null;
        const endTime = parseMsDate(bid?.EndTimeUtc) || parseMsDate(bid?.EndTimeUtcDateTime);
        const images = imageMap[lot.lotId] || [];
        const imageUrl = images[0] || null;

        const yearMatch = title.match(/\b(20\d{2}|19\d{2})\b/);
        const hoursMatch = title.match(/hours?\s*(?:showing\s*)?:?\s*([\d,]+)/i) ||
                           title.match(/\*\s*([\d,]+)\s*hours?\s*/i) ||
                           title.match(/([\d,]+)\s*(?:hours?|hrs?)\b/i);

        listings.push({
          id: nextId(),
          title: title.slice(0, 80),
          platform: 'bidspotter',
          price: Math.round(price) || 0,
          reserve: reserve ? Math.round(reserve) : null,
          reserveMet: bid?.ReserveMet || false,
          totalBids: bid?.TotalBids || 0,
          location: 'UK',
          lat: 52.5 + (Math.random() - 0.5) * 4,
          lng: -1.5 + (Math.random() - 0.5) * 4,
          endsAt: endTime || new Date(Date.now() + (24 + Math.random() * 96) * 3600000),
          relevanceScore: scoreRelevance(title),
          condition: 'Good',
          conditionScore: 3,
          year: yearMatch ? parseInt(yearMatch[1]) : null,
          hours: hoursMatch ? parseInt(hoursMatch[1].replace(/,/g, '')) : null,
          isNew: true,
          imageColor: '#E8500A',
          imageUrl,
          listingUrl: lot.lotUrl || catalogueUrl,
          source: 'live',
        });
      }

    } catch (err) {
      console.error(`Bidspotter catalogue error (${catalogueUrl}):`, err.message);
    }
    await delay(1500);
  }

  console.log(`Bidspotter: found ${listings.length} relevant listings`);
  return listings;
}

// ─── BIDSPOTTER LEGACY (unused — kept for reference) ──────────────────────────
async function scrapeBidspotterLegacy(keywords) {
  const listings = [];

  // Known active UK plant & machinery auction catalogues
  const urls = [
    'https://www.bidspotter.co.uk/en-gb/auction-catalogues/eamagroup/catalogue-id-eama-g10884',
    'https://www.bidspotter.co.uk/en-gb/auction-catalogues/eamagroup/catalogue-id-eama-g11013',
    'https://www.bidspotter.co.uk/en-gb/auction-catalogues/universal-auctions/catalogue-id-univer10244',
    'https://www.bidspotter.co.uk/en-gb/auction-catalogues/universal-auctions/catalogue-id-univer10243',
    'https://www.bidspotter.co.uk/en-gb/auction-catalogues/dunnbros/catalogue-id-dunn-b10036',
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { ...HEADERS, 'Referer': 'https://www.bidspotter.co.uk/' },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) { console.log(`Bidspotter ${url}: HTTP ${res.status}`); continue; }
      const html = await res.text();

      // Bidspotter catalogue pages render lot data in plain text with lot numbers
      // The lot number prefix (e.g. "304") lets us build the direct URL:
      // https://www.bidspotter.co.uk/en-gb/auction-catalogues/[auctioneer]/catalogue-id-[id]/lot-id-[lotNum]
      const cataloguePath = url.replace('https://www.bidspotter.co.uk', '');

      // Strip scripts/styles then get clean plain text
      const plainText = stripTags(
        html.replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
      ).replace(/\s+/g, ' ');

      // Match: optional lot number + year + brand + description
      // e.g. "304 2018 JCB JZ141-LC, Zero Tail Swing, 700MM Steel Tracks..."
      // e.g. "2151JCB JS130 EXCAVATOR" (lot+brand run together as seen in search results)
      const BRANDS = 'JCB|CAT|Caterpillar|Komatsu|Kubota|Hitachi|Kobelco|Volvo|Case|Doosan|Terex|Bobcat|Liebherr|Takeuchi|Yanmar|Hyundai|Sany|Merlo|Manitou|Thwaites|Avant';
      const lotRe = new RegExp(
        `\\b(\\d{1,4})\\s+((?:20\\d{2}|19\\d{2})\\s+(?:${BRANDS})[^.\\n]{10,150})`,
        'g'
      );
      // Also catch "2151JCB JS130..." where lot number runs into brand
      const compactRe = new RegExp(
        `\\b(\\d{1,4})((?:${BRANDS})\\s+[A-Z0-9][A-Z0-9\\-]{2,}[^.\\n]{10,150})`,
        'g'
      );

      const seen = new Set();

      const procesMatch = (lotNum, rawTitle, fallbackUrl) => {
        let title = rawTitle.trim().replace(/\s+/g, ' ');
        // Cut at structured field labels or junk
        title = title.replace(/\s*(Make\s*[:/]|Model\s*[:/]|Year of Manufacture|Key Features|Hours Showing|data-src|https?:).*$/i, '').trim();
        title = title.slice(0, 80).trim();
        if (title.length < 10 || !isRelevant(title)) return;
        const key = title.slice(0, 20).toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);

        const yearMatch = title.match(/\b(20\d{2})\b/);
        const hoursMatch = title.match(/Hours?\s*(?:Showing\s*)?:?\s*([\d,]+)/i) ||
                           title.match(/\*\s*([\d,]+)\s*HOURS?\s*/i) ||
                           title.match(/([\d,]+)\s*(?:hours?|hrs?)\b/i);

        // Build direct lot URL if we have a lot number, otherwise link to catalogue
        const lotUrl = lotNum
          ? `https://www.bidspotter.co.uk${cataloguePath}/lot-id-${lotNum}`
          : fallbackUrl;

        listings.push({
          id: nextId(),
          title,
          platform: 'bidspotter',
          price: 0, // Bidspotter is timed auction — no pre-sale price visible without login
          location: 'UK',
          lat: 52.5 + (Math.random() - 0.5) * 4,
          lng: -1.5 + (Math.random() - 0.5) * 4,
          endsAt: new Date(Date.now() + (24 + Math.random() * 120) * 3600000),
          relevanceScore: scoreRelevance(title),
          condition: 'Good', conditionScore: 3,
          year: yearMatch ? parseInt(yearMatch[1]) : null,
          hours: hoursMatch ? parseInt(hoursMatch[1].replace(/,/g, '')) : null,
          isNew: true, imageColor: '#E8500A',
          listingUrl: lotUrl,
          source: 'live',
        });
      };

      let m;
      while ((m = lotRe.exec(plainText)) !== null) {
        procesMatch(m[1], m[2], url);
      }
      while ((m = compactRe.exec(plainText)) !== null) {
        procesMatch(m[1], m[2], url);
      }

    } catch (err) {
      console.error(`Bidspotter error (${url}):`, err.message);
    }
    await delay(1500);
  }

  console.log(`Bidspotter legacy: found ${listings.length} listings`);
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

// ─── GUMTREE ───────────────────────────────────────────────────────────────────
// Gumtree plant & tractors section - pure static HTML, prices and URLs in page source
// URL pattern: /p/plant-tractors/[slug]/[id]
// Price pattern: £5,000 as link text immediately before the href
async function scrapeGumtree(keywords) {
  const listings = [];
  const urls = [
    'https://www.gumtree.com/cars-vans-motorbikes/plant-tractors/uk/srpsearch+excavator',
    'https://www.gumtree.com/cars-vans-motorbikes/plant-tractors/uk/srpsearch+digger',
    'https://www.gumtree.com/cars-vans-motorbikes/plant-tractors/uk/srpsearch+jcb',
    'https://www.gumtree.com/cars-vans-motorbikes/plant-tractors/uk/srpsearch+komatsu',
    'https://www.gumtree.com/cars-vans-motorbikes/plant-tractors/uk/srpsearch+telehandler',
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          ...HEADERS,
          'Referer': 'https://www.gumtree.com/',
          'Sec-Fetch-Site': 'same-origin',
        },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) { console.log(`Gumtree ${url}: HTTP ${res.status}`); continue; }
      const html = await res.text();

      // Gumtree listing cards follow this pattern in static HTML:
      // <a href="/p/plant-tractors/SLUG/ID"> ... TITLE ... £PRICE </a>
      // Each card: href="/p/plant-tractors/..." contains title text and price
      const cardRe = /href="(\/p\/plant-tractors\/[^"]+\/(\d{7,}))"[^>]*>([\s\S]{10,600}?)(?=href="\/p\/plant-tractors|$)/g;
      let m;
      while ((m = cardRe.exec(html)) !== null) {
        const path = m[1];
        const block = m[3];

        // Extract title from block - it's the main text content before the price
        const plainBlock = stripTags(block).replace(/\s+/g, ' ').trim();

        // Price: £ followed by digits/commas
        const priceMatch = plainBlock.match(/£\s*([\d,]+)/);
        const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0;

        // Skip hire/services (very low prices are hire fees not sales)
        if (price > 0 && price < 500) continue;

        // Title: text before the price, cleaned up
        let title = plainBlock.replace(/£[\d,]+.*$/, '').replace(/^\d+\s*/, '').trim();
        // Remove "Featured", photo counts like "4", "Private", location strings
        title = title.replace(/^(Featured\s*\d*|\d+\s*)/i, '').trim();
        title = title.replace(/\s*(Private|Dealer)\s*$/i, '').trim();

        if (title.length < 5 || !isRelevant(title)) continue;
        if (listings.some(l => l.listingUrl.includes(m[2]))) continue;

        // Extract location — Gumtree shows "City, County" after seller type
        const locationMatch = plainBlock.match(/(?:Private|Dealer)\s+([A-Z][a-zA-Z\s]+,\s*[A-Za-z\s]+)/);
        const location = locationMatch ? locationMatch[1].trim() : 'UK';

        // Year from title
        const yearMatch = title.match(/\b(20\d{2}|19\d{2})\b/);
        // Hours from title
        const hoursMatch = title.match(/([\d,]+)\s*(?:hours?|hrs?)\b/i);

        listings.push({
          id: nextId(),
          title: title.slice(0, 80),
          platform: 'gumtree',
          price,
          location,
          lat: 52.5 + (Math.random() - 0.5) * 5,
          lng: -1.5 + (Math.random() - 0.5) * 5,
          endsAt: new Date(Date.now() + (72 + Math.random() * 336) * 3600000), // classifieds last 2-3 weeks
          relevanceScore: scoreRelevance(title),
          condition: 'Good', conditionScore: 3,
          year: yearMatch ? parseInt(yearMatch[1]) : null,
          hours: hoursMatch ? parseInt(hoursMatch[1].replace(/,/g, '')) : null,
          isNew: true, imageColor: '#006B5B',
          listingUrl: 'https://www.gumtree.com' + path,
          source: 'live',
        });

        if (listings.length >= 60) break;
      }

    } catch (err) {
      console.error(`Gumtree error (${url}):`, err.message);
    }
    await delay(1500);
  }

  console.log(`Gumtree: found ${listings.length} listings`);
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
    ritchie: results[2].status === 'fulfilled' ? results[2].value.length : 0,
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
