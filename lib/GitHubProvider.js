/*
 * GitHubProvider.js - GitHub storage backend implementing StorageProvider
 * Part of Gnoming Profiles extension
 */

import GLib from 'gi://GLib';
import { StorageProvider } from './StorageProvider.js';
import { GitHubAPI } from './GitHubAPI.js';

/**
 * GitHub storage provider using the GitHub REST API with Tree API batching.
 */
export class GitHubProvider extends StorageProvider {
    constructor(requestQueue, etagManager) {
        super(requestQueue, etagManager);
        this._api = new GitHubAPI(requestQueue, etagManager);
    }

    get name() {
        return 'GitHub';
    }

    /**
     * Build credentials from GSettings.
     */
    getCredentials(settings) {
        const token = settings.get_string('github-token');
        const repo = settings.get_string('github-repo');
        const username = settings.get_string('github-username');
        if (!token || !repo || !username) return null;
        return { token, repo, username };
    }

    hasValidCredentials(credentials) {
        return !!(credentials && credentials.token && credentials.repo && credentials.username);
    }

    /**
     * Upload a batch of changes using the GitHub Tree API for atomic commits.
     */
    async uploadBatch(changes, credentials) {
        const { token, username, repo } = credentials;

        // Detect default branch
        const branch = await this._api.getDefaultBranch(username, repo, token);

        // 1. Get current commit SHA
        console.log('GitHubProvider: Getting current commit SHA');
        const branchResponse = await this._api.getBranch(username, repo, token, branch);

        let currentCommitSha;
        if (branchResponse.ok) {
            const branchData = JSON.parse(branchResponse.data);
            currentCommitSha = branchData.object.sha;
        } else if (branchResponse.status === 404) {
            console.log('GitHubProvider: Repository is empty, will create initial commit');
            currentCommitSha = null;
        } else {
            throw new Error(`Failed to get current commit: ${branchResponse.status}`);
        }

        // 2. Get current tree SHA
        let currentTreeSha = null;
        if (currentCommitSha) {
            const commitResponse = await this._api.getCommit(username, repo, currentCommitSha, token);
            if (commitResponse.ok) {
                const commitData = JSON.parse(commitResponse.data);
                currentTreeSha = commitData.tree.sha;
            } else {
                throw new Error(`Failed to get current tree: ${commitResponse.status}`);
            }
        }

        // 3. Create blobs
        console.log('GitHubProvider: Creating blobs for changed content');
        const treeEntries = [];

        for (const change of changes) {
            try {
                const blobData = {
                    content: change.content,
                    encoding: change.encoding || 'utf-8'
                };

                const blobResponse = await this._api.createBlob(username, repo, token, blobData);

                if (blobResponse.ok) {
                    const blob = JSON.parse(blobResponse.data);
                    treeEntries.push({
                        path: change.path,
                        mode: change.mode || '100644',
                        type: 'blob',
                        sha: blob.sha
                    });
                    console.log(`GitHubProvider: Created blob for ${change.path}: ${blob.sha}`);
                } else {
                    console.error(`GitHubProvider: Failed to create blob for ${change.path}: ${blobResponse.status}`);
                }
            } catch (e) {
                console.error(`GitHubProvider: Error creating blob for ${change.path}: ${e.message}`);
            }
        }

        if (treeEntries.length === 0) {
            throw new Error('No blobs were created successfully');
        }

        // 4. Create new tree
        const treeData = {
            tree: treeEntries,
            ...(currentTreeSha && { base_tree: currentTreeSha })
        };
        const treeResponse = await this._api.createTree(username, repo, token, treeData);
        if (!treeResponse.ok) {
            throw new Error(`Failed to create tree: ${treeResponse.status} - ${treeResponse.data}`);
        }
        const newTree = JSON.parse(treeResponse.data);

        // 5. Create commit
        const commitMessage = `Batch sync ${treeEntries.length} files - ${new Date().toISOString()}`;
        const commitData = {
            message: commitMessage,
            tree: newTree.sha,
            ...(currentCommitSha && { parents: [currentCommitSha] })
        };
        const commitResponse = await this._api.createCommit(username, repo, token, commitData);
        if (!commitResponse.ok) {
            throw new Error(`Failed to create commit: ${commitResponse.status} - ${commitResponse.data}`);
        }
        const newCommit = JSON.parse(commitResponse.data);

        // 6. Update branch reference
        const refData = { sha: newCommit.sha, force: false };
        const refResponse = await this._api.updateRef(username, repo, token, refData, branch);
        if (!refResponse.ok) {
            throw new Error(`Failed to update branch: ${refResponse.status} - ${refResponse.data}`);
        }

        // Clear ETag cache since we just made changes
        this._api.clearETagCache();

        console.log(`GitHubProvider: Uploaded batch of ${treeEntries.length} files in commit ${newCommit.sha.substring(0, 7)}`);
    }

    /**
     * Download a text file. Returns decoded content from GitHub's base64 API response.
     */
    async downloadFile(path, credentials) {
        const { token, username, repo } = credentials;
        const response = await this._api.getContents(username, repo, path, token);

        if (!response.ok) {
            return { ok: false, status: response.status, content: null };
        }

        const fileData = JSON.parse(response.data);
        const content = new TextDecoder().decode(GLib.base64_decode(fileData.content));
        return { ok: true, status: response.status, content };
    }

    /**
     * Download a binary file via direct download URL or API fallback.
     */
    async downloadBinaryFile(path, credentials) {
        const { token, username, repo } = credentials;

        // First get file metadata to obtain download_url
        const response = await this._api.getContents(username, repo, path, token);
        if (!response.ok) {
            throw new Error(`Failed to get file info for ${path}: ${response.status}`);
        }

        const fileData = JSON.parse(response.data);

        // Try direct binary download first
        if (fileData.download_url) {
            try {
                return await this._api.downloadBinaryFile(fileData.download_url, token);
            } catch (e) {
                console.warn(`GitHubProvider: Binary download failed, falling back to API: ${e.message}`);
            }
        }

        // Fallback: decode base64 from API response
        if (fileData.content) {
            return GLib.base64_decode(fileData.content);
        }

        throw new Error(`No content available for ${path}`);
    }

    /**
     * List files in a directory.
     */
    async listDirectory(path, credentials) {
        const { token, username, repo } = credentials;
        const response = await this._api.getContents(username, repo, path, token);

        if (!response.ok) {
            return { ok: false, status: response.status, files: [] };
        }

        const items = JSON.parse(response.data);
        if (!Array.isArray(items)) {
            return { ok: true, status: response.status, files: [] };
        }

        const files = items.map(item => ({
            name: item.name,
            type: item.type,
            download_url: item.download_url || null,
            url: item.url
        }));

        return { ok: true, status: response.status, files };
    }

    /**
     * Poll for remote changes using ETag-based conditional requests on the commits endpoint.
     */
    async pollForChanges(credentials) {
        const { token, username, repo } = credentials;
        const result = await this._api.pollForChanges(username, repo, token);
        return result;
    }

    clearChangeCache() {
        this._api.clearETagCache();
    }

    cleanup() {
        if (this._api) {
            this._api.cleanup();
            this._api = null;
        }
        super.cleanup();
    }
}
