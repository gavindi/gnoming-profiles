/*
 * NextcloudProvider.js - Nextcloud/WebDAV storage backend implementing StorageProvider
 * Part of Gnoming Profiles extension
 */

import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import { StorageProvider } from './StorageProvider.js';

/**
 * Nextcloud storage provider using WebDAV protocol.
 * Compatible with any WebDAV server, optimised for Nextcloud.
 */
export class NextcloudProvider extends StorageProvider {
    static WEBDAV_PATH = '/remote.php/dav/files';
    static HTTP_CREATED = 201;
    static HTTP_NO_CONTENT = 204;
    static HTTP_MULTI_STATUS = 207;
    static HTTP_NOT_MODIFIED = 304;
    static HTTP_NOT_FOUND = 404;
    static HTTP_METHOD_NOT_ALLOWED = 405;
    static HTTP_CONFLICT = 409;
    static HTTP_PRECONDITION_FAILED = 412;

    constructor(requestQueue, etagManager) {
        super(requestQueue, etagManager);
        this._httpSession = null;
        this._initializeSession();
    }

    get name() {
        return 'Nextcloud';
    }

    _initializeSession() {
        this._httpSession = new Soup.Session();
        this._httpSession.timeout = 30;
        this._httpSession.max_conns = 10;
        this._httpSession.user_agent = 'GNOME-Config-Sync/3.1.0-Nextcloud';
    }

    /**
     * Build credentials from GSettings.
     */
    getCredentials(settings) {
        const serverUrl = settings.get_string('nextcloud-url');
        const username = settings.get_string('nextcloud-username');
        const password = settings.get_string('nextcloud-password');
        const folder = settings.get_string('nextcloud-folder');
        if (!serverUrl || !username || !password) return null;
        return { serverUrl: serverUrl.replace(/\/+$/, ''), username, password, folder: folder || '.gnoming-profiles' };
    }

    hasValidCredentials(credentials) {
        return !!(credentials && credentials.serverUrl && credentials.username && credentials.password);
    }

    // ── WebDAV helpers ────────────────────────────────────────────────

    /**
     * Build the full WebDAV URL for a remote path.
     */
    _buildUrl(credentials, remotePath) {
        const { serverUrl, username, folder } = credentials;
        const base = `${serverUrl}${NextcloudProvider.WEBDAV_PATH}/${username}/${folder}`;
        if (!remotePath) return base;
        return `${base}/${remotePath}`;
    }

    /**
     * Perform a WebDAV request via the request queue.
     */
    async _request(url, method, credentials, body = null, extraHeaders = null, expectBinary = false) {
        return this.requestQueue.add(() => this._performRequest(url, method, credentials, body, extraHeaders, expectBinary));
    }

