import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../lib/store';
import { ProfileView } from '@atproto/api/dist/client/types/app/bsky/actor/defs';
import { UserProfile } from './UserProfile';
import { Users, UserPlus, UserMinus, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { SearchBar } from './SearchBar';

type ListType = 'followers' | 'following' | 'recent-followers' | 'recent-unfollowers';

const ITEMS_PER_PAGE = 25;
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function ConnectionsList() {
  const [activeTab, setActiveTab] = useState<ListType>('followers');
  const [profiles, setProfiles] = useState<ProfileView[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalFollowers, setTotalFollowers] = useState(0);
  const [totalFollowing, setTotalFollowing] = useState(0);
  const [nextCheck, setNextCheck] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const {
    agent,
    recentFollowers,
    recentUnfollowers,
    lastKnownFollowers,
    lastCheck,
    updateRecentFollowers,
    updateRecentUnfollowers,
    updateLastKnownFollowers,
    updateLastCheck,
    checkSession,
    executeWithRateLimit
  } = useAuthStore();

  const compareFollowerLists = (oldList: ProfileView[], newList: ProfileView[]) => {
    const oldDids = new Set(oldList.map(p => p.did));
    const newDids = new Set(newList.map(p => p.did));
    
    const gained = newList.filter(p => !oldDids.has(p.did));
    const lost = oldList.filter(p => !newDids.has(p.did));
    
    return { gained, lost };
  };

  const fetchAllConnections = useCallback(async (isFollowers: boolean) => {
    if (!agent?.session?.did) return [];
    let cursor: string | undefined;
    let allProfiles: ProfileView[] = [];
    
    try {
      do {
        const result = await executeWithRateLimit(
          `fetch-${isFollowers ? 'followers' : 'following'}-${cursor || 'initial'}`,
          async () => {
            const response = isFollowers
              ? await agent.getFollowers({ actor: agent.session!.did, cursor, limit: 100 })
              : await agent.getFollows({ actor: agent.session!.did, cursor, limit: 100 });
            return response.data;
          }
        );
        
        const profiles = isFollowers ? result.followers : result.follows;
        if (!profiles?.length) break;
        
        allProfiles = [...allProfiles, ...profiles];
        cursor = result.cursor;
      } while (cursor);
      
      return allProfiles;
    } catch (error: any) {
      const errorMessage = error.message || `Failed to fetch ${isFollowers ? 'followers' : 'following'}`;
      throw new Error(errorMessage);
    }
  }, [agent, executeWithRateLimit]);

  const fetchFollowers = useCallback(() => fetchAllConnections(true), [fetchAllConnections]);
  const fetchFollowing = useCallback(() => fetchAllConnections(false), [fetchAllConnections]);

  const checkFollowers = useCallback(async () => {
    if (!agent?.session?.did || !checkSession()) return;
    
    try {
      const now = Date.now();
      const currentFollowers = await fetchFollowers();
      
      if (lastKnownFollowers.length > 0) {
        const { gained, lost } = compareFollowerLists(lastKnownFollowers, currentFollowers);
        
        if (gained.length > 0) {
          const updatedRecentFollowers = [...gained, ...recentFollowers].slice(0, 100);
          updateRecentFollowers(updatedRecentFollowers);
          toast.success(`${gained.length} new follower${gained.length > 1 ? 's' : ''}!`);
        }
        
        if (lost.length > 0) {
          const updatedRecentUnfollowers = [...lost, ...recentUnfollowers].slice(0, 100);
          updateRecentUnfollowers(updatedRecentUnfollowers);
          toast.success(`${lost.length} user${lost.length > 1 ? 's' : ''} unfollowed you`);
        }
      }
      
      updateLastKnownFollowers(currentFollowers);
      updateLastCheck(now);
      setNextCheck(formatDistanceToNow(now + CHECK_INTERVAL));
      setError(null);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to check followers';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  }, [agent, checkSession, fetchFollowers, lastKnownFollowers, recentFollowers, recentUnfollowers]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery]);

  useEffect(() => {
    const fetchConnections = async () => {
      if (!agent?.session?.did) return;
      setLoading(true);
      try {
        if (activeTab === 'recent-followers') {
          setProfiles(recentFollowers);
        } else if (activeTab === 'recent-unfollowers') {
          setProfiles(recentUnfollowers);
        } else {
          const allProfiles = await (activeTab === 'followers' ? fetchFollowers() : fetchFollowing());
          setProfiles(allProfiles);
        }
        setError(null);
      } catch (error: any) {
        const errorMessage = error.message || 'Failed to load connections';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchConnections();
  }, [activeTab, agent?.session?.did, recentFollowers, recentUnfollowers, fetchFollowers, fetchFollowing]);

  useEffect(() => {
    const fetchTotals = async () => {
      if (!agent?.session?.did) return;
      try {
        const [allFollowers, allFollowing] = await Promise.all([
          fetchFollowers(),
          fetchFollowing()
        ]);
        setTotalFollowers(allFollowers.length);
        setTotalFollowing(allFollowing.length);
        setError(null);
      } catch (error: any) {
        const errorMessage = error.message || 'Failed to fetch totals';
        setError(errorMessage);
        toast.error(errorMessage);
      }
    };
    
    if (agent?.session?.did) {
      fetchTotals();
    }
  }, [agent?.session?.did, fetchFollowers, fetchFollowing]);

  useEffect(() => {
    const interval = setInterval(() => {
      checkFollowers();
      setNextCheck(formatDistanceToNow(Date.now() + CHECK_INTERVAL));
    }, CHECK_INTERVAL);

    if (Date.now() - lastCheck > CHECK_INTERVAL) {
      checkFollowers();
    } else {
      setNextCheck(formatDistanceToNow(lastCheck + CHECK_INTERVAL));
    }

    return () => clearInterval(interval);
  }, [checkFollowers, lastCheck]);

  const filteredProfiles = searchQuery
    ? profiles.filter(profile => 
        profile.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : profiles;

  const totalPages = Math.ceil(filteredProfiles.length / ITEMS_PER_PAGE);
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredProfiles.length);
  const currentProfiles = filteredProfiles.slice(startIndex, endIndex);

  const TABS = [
    { 
      id: 'followers', 
      label: 'All Followers', 
      icon: Users,
      count: totalFollowers 
    },
    { 
      id: 'following', 
      label: 'Following', 
      icon: Users,
      count: totalFollowing 
    },
    { 
      id: 'recent-followers', 
      label: 'Recent Followers', 
      icon: UserPlus,
      count: recentFollowers.length 
    },
    { 
      id: 'recent-unfollowers', 
      label: 'Recent Unfollowers', 
      icon: UserMinus,
      count: recentUnfollowers.length 
    },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex flex-wrap gap-4 mb-6">
        {TABS.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as ListType)}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
              activeTab === id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            <Icon className="w-4 h-4 mr-2" />
            <span className="mr-2">{label}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === id
                ? 'bg-white text-indigo-600'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-6">
        <SearchBar 
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name, handle, or bio..."
        />
      </div>

      <div className="flex items-center justify-end mb-4 text-sm text-gray-500">
        <Clock className="w-4 h-4 mr-2" />
        <span>Next check: {nextCheck}</span>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : filteredProfiles.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {searchQuery 
            ? 'No results found'
            : activeTab === 'recent-followers' 
              ? 'No recent followers yet'
              : activeTab === 'recent-unfollowers'
                ? 'No recent unfollowers'
                : activeTab === 'followers'
                  ? 'No followers yet'
                  : 'Not following anyone yet'}
        </div>
      ) : (
        <>
          <div className="bg-gray-100 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">
              {searchQuery 
                ? `Found ${filteredProfiles.length} matches`
                : `Showing ${startIndex + 1}-${endIndex} of ${filteredProfiles.length} ${activeTab}`}
            </p>
          </div>

          <div className="space-y-6">
            {currentProfiles.map((profile, index) => (
              <UserProfile 
                key={`${profile.did}-${activeTab}-${index}`} 
                handle={profile.handle} 
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-4 py-2 rounded-lg ${
                    page === pageNum
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}