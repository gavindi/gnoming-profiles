/*
 * RequestQueue.js - Request queue management for GitHub API calls
 * Part of Gnoming Profiles extension
 *
 * Copyright 2025 Gavin Graham (gavindi)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPLv2)
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
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
        this._isProcessing = false;
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
            
            if (!this._isProcessing) {
                this._processQueue();
            }
        });
    }
    
    /**
     * Process items in the queue respecting concurrency limits
     */
    async _processQueue() {
        if (this._isDestroyed || this._isProcessing || this.running >= this.maxConcurrency || this.queue.length === 0) {
            return;
        }
        
        this._isProcessing = true;
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
            this._isProcessing = false;
            // Process next item if not destroyed
            if (!this._isDestroyed && this.queue.length > 0) {
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
        
        
        this._isDestroyed = true;
        
        // Clear all pending requests
        this.clear();
        
        // Reset counters
        this.running = 0;
        
        // Clear queue reference
        this.queue = null;
        
    }
}