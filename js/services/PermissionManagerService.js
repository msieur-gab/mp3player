/**
 * PermissionManagerService - Manages file system access permissions
 * Handles persistent storage of directory handles and permission lifecycle
 */
class PermissionManagerService {
    constructor(databaseService) {
        this.db = databaseService;

        // Constants
        this.THROTTLE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
        this.STORAGE_KEY_LAST_PROMPT = 'lastPermissionPrompt';
        this.IDB_NAME = 'MusicPlayerHandles';
        this.IDB_VERSION = 1;
        this.HANDLE_STORE = 'handles';

        // State
        this.dirHandle = null;
        this.idb = null;
        this.autoRequestAttempted = false;
    }

    /**
     * Initialize permission manager and restore handle
     */
    async init() {
        try {
            // Open native IndexedDB connection
            this.idb = await this.openIDB();
            console.log('[PermissionManager] IndexedDB opened');

            // Restore handle from IndexedDB
            const handle = await this.restoreHandleFromIDB();
            if (handle) {
                this.dirHandle = handle;
                console.log('[PermissionManager] Handle restored from IndexedDB');

                // Check permission status
                const status = await this.checkPermission();
                console.log(`[PermissionManager] Permission status: ${status}`);

                // Attempt auto-request if permission not granted
                if (status !== 'granted') {
                    console.log('[PermissionManager] Attempting auto-request...');
                    const granted = await this.requestPermissionAuto();
                    if (granted) {
                        console.log('[PermissionManager] Auto-request succeeded');
                    } else {
                        console.log('[PermissionManager] Auto-request failed or denied');
                    }
                }
            } else {
                console.log('[PermissionManager] No handle found in storage');
            }
        } catch (error) {
            console.error('[PermissionManager] Init error:', error);
        }
    }

    /**
     * Open native IndexedDB connection
     */
    async openIDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.IDB_NAME, this.IDB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.HANDLE_STORE)) {
                    db.createObjectStore(this.HANDLE_STORE);
                    console.log('[PermissionManager] Created handles object store');
                }
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Restore handle from IndexedDB
     */
    async restoreHandleFromIDB() {
        if (!this.idb) return null;

        return new Promise((resolve, reject) => {
            const tx = this.idb.transaction([this.HANDLE_STORE], 'readonly');
            const store = tx.objectStore(this.HANDLE_STORE);
            const request = store.get('root');

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                console.error('[PermissionManager] Error restoring handle:', request.error);
                resolve(null);
            };
        });
    }

    /**
     * Save directory handle to IndexedDB
     */
    async saveHandle(handle) {
        if (!this.idb) {
            console.error('[PermissionManager] IndexedDB not initialized');
            return;
        }

        return new Promise((resolve, reject) => {
            const tx = this.idb.transaction([this.HANDLE_STORE], 'readwrite');
            const store = tx.objectStore(this.HANDLE_STORE);
            const request = store.put(handle, 'root');

            request.onsuccess = () => {
                this.dirHandle = handle;
                console.log('[PermissionManager] Handle saved to IndexedDB');
                resolve();
            };

            request.onerror = () => {
                console.error('[PermissionManager] Error saving handle:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Get stored directory handle
     */
    async getHandle() {
        // Return cached handle if available
        if (this.dirHandle) {
            return this.dirHandle;
        }

        // Try to restore from IndexedDB
        if (this.idb) {
            this.dirHandle = await this.restoreHandleFromIDB();
        }

        return this.dirHandle;
    }

    /**
     * Check current permission status
     */
    async checkPermission() {
        if (!this.dirHandle) return null;

        try {
            const status = await this.dirHandle.queryPermission({ mode: 'read' });
            return status;
        } catch (error) {
            console.error('[PermissionManager] Error checking permission:', error);
            return null;
        }
    }

    /**
     * Request permission automatically (silent, no user notification)
     */
    async requestPermissionAuto() {
        if (!this.dirHandle) return false;

        // Only attempt once per session to avoid spam
        if (this.autoRequestAttempted) {
            return false;
        }

        this.autoRequestAttempted = true;

        try {
            const status = await this.dirHandle.requestPermission({ mode: 'read' });
            return status === 'granted';
        } catch (error) {
            console.log('[PermissionManager] Auto-request failed:', error.message);
            return false;
        }
    }

    /**
     * Request permission manually (user-initiated)
     */
    async requestPermissionManual() {
        if (!this.dirHandle) return false;

        try {
            const status = await this.dirHandle.requestPermission({ mode: 'read' });
            const granted = status === 'granted';

            // Update throttle timestamp
            if (granted) {
                localStorage.setItem(this.STORAGE_KEY_LAST_PROMPT, Date.now().toString());
                console.log('[PermissionManager] Permission granted, timestamp updated');
            }

            return granted;
        } catch (error) {
            console.error('[PermissionManager] Manual request failed:', error);
            return false;
        }
    }

    /**
     * Check if banner should be shown (throttling logic)
     */
    shouldShowBanner() {
        const lastPrompt = localStorage.getItem(this.STORAGE_KEY_LAST_PROMPT);

        // Never prompted before
        if (!lastPrompt) return true;

        // Check if 24 hours have passed
        const elapsed = Date.now() - parseInt(lastPrompt, 10);
        return elapsed >= this.THROTTLE_DURATION;
    }

    /**
     * Get time until next prompt allowed
     */
    getTimeUntilNextPrompt() {
        const lastPrompt = parseInt(localStorage.getItem(this.STORAGE_KEY_LAST_PROMPT) || '0', 10);
        const elapsed = Date.now() - lastPrompt;
        return Math.max(0, this.THROTTLE_DURATION - elapsed);
    }

    /**
     * Clear stored handle (for rescan)
     */
    async clearHandle() {
        if (!this.idb) return;

        return new Promise((resolve, reject) => {
            const tx = this.idb.transaction([this.HANDLE_STORE], 'readwrite');
            const store = tx.objectStore(this.HANDLE_STORE);
            const request = store.delete('root');

            request.onsuccess = () => {
                this.dirHandle = null;
                console.log('[PermissionManager] Handle cleared');
                resolve();
            };

            request.onerror = () => {
                console.error('[PermissionManager] Error clearing handle:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Reset auto-request flag (for testing)
     */
    resetAutoRequestFlag() {
        this.autoRequestAttempted = false;
    }
}

export default PermissionManagerService;