    _performRequest(url, method, credentials, body, extraHeaders, expectBinary) {
        return new Promise((resolve, reject) => {
            try {
                const message = Soup.Message.new(method, url);

                // Basic auth
                const authString = GLib.base64_encode(
                    new TextEncoder().encode(`${credentials.username}:${credentials.password}`)
                );
                message.request_headers.append('Authorization', `Basic ${authString}`);

                // Extra headers
                if (extraHeaders) {
                    for (const [key, value] of Object.entries(extraHeaders)) {
                        message.request_headers.append(key, value);
                    }
                }

                // Body
                if (body !== null) {
                    const contentType = (extraHeaders && extraHeaders['Content-Type']) || 'application/octet-stream';
                    const bytes = (body instanceof Uint8Array)
                        ? GLib.Bytes.new(body)
                        : GLib.Bytes.new(new TextEncoder().encode(body));
                    message.set_request_body_from_bytes(contentType, bytes);
                }

                if (method === 'HEAD') {
                    // HEAD responses have no body — use send_async to avoid
                    // send_and_read_async failing on the empty body in GJS/libsoup3.
                    this._httpSession.send_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                        try {
                            session.send_finish(result);
                            let responseETag = null;
                            if (message.response_headers) {
                                responseETag = message.response_headers.get_one('ETag');
                            }

                            resolve({
                                ok: message.status_code >= 200 && message.status_code < 300,
                                status: message.status_code,
                                data: null,
                                etag: responseETag,
                                isBinary: false
                            });
                        } catch (error) {
                            reject(error);
                        }
                    });
                } else {
                    this._httpSession.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                        try {
                            const bytes = session.send_and_read_finish(result);
                            let responseETag = null;
                            if (message.response_headers) {
                                responseETag = message.response_headers.get_one('ETag');
                            }

                            const rawData = bytes ? bytes.get_data() : null;
                            let data;
                            if (expectBinary) {
                                data = rawData;
                            } else {
                                data = rawData ? new TextDecoder().decode(rawData) : '';
                            }

                            resolve({
                                ok: message.status_code >= 200 && message.status_code < 300,
                                status: message.status_code,
                                data,
                                etag: responseETag,
                                isBinary: expectBinary
                            });
                        } catch (error) {
                            reject(error);
                        }
                    });
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    // ── Directory management ──────────────────────────────────────────

    /**
     * Ensure a remote directory (and its parents) exists via MKCOL.
     */
    async _ensureDirectory(dirPath, credentials) {
        const parts = dirPath.split('/').filter(Boolean);
        let current = '';
        for (const part of parts) {
            current += `/${part}`;
            const url = this._buildUrl(credentials, null) + '/../..' +
                `${NextcloudProvider.WEBDAV_PATH}/${credentials.username}/${credentials.folder}${current}`;
            // Simpler: just build from base
            const mkcolUrl = `${credentials.serverUrl}${NextcloudProvider.WEBDAV_PATH}/${credentials.username}/${credentials.folder}${current}`;
            const response = await this._request(mkcolUrl, 'MKCOL', credentials);
            // 201 = created, 405 = already exists – both are fine
            if (!response.ok && response.status !== NextcloudProvider.HTTP_METHOD_NOT_ALLOWED) {
                // 409 means parent missing (shouldn't happen since we create incrementally)
                if (response.status !== NextcloudProvider.HTTP_CONFLICT) {
                }
            }
        }
    }

    /**
     * Ensure the root sync folder exists.
     */
    async _ensureRootFolder(credentials) {
        const url = this._buildUrl(credentials, null);
        const response = await this._request(url, 'MKCOL', credentials);
        // 201 created, 405 already exists
        if (!response.ok && response.status !== NextcloudProvider.HTTP_METHOD_NOT_ALLOWED) {
            console.error(`NextcloudProvider: Root folder MKCOL returned ${response.status}`);
            if (response.data) console.error(`NextcloudProvider: Response: ${String(response.data).substring(0, 500)}`);
        }
    }

    // ── StorageProvider implementation ────────────────────────────────

    /**
     * Upload files individually (WebDAV has no atomic batch, so we upload one-by-one).
     */
    async uploadBatch(changes, credentials) {
        await this._ensureRootFolder(credentials);

        let uploaded = 0;
        for (const change of changes) {
            try {
                // Ensure parent directory exists
                const parentDir = change.path.split('/').slice(0, -1).join('/');
                if (parentDir) {
                    await this._ensureDirectory(parentDir, credentials);
                }

                const url = this._buildUrl(credentials, change.path);

                let body;
                if (change.encoding === 'base64') {
                    // Decode base64 to binary for upload
                    body = GLib.base64_decode(change.content);
                } else {
                    body = change.content;
                }

                const response = await this._request(url, 'PUT', credentials, body);

                if (response.ok || response.status === NextcloudProvider.HTTP_CREATED || response.status === NextcloudProvider.HTTP_NO_CONTENT) {
                    uploaded++;
                    // Cache the new ETag so the next poll has a valid baseline
                    // and doesn't falsely detect our own upload as a remote change.
                    if (change.path === 'config-backup.json') {
                        let newETag = response.etag;
                        if (!newETag) {
                            // PUT often doesn't return ETag; HEAD reliably does
                            const headResp = await this._request(url, 'HEAD', credentials);
                            newETag = headResp.etag;
                        }
                        if (newETag) {
                            this.etagManager.setETag('nextcloud-config', newETag);
                        }
                    }
                } else {
                    console.error(`NextcloudProvider: Failed to upload ${change.path}: HTTP ${response.status}`);
                    if (response.data) console.error(`NextcloudProvider: Response: ${String(response.data).substring(0, 500)}`);
                }
            } catch (e) {
                console.error(`NextcloudProvider: Error uploading ${change.path}: ${e.message}`);
            }
        }

    }

    /**
     * Download a text file via GET.
     */
    async downloadFile(path, credentials) {
        const url = this._buildUrl(credentials, path);
        const response = await this._request(url, 'GET', credentials);

        if (!response.ok) {
            if (response.status !== NextcloudProvider.HTTP_NOT_FOUND) {
                console.error(`NextcloudProvider: Download failed for ${path}: HTTP ${response.status}`);
                if (response.data) console.error(`NextcloudProvider: Response: ${String(response.data).substring(0, 500)}`);
            }
            return { ok: false, status: response.status, content: null };
        }

        return { ok: true, status: response.status, content: response.data };
    }

    /**
     * Download a binary file via GET.
     */
    async downloadBinaryFile(path, credentials) {
        const url = this._buildUrl(credentials, path);
        const response = await this._request(url, 'GET', credentials, null, null, true);

        if (!response.ok) {
            throw new Error(`Binary download failed for ${path}: ${response.status}`);
        }

        if (response.data instanceof Uint8Array) {
            return response.data;
        }
        throw new Error('Response was not binary data as expected');
    }

    /**
     * List files using PROPFIND (depth 1).
     */
    async listDirectory(path, credentials) {
        const url = this._buildUrl(credentials, path);
        const propfindBody = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <d:getetag/>
  </d:prop>
</d:propfind>`;

        const response = await this._request(url, 'PROPFIND', credentials, propfindBody, {
            'Content-Type': 'application/xml; charset=utf-8',
            'Depth': '1'
        });

        if (!response.ok && response.status !== NextcloudProvider.HTTP_MULTI_STATUS) {
            return { ok: false, status: response.status, files: [] };
        }

        // Parse the WebDAV XML response
        const files = this._parsePropfindResponse(response.data, path, credentials);
        return { ok: true, status: response.status, files };
    }

    /**
     * Parse a PROPFIND XML response into a file list.
     * Uses simple regex-based parsing since GJS has no built-in XML parser.
     */
    _parsePropfindResponse(xml, requestedPath, credentials) {
        const files = [];
        // Match each <d:response> block
        const responseBlocks = xml.match(/<d:response>[\s\S]*?<\/d:response>/gi) || [];
        const basePath = `${NextcloudProvider.WEBDAV_PATH}/${credentials.username}/${credentials.folder}`;

        for (const block of responseBlocks) {
            // Extract href
            const hrefMatch = block.match(/<d:href>([^<]*)<\/d:href>/i);
            if (!hrefMatch) continue;

            const href = decodeURIComponent(hrefMatch[1]);

            // Determine the relative path from our sync folder
            const baseIdx = href.indexOf(basePath);
            if (baseIdx === -1) continue;
            let relativePath = href.substring(baseIdx + basePath.length).replace(/^\/+/, '').replace(/\/+$/, '');

            // Skip the directory itself (first entry is always the requested directory)
            const normalizedRequested = (requestedPath || '').replace(/^\/+/, '').replace(/\/+$/, '');
            if (relativePath === normalizedRequested) continue;

            // Detect if it's a collection (directory)
            const isCollection = /<d:resourcetype>\s*<d:collection\s*\/?\s*>\s*<\/d:resourcetype>/i.test(block) ||
                                 /<d:collection/i.test(block);

            const name = relativePath.split('/').pop();
            if (!name) continue;

            files.push({
                name,
                type: isCollection ? 'dir' : 'file',
                download_url: null, // WebDAV doesn't have separate download URLs
                url: `${credentials.serverUrl}${href}`
            });
        }

        return files;
    }

    /**
     * Poll for changes using a lightweight HEAD request with ETag comparison.
     *
     * Nextcloud/SabreDAV may return 412 Precondition Failed instead of
     * 304 Not Modified when If-None-Match is used. A 412 means the ETag
     * did not match, so we treat it as "changes detected" and re-fetch
     * the current ETag without the conditional header.
     */
    async pollForChanges(credentials) {
        const url = this._buildUrl(credentials, 'config-backup.json');
        const cachedETag = this.etagManager.getETag('nextcloud-config');

        const headers = {};
        if (cachedETag) {
            headers['If-None-Match'] = cachedETag;
        }

        try {
            let response = await this._request(url, 'HEAD', credentials, null, headers);

            // Nextcloud/SabreDAV may return 412 instead of 304 for conditional
            // requests. Re-fetch without If-None-Match to get the new ETag.
            if (response.status === NextcloudProvider.HTTP_PRECONDITION_FAILED) {
                response = await this._request(url, 'HEAD', credentials);
                if (response.ok && response.etag) {
                    this.etagManager.setETag('nextcloud-config', response.etag);
                    this.etagManager.setLastPollResult(true);
                    return { hasChanges: true, etag304: false };
                }
            }

            if (response.status === NextcloudProvider.HTTP_NOT_MODIFIED) {
                this.etagManager.setLastPollResult(false);
                return { hasChanges: false, etag304: true };
            }

            if (response.status === NextcloudProvider.HTTP_NOT_FOUND) {
                this.etagManager.setLastPollResult(false);
                return { hasChanges: false, etag304: false };
            }

            if (!response.ok) {
                throw new Error(`HEAD poll failed: ${response.status}`);
            }

            // Extract ETag from response header
            const newETag = response.etag;

            if (newETag) {
                const hasChanges = cachedETag !== null && cachedETag !== newETag;
                this.etagManager.setETag('nextcloud-config', newETag);
                this.etagManager.setLastPollResult(hasChanges);

                if (!cachedETag) {
                    // First poll, just cache the ETag
                    return { hasChanges: false, etag304: false };
                }

                if (hasChanges) {
                }

                return { hasChanges, etag304: false };
            }

            // HEAD returned no ETag — fall back to a minimal GET which
            // reliably includes the ETag on Nextcloud/WebDAV servers.
            const getHeaders = cachedETag ? { 'If-None-Match': cachedETag, 'Range': 'bytes=0-0' } : { 'Range': 'bytes=0-0' };
            const getResponse = await this._request(url, 'GET', credentials, null, getHeaders);

            if (getResponse.status === NextcloudProvider.HTTP_NOT_MODIFIED) {
                this.etagManager.setLastPollResult(false);
                return { hasChanges: false, etag304: true };
            }

            if (getResponse.etag) {
                const hasChanges = cachedETag !== null && cachedETag !== getResponse.etag;
                this.etagManager.setETag('nextcloud-config', getResponse.etag);
                this.etagManager.setLastPollResult(hasChanges);

                if (!cachedETag) {
                    return { hasChanges: false, etag304: false };
                }

                return { hasChanges, etag304: false };
            }

            this.etagManager.setLastPollResult(null);
            return { hasChanges: false, etag304: false };

        } catch (error) {
            this.etagManager.setLastPollResult(null);
            throw error;
        }
    }

    clearChangeCache() {
        this.etagManager.clearETag('nextcloud-config');
    }

    cleanup() {
        if (this._httpSession) {
            this._httpSession.abort();
            this._httpSession = null;
        }
        super.cleanup();
    }
}
