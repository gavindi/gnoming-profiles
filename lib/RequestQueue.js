/*
 * RequestQueue.js - Request queue management for GitHub API calls
 * Part of Gnoming Profiles extension
 */

/**
 * Request queue implementation for managing GitHub API calls with concurrency control
 */
export class RequestQueue {
    constructor(maxConcurrency = 3) {
        this.maxConcurrency = maxConcurrency;
        this.running = 0;
        this.queue = [];
        this._isDestroyed = false;
    }
    
    /**
     * Add a request function to the queue
     * @param {Function} requestFunction - Async function that performs the request
     * @returns {Promise} Promise that resolves with the request result
     */
    async add(requestFunction) {
        if (this._isDestroyed) {
            throw new Error('RequestQueue has been destroyed');
        }
        
        return new Promise((resolve, reject) => {
            this.queue.push({
                fn: requestFunction,
                resolve: resolve,
                reject: reject
            });
            this._processQueue();
        });
    }
    
    /**
     * Process items in the queue respecting concurrency limits
     */
    async _processQueue() {
        if (this._isDestroyed || this.running >= this.maxConcurrency || this.queue.length === 0) {
            return;
        }
        
        this.running++;
        const item = this.queue.shift();
        
        try {
            const result = await item.fn();
            if (!this._isDestroyed) {
                item.resolve(result);
            }
        } catch (error) {
            if (!this._isDestroyed) {
                item.reject(error);
            }
        } finally {
            this.running--;
            // Process next item if not destroyed
            if (!this._isDestroyed) {
                this._processQueue();
            }
        }
    }
    
    /**
     * Clear all pending requests and reject them
     */
    clear() {
        // Reject all pending requests
        for (const item of this.queue) {
            item.reject(new Error('Queue cleared'));
        }
        this.queue.length = 0;
        console.log('RequestQueue: Cleared all pending requests');
    }
    
    /**
     * Get the number of pending requests
     */
    get pendingCount() {
        return this.queue.length;
    }
    
    /**
     * Get the number of currently running requests
     */
    get activeCount() {
        return this.running;
    }
    
    /**
     * Check if the queue is busy
     */
    get isBusy() {
        return this.running > 0 || this.queue.length > 0;
    }
    
    /**
     * Check if the queue has been destroyed
     */
    get isDestroyed() {
        return this._isDestroyed;
    }
    
    /**
     * Destroy the queue and cleanup resources
     */
    destroy() {
        if (this._isDestroyed) {
            return;
        }
        
        console.log('RequestQueue: Starting cleanup');
        
        this._isDestroyed = true;
        
        // Clear all pending requests
        this.clear();
        
        // Reset counters
        this.running = 0;
        
        // Clear queue reference
        this.queue = null;
        
        console.log('RequestQueue: Cleanup complete');
    }
}