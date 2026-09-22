/**
 * ============================================================
 *  services/cache.js — Simple In-Memory Cache Service
 * ============================================================
 */

class Cache {
  constructor() {
    this.store = new Map();
  }

  /**
   * Get value from cache
   * @param {string} key 
   * @returns {any|null} Cached value or null if missed/expired
   */
  get(key) {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      console.log(`💾 [Cache] Key expired: ${key}`);
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  /**
   * Set value in cache
   * @param {string} key 
   * @param {any} value 
   * @param {number} ttlMs Time to live in milliseconds (default 1 minute)
   */
  set(key, value, ttlMs = 60000) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Delete a specific key
   * @param {string} key 
   */
  delete(key) {
    this.store.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix pattern
   * @param {string} prefix 
   */
  invalidatePattern(prefix) {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    if (count > 0) {
      console.log(`💾 [Cache] Invalidated ${count} key(s) starting with "${prefix}"`);
    }
  }

  /**
   * Clear all items from the cache
   */
  flush() {
    this.store.clear();
    console.log('💾 [Cache] Flushed all items');
  }

  /**
   * Get-or-set: returns cached value if present, otherwise calls the async
   * factory function, stores the result, and returns it.
   * @param {string} key
   * @param {Function} factory  Async function that returns the value to cache
   * @param {number} ttlMs      Time to live in milliseconds (default 1 minute)
   * @returns {Promise<any>}
   */
  async getOrSet(key, factory, ttlMs = 60000) {
    const cached = this.get(key);
    if (cached !== null) return cached;
    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Returns the number of live (non-expired) items currently in the cache
   * @returns {number}
   */
  size() {
    const now = Date.now();
    let count = 0;
    for (const item of this.store.values()) {
      if (now <= item.expiresAt) count++;
    }
    return count;
  }
}


module.exports = new Cache();
