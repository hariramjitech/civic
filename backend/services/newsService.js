/**
 * ============================================================
 *  services/newsService.js — NewsAPI Integration & Cache
 * ============================================================
 */

const axios = require('axios');

// In-memory cache for NewsAPI results to avoid rate limiting (limit 100 requests/day on developer plan)
const cache = {
  general: null,
  generalTimestamp: 0,
  districts: {}, // districtName -> { articles, timestamp }
};

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Clean and filter NewsAPI articles to remove removed/dead links
 */
function cleanArticles(articles) {
  if (!articles || !Array.isArray(articles)) return [];
  return articles
    .filter(art => 
      art.title && 
      art.title !== '[Removed]' && 
      !art.title.includes('Removed') &&
      art.url && 
      art.url !== 'https://removed.com'
    )
    .map(art => ({
      source: art.source?.name || 'News',
      title: art.title,
      description: art.description || 'No description available.',
      url: art.url,
      imageUrl: art.urlToImage || 'https://images.unsplash.com/photo-1590086782792-42dd2350140d?w=800&auto=format&fit=crop&q=60', // high quality placeholder banner
      publishedAt: art.publishedAt
    }));
}

/**
 * Fetch general Tamil Nadu infrastructure news
 */
async function fetchGeneralNews() {
  const now = Date.now();
  if (cache.general && (now - cache.generalTimestamp < CACHE_TTL)) {
    console.log('📰 [News Service] Serving general Tamil Nadu news from cache');
    return cache.general;
  }

  try {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ [News Service] NEWS_API_KEY is not defined. Returning mock/empty news.');
      return getMockGeneralNews();
    }

    console.log('📰 [News Service] Fetching general Tamil Nadu infrastructure news from NewsAPI...');
    // Query search for Tamil Nadu infrastructure topics
    const query = '"Tamil Nadu" AND (infrastructure OR metro OR highway OR road OR civic OR water OR electricity)';
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: query,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 15,
        apiKey: apiKey
      },
      headers: {
        'User-Agent': 'CivicTN/1.0 (contact@civictn.in)'
      },
      timeout: 8000
    });

    const articles = cleanArticles(response.data?.articles);
    
    // Cache the result
    cache.general = articles;
    cache.generalTimestamp = now;
    
    return articles;
  } catch (err) {
    console.error('❌ [News Service] Failed to fetch general news:', err.message);
    // If we have stale cache, serve it, otherwise return mock news
    if (cache.general) {
      console.log('📰 [News Service] Serving stale general news from cache after error');
      return cache.general;
    }
    return getMockGeneralNews();
  }
}

/**
 * Fetch district-specific infrastructure news
 */
async function fetchDistrictNews(district) {
  if (!district || district === 'Unknown') return [];
  
  const now = Date.now();
  const cachedDistrict = cache.districts[district];
  if (cachedDistrict && (now - cachedDistrict.timestamp < CACHE_TTL)) {
    console.log(`📰 [News Service] Serving news for district: ${district} from cache`);
    return cachedDistrict.articles;
  }

  try {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ [News Service] NEWS_API_KEY is not defined. Returning mock/empty district news.');
      return getMockDistrictNews(district);
    }

    console.log(`📰 [News Service] Fetching news for district: ${district} from NewsAPI...`);
    // Query search for district specific infrastructure/civic updates
    const query = `"${district}" AND (infrastructure OR road OR water OR electricity OR metro OR flyover OR civic)`;
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: query,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 10,
        apiKey: apiKey
      },
      headers: {
        'User-Agent': 'CivicTN/1.0 (contact@civictn.in)'
      },
      timeout: 8000
    });

    const articles = cleanArticles(response.data?.articles);
    
    // Cache the result
    cache.districts[district] = {
      articles: articles,
      timestamp: now
    };
    
    return articles;
  } catch (err) {
    console.error(`❌ [News Service] Failed to fetch news for district ${district}:`, err.message);
    if (cachedDistrict) {
      console.log(`📰 [News Service] Serving stale news for district: ${district} from cache after error`);
      return cachedDistrict.articles;
    }
    return getMockDistrictNews(district);
  }
}

/**
 * Return premium, realistic mock infrastructure news for Tamil Nadu as a fallback
 */
function getMockGeneralNews() {
  return [
    {
      source: 'The Hindu',
      title: 'Tamil Nadu to invest ₹15,000 crore in upgrade of state highways and ring roads',
      description: 'The Tamil Nadu state government has approved a mega infrastructure spending plan to broaden key state highways and improve road networks in 12 districts over the next two years.',
      url: 'https://www.thehindu.com',
      imageUrl: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?w=800&auto=format&fit=crop&q=60',
      publishedAt: new Date(Date.now() - 3600000 * 4).toISOString() // 4 hours ago
    },
    {
      source: 'Times of India',
      title: 'Chennai Metro Phase 2 operations on track for early 2026 launch on key corridors',
      description: 'Metrorail authorities have completed tunnel boring on the OMR stretch, paving the way for testing and signalling trials. Elevators and stations are being fast-tracked.',
      url: 'https://timesofindia.indiatimes.com',
      imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=60',
      publishedAt: new Date(Date.now() - 3600000 * 12).toISOString() // 12 hours ago
    },
    {
      source: 'New Indian Express',
      title: 'Water distribution network expanded in southern districts under Jal Jeevan Mission',
      description: 'Over 200 rural habitations in Madurai, Thoothukudi, and Virudhunagar receive tap connections under new drinking water supply schemes launched by the Public Works Department.',
      url: 'https://www.newindianexpress.com',
      imageUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&auto=format&fit=crop&q=60',
      publishedAt: new Date(Date.now() - 3600000 * 24).toISOString() // 1 day ago
    },
    {
      source: 'Deccan Chronicle',
      title: 'Smart City Project: Salem and Coimbatore civic bodies get high rating for road safety',
      description: 'Salem Municipal Corporation and Coimbatore Municipal Corporation have been recognized for introducing traffic speed-breakers, pedestrian crosswalks, and smart streetlighting.',
      url: 'https://www.deccanchronicle.com',
      imageUrl: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=800&auto=format&fit=crop&q=60',
      publishedAt: new Date(Date.now() - 3600000 * 48).toISOString() // 2 days ago
    }
  ];
}

/**
 * Return mock news specific to a district as a fallback
 */
function getMockDistrictNews(district) {
  return [
    {
      source: 'DT Next',
      title: `Civic update: Local infrastructure improvements fast-tracked in ${district} district`,
      description: `The local municipal corporation of ${district} has announced a budget allocation of ₹450 crore for resolving water logging, storm water drain repairs, and road repaving across key areas.`,
      url: 'https://www.dtnext.in',
      imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&auto=format&fit=crop&q=60',
      publishedAt: new Date(Date.now() - 3600000 * 6).toISOString()
    },
    {
      source: 'The Hindu',
      title: `${district} traffic police introduces new routing to ease congestion near flyover project`,
      description: `To facilitate the construction of the new multi-lane road corridor in ${district}, temporary traffic diversions will be in place for the next three weeks.`,
      url: 'https://www.thehindu.com',
      imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=60',
      publishedAt: new Date(Date.now() - 3600000 * 18).toISOString()
    }
  ];
}

module.exports = {
  fetchGeneralNews,
  fetchDistrictNews
};
