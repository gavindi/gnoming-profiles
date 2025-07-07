/*
 * ETagManager.js - ETag caching and management for efficient GitHub polling
 * Part of Gnoming Profiles extension
 */

/**
 * Manages ETag caching for efficient GitHub API polling
 */
export class ETagManager {
    constructor() {
        this._etagCache = new Map();
        this._lastPollResult = null;
        this._isDestroyed = false;
    }
    
    /**
     * Store an ETag for a given endpoint
     * @param {string} endpoint - The API endpoint
     * @param {string} etag - The ETag value
     */
    setETag(endpoint, etag) {
        if (this._isDestroyed) {
            return;
        }
        
        if (etag) {
            this._etagCache.set(endpoint, etag);
            log(`ETag Manager: Cached ETag for ${endpoint}: ${etag}`);
        }
    }
    
    /**
     * Get the cached ETag for an endpoint
     * @param {string} endpoint - The API endpoint
     * @returns {string|null} The cached ETag or null
     */
    getETag(endpoint) {
        if (this._isDestroyed) {
            return null;
        }
        
        return this._etagCache.get(endpoint) || null;
    }
    
    /**
     * Check if an endpoint has a cached ETag
     * @param {string} endpoint - The API endpoint
     * @returns {boolean} True if ETag is cached
     */
    hasETag(endpoint) {
        if (this._isDestroyed) {
            return false;
        }
        
        return this._etagCache.has(endpoint);
    }
    
    /**
     * Remove an ETag from cache (e.g., after making changes)
     * @param {string} endpoint - The API endpoint
     */
    clearETag(endpoint) {
        if (this._isDestroyed) {
            return;
        }
        
        if (this._etagCache.has(endpoint)) {
            this._etagCache.delete(endpoint);
            log(`ETag Manager: Cleared ETag for ${endpoint}`);
        }
    }
    
    /**
     * Clear all cached ETags
     */
    clearAll() {
        if (this._isDestroyed) {
            return;
        }
        
        this._etagCache.clear();
        this._lastPollResult = null;
        log('ETag Manager: Cleared all ETags');
    }
    
    /**
     * Set the result of the last polling operation
     * @param {boolean|null} result - true if changes detected, false if 304, null if error
     */
    setLastPollResult(result) {
        if (this._isDestroyed) {
            return;
        }
        
        this._lastPollResult = result;
    }
    
    /**
     * Get the result of the last polling operation
     * @returns {boolean|null} The last poll result
     */
    getLastPollResult() {
        if (this._isDestroyed) {
            return null;
        }
        
        return this._lastPollResult;
    }
    
    /**
     * Get status information about ETag caching
     * @param {string} endpoint - The endpoint to check
     * @returns {Object} Status object with caching info
     */
    getStatus(endpoint = 'commits') {
        if (this._isDestroyed) {
            return {
                hasETag: false,
                etag: null,
                lastResult: null,
                statusText: 'Manager destroyed'
            };
        }
        
        const hasETag = this.hasETag(endpoint);
        const lastResult = this.getLastPollResult();
        
        return {
            hasETag,
            etag: hasETag ? this.getETag(endpoint) : null,
            lastResult,
            statusText: this._getStatusText(hasETag, lastResult)
        };
    }
    
    /**
     * Get human-readable status text
     * @param {boolean} hasETag - Whether ETag is cached
     * @param {boolean|null} lastResult - Last poll result
     * @returns {string} Status description
     */
    _getStatusText(hasETag, lastResult) {
        if (!hasETag) {
            return 'Not cached';
        }
        
        if (lastResult === null) {
            return 'Cached';
        } else if (lastResult === false) {
            return 'No changes (304)';
        } else if (lastResult === true) {
            return 'Changes detected';
        }
        
        return 'Cached';
    }
    
    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
        if (this._isDestroyed) {
            return {
                totalCached: 0,
                endpoints: [],
                lastPollResult: null,
                isDestroyed: true
            };
        }
        
        return {
            totalCached: this._etagCache.size,
            endpoints: Array.from(this._etagCache.keys()),
            lastPollResult: this._lastPollResult,
            isDestroyed: false
        };
    }
    
    /**
     * Check if the manager has been destroyed
     * @returns {boolean} True if destroyed
     */
    get isDestroyed() {
        return this._isDestroyed;
    }
    
    /**
     * Destroy the manager and cleanup resources
     */
    destroy() {
        if (this._isDestroyed) {
            return;
        }
        
        log('ETag Manager: Starting cleanup');
        
        this._isDestroyed = true;
        
        // Clear all cached data
        this._etagCache.clear();
        this._etagCache = null;
        
        // Clear last poll result
        this._lastPollResult = null;
        
        log('ETag Manager: Cleanup complete');
    }
}