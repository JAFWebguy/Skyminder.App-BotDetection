import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BskyAgent } from '@atproto/api';
import { ProfileView } from '@atproto/api/dist/client/types/app/bsky/actor/defs';

interface AuthState {
  agent: BskyAgent | null;
  isAuthenticated: boolean;
  recentFollowers: ProfileView[];
  recentUnfollowers: ProfileView[];
  lastKnownFollowers: ProfileView[];
  lastCheck: number;
  muteList: string[];
  rateLimitTimers: Record<string, number>;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  updateRecentFollowers: (followers: ProfileView[]) => void;
  updateRecentUnfollowers: (unfollowers: ProfileView[]) => void;
  updateLastKnownFollowers: (followers: ProfileView[]) => void;
  updateLastCheck: (timestamp: number) => void;
  updateMuteList: (mutes: string[]) => void;
  getMuteList: () => Promise<string[]>;
  checkSession: () => boolean;
  executeWithRateLimit: <T>(key: string, operation: () => Promise<T>, retries?: number) => Promise<T>;
  reconnect: () => Promise<void>;
}

const RATE_LIMIT_DELAY = 1000; // 1 second
const RATE_LIMIT_BACKOFF = 5000; // 5 seconds
const MAX_RETRIES = 3;
const NETWORK_ERROR_DELAY = 3000; // 3 seconds

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      agent: null,
      isAuthenticated: false,
      recentFollowers: [],
      recentUnfollowers: [],
      lastKnownFollowers: [],
      lastCheck: Date.now(),
      muteList: [],
      rateLimitTimers: {},

      login: async (identifier: string, password: string) => {
        const agent = new BskyAgent({ service: 'https://bsky.social' });
        try {
          await agent.login({ identifier, password });
          set({ agent, isAuthenticated: true });
          
          try {
            const response = await agent.app.bsky.graph.getMutes();
            set({ muteList: response.data.mutes.map(mute => mute.did) });
          } catch (error) {
            console.error('Failed to initialize mute list:', error);
          }
        } catch (error: any) {
          if (error.status === 401) {
            throw new Error('Invalid credentials. Please check your handle/email and password.');
          } else if (error.status === 429) {
            throw new Error('Too many login attempts. Please try again in a few minutes.');
          } else if (error.message?.includes('Failed to fetch') || error.status === 1) {
            throw new Error('Network error. Please check your connection and try again.');
          } else {
            throw new Error('Login failed. Please try again later.');
          }
        }
      },

      reconnect: async () => {
        const { agent } = get();
        if (!agent?.session) return;

        try {
          await agent.resumeSession(agent.session);
          set({ isAuthenticated: true });
        } catch (error) {
          console.error('Failed to resume session:', error);
          get().logout();
        }
      },

      logout: () => {
        const { agent } = get();
        if (agent) {
          agent.session = null;
        }
        set({
          agent: null,
          isAuthenticated: false,
          recentFollowers: [],
          recentUnfollowers: [],
          lastKnownFollowers: [],
          lastCheck: Date.now(),
          muteList: [],
          rateLimitTimers: {},
        });
      },

      checkSession: () => {
        const { agent } = get();
        if (!agent?.session) {
          set({ isAuthenticated: false });
          return false;
        }
        return true;
      },

      executeWithRateLimit: async (key: string, operation: () => Promise<any>, retries = MAX_RETRIES) => {
        const { rateLimitTimers } = get();
        const now = Date.now();
        const lastCallTime = rateLimitTimers[key] || 0;
        const timeSinceLastCall = now - lastCallTime;
        
        if (timeSinceLastCall < RATE_LIMIT_DELAY) {
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastCall));
        }
        
        try {
          const result = await operation();
          set({ rateLimitTimers: { ...rateLimitTimers, [key]: Date.now() } });
          return result;
        } catch (error: any) {
          if (error.message?.includes('Failed to fetch') || error.status === 1) {
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, NETWORK_ERROR_DELAY));
              return get().executeWithRateLimit(key, operation, retries - 1);
            }
            throw new Error('Network error. Please check your connection.');
          } else if (error.status === 429 && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_BACKOFF));
            return get().executeWithRateLimit(key, operation, retries - 1);
          } else if (error.status === 401) {
            await get().reconnect();
            if (!get().isAuthenticated) {
              throw new Error('Session expired. Please login again.');
            }
            if (retries > 0) {
              return get().executeWithRateLimit(key, operation, retries - 1);
            }
          }
          throw error;
        }
      },

      updateRecentFollowers: (followers) => set({ recentFollowers: followers }),
      updateRecentUnfollowers: (unfollowers) => set({ recentUnfollowers: unfollowers }),
      updateLastKnownFollowers: (followers) => set({ lastKnownFollowers: followers }),
      updateLastCheck: (timestamp) => set({ lastCheck: timestamp }),
      updateMuteList: (mutes) => set({ muteList: mutes }),
      
      getMuteList: async () => {
        const { agent, muteList } = get();
        if (!agent) return muteList;
        
        try {
          const response = await agent.app.bsky.graph.getMutes();
          const newMuteList = response.data.mutes.map(mute => mute.did);
          set({ muteList: newMuteList });
          return newMuteList;
        } catch (error) {
          console.error('Failed to fetch mute list:', error);
          return muteList;
        }
      },
    }),
    {
      name: 'bluesky-storage',
      partialize: (state) => ({
        recentFollowers: state.recentFollowers,
        recentUnfollowers: state.recentUnfollowers,
        lastKnownFollowers: state.lastKnownFollowers,
        lastCheck: state.lastCheck,
        muteList: state.muteList,
      }),
    }
  )
);