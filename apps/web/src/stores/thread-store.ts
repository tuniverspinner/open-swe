import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  ThreadDisplayStatus,
  ThreadPollingResponseSchema,
} from "@/lib/schemas/thread-status";
import { ThreadDisplayInfo } from "@/components/v2/types";

/**
 * Thread status cache entry for efficient polling
 */
export interface ThreadStatusCache {
  threadId: string;
  lastPollingState: ThreadPollingResponseSchema | null;
  displayStatus: ThreadDisplayStatus;
  lastUpdated: number;
  isPolling: boolean;
}

/**
 * Thread store state interface
 */
export interface ThreadStoreState {
  // Thread status cache for efficient polling
  threadStatusCache: Map<string, ThreadStatusCache>;

  // Active thread tracking
  activeThreadId: string | null;

  // Thread metadata cache
  threadMetadata: Map<string, ThreadDisplayInfo>;

  // Global polling state
  isGlobalPollingEnabled: boolean;
  pollingInterval: number;

  // Actions
  setActiveThread: (threadId: string | null) => void;
  updateThreadStatus: (threadId: string, status: ThreadDisplayStatus) => void;
  updateThreadPollingState: (
    threadId: string,
    pollingState: ThreadPollingResponseSchema,
  ) => void;
  setThreadPolling: (threadId: string, isPolling: boolean) => void;
  updateThreadMetadata: (threadId: string, metadata: ThreadDisplayInfo) => void;
  clearThreadCache: (threadId: string) => void;
  setGlobalPolling: (enabled: boolean) => void;
  setPollingInterval: (interval: number) => void;

  // Getters
  getThreadStatus: (threadId: string) => ThreadDisplayStatus | null;
  getThreadPollingState: (
    threadId: string,
  ) => ThreadPollingResponseSchema | null;
  isThreadPolling: (threadId: string) => boolean;
  getThreadMetadata: (threadId: string) => ThreadDisplayInfo | null;
}

/**
 * Zustand store for thread metadata management with subscribeWithSelector
 */
export const useThreadStore = create<ThreadStoreState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    threadStatusCache: new Map(),
    activeThreadId: null,
    threadMetadata: new Map(),
    isGlobalPollingEnabled: true,
    pollingInterval: 2000, // 2 seconds default

    // Actions
    setActiveThread: (threadId) => {
      set({ activeThreadId: threadId });
    },

    updateThreadStatus: (threadId, status) => {
      const cache = get().threadStatusCache;
      const existing = cache.get(threadId) || {
        threadId,
        lastPollingState: null,
        displayStatus: status,
        lastUpdated: Date.now(),
        isPolling: false,
      };

      cache.set(threadId, {
        ...existing,
        displayStatus: status,
        lastUpdated: Date.now(),
      });

      set({ threadStatusCache: new Map(cache) });
    },

    updateThreadPollingState: (threadId, pollingState) => {
      const cache = get().threadStatusCache;
      const existing = cache.get(threadId) || {
        threadId,
        lastPollingState: null,
        displayStatus: pollingState.status,
        lastUpdated: Date.now(),
        isPolling: false,
      };

      cache.set(threadId, {
        ...existing,
        lastPollingState: pollingState,
        displayStatus: pollingState.status,
        lastUpdated: Date.now(),
      });

      set({ threadStatusCache: new Map(cache) });
    },

    setThreadPolling: (threadId, isPolling) => {
      const cache = get().threadStatusCache;
      const existing = cache.get(threadId);

      if (existing) {
        cache.set(threadId, {
          ...existing,
          isPolling,
          lastUpdated: Date.now(),
        });

        set({ threadStatusCache: new Map(cache) });
      }
    },

    updateThreadMetadata: (threadId, metadata) => {
      const metadataCache = get().threadMetadata;
      metadataCache.set(threadId, metadata);
      set({ threadMetadata: new Map(metadataCache) });
    },

    clearThreadCache: (threadId) => {
      const cache = get().threadStatusCache;
      const metadataCache = get().threadMetadata;

      cache.delete(threadId);
      metadataCache.delete(threadId);

      set({
        threadStatusCache: new Map(cache),
        threadMetadata: new Map(metadataCache),
      });
    },

    setGlobalPolling: (enabled) => {
      set({ isGlobalPollingEnabled: enabled });
    },

    setPollingInterval: (interval) => {
      set({ pollingInterval: interval });
    },

    // Getters
    getThreadStatus: (threadId) => {
      const cache = get().threadStatusCache.get(threadId);
      return cache?.displayStatus || null;
    },

    getThreadPollingState: (threadId) => {
      const cache = get().threadStatusCache.get(threadId);
      return cache?.lastPollingState || null;
    },

    isThreadPolling: (threadId) => {
      const cache = get().threadStatusCache.get(threadId);
      return cache?.isPolling || false;
    },

    getThreadMetadata: (threadId) => {
      const metadataCache = get().threadMetadata.get(threadId);
      return metadataCache || null;
    },
  })),
);

/**
 * Selector hooks for specific thread data
 */
export const useActiveThread = () =>
  useThreadStore((state) => state.activeThreadId);

export const useThreadStatus = (threadId: string) =>
  useThreadStore((state) => state.getThreadStatus(threadId));

export const useThreadPollingState = (threadId: string) =>
  useThreadStore((state) => state.getThreadPollingState(threadId));

export const useIsThreadPolling = (threadId: string) =>
  useThreadStore((state) => state.isThreadPolling(threadId));

export const useThreadMetadata = (threadId: string) =>
  useThreadStore((state) => state.getThreadMetadata(threadId));

export const useGlobalPollingState = () =>
  useThreadStore((state) => ({
    isEnabled: state.isGlobalPollingEnabled,
    interval: state.pollingInterval,
  }));
