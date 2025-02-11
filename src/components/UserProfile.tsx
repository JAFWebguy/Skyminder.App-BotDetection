import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../lib/store';
import { ProfileViewDetailed } from '@atproto/api/dist/client/types/app/bsky/actor/defs';
import { UserX, Users, VolumeX, Volume2, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Modal } from './Modal';

interface UserProfileProps {
  handle: string;
  isModal?: boolean;
}

export function UserProfile({ handle, isModal = false }: UserProfileProps) {
  const [profile, setProfile] = useState<ProfileViewDetailed | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { agent, muteList, updateMuteList, executeWithRateLimit } = useAuthStore();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!agent) return;
      setLoading(true);
      setError(null);
      
      try {
        const result = await executeWithRateLimit(`profile-${handle}`, async () => {
          const response = await agent.getProfile({ actor: handle });
          return response.data;
        });
        
        setProfile(result);
        setIsMuted(muteList.includes(result.did));
      } catch (error: any) {
        const errorMessage = error.message || 'Failed to load profile';
        setError(errorMessage);
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [handle, agent, muteList, executeWithRateLimit]);

  const refreshProfile = async () => {
    if (!agent) return;
    try {
      const result = await executeWithRateLimit(`profile-refresh-${handle}`, async () => {
        const response = await agent.getProfile({ actor: handle });
        return response.data;
      });
      setProfile(result);
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    }
  };

  const handleFollow = async () => {
    if (!agent || !profile || isProcessing) return;
    setIsProcessing(true);
    try {
      await executeWithRateLimit(`follow-${handle}`, async () => {
        if (profile.viewer?.following) {
          await agent.deleteFollow(profile.viewer.following);
          toast.success(`Unfollowed @${profile.handle}`);
        } else {
          await agent.follow(profile.did);
          toast.success(`Followed @${profile.handle}`);
        }
      });
      await refreshProfile();
    } catch (error: any) {
      const errorMessage = error.message || 'Follow action failed';
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBlock = async () => {
    if (!agent || !profile || isProcessing) return;
    setIsProcessing(true);
    try {
      await executeWithRateLimit(`block-${handle}`, async () => {
        if (profile.viewer?.blocking) {
          const rkey = profile.viewer.blocking.split('/').pop();
          if (!rkey) throw new Error('Invalid block record');
          
          await agent.com.atproto.repo.deleteRecord({
            repo: agent.session!.did,
            collection: 'app.bsky.graph.block',
            rkey: rkey
          });
          
          toast.success(`Unblocked @${profile.handle}`);
        } else {
          const response = await agent.com.atproto.repo.createRecord({
            repo: agent.session!.did,
            collection: 'app.bsky.graph.block',
            record: {
              $type: 'app.bsky.graph.block',
              subject: profile.did,
              createdAt: new Date().toISOString()
            }
          });
          
          if (!response.success) {
            throw new Error('Block action failed');
          }
          
          toast.success(`Blocked @${profile.handle}`);
        }
      });
      await refreshProfile();
    } catch (error: any) {
      const errorMessage = error.message || 'Block action failed';
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMute = async () => {
    if (!agent || !profile || isProcessing) return;
    setIsProcessing(true);
    try {
      await executeWithRateLimit(`mute-${handle}`, async () => {
        if (isMuted) {
          await agent.app.bsky.graph.unmuteActor({ actor: profile.did });
          const newMuteList = muteList.filter(did => did !== profile.did);
          updateMuteList(newMuteList);
          setIsMuted(false);
          toast.success(`Unmuted @${profile.handle}`);
        } else {
          await agent.app.bsky.graph.muteActor({ actor: profile.did });
          const newMuteList = [...muteList, profile.did];
          updateMuteList(newMuteList);
          setIsMuted(true);
          toast.success(`Muted @${profile.handle}`);
        }
      });
    } catch (error: any) {
      const errorMessage = error.message || 'Mute action failed';
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-gray-200 h-20 w-20"></div>
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto">
        <div className="text-center text-red-600">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto">
        <div className="text-center text-gray-600">
          Profile not found
        </div>
      </div>
    );
  }

  const getFollowButtonText = () => {
    if (profile.viewer?.following) return 'Unfollow';
    if (profile.viewer?.followedBy) return 'Follow Back';
    return 'Follow';
  };

  const handleAvatarClick = () => {
    if (!isModal) {
      window.open(`https://bsky.app/profile/${handle}`, '_blank');
    }
  };

  const profileContent = (
    <div className={`bg-white rounded-xl ${!isModal && 'shadow-lg'} p-6 max-w-2xl mx-auto`}>
      <div className="flex items-start space-x-4">
        <div className="relative group">
          <a
            href={`https://bsky.app/profile/${handle}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!isModal) {
                e.preventDefault();
                handleAvatarClick();
              }
            }}
            className="block"
          >
            <img
              src={profile.avatar}
              alt={profile.displayName}
              className="w-20 h-20 rounded-full hover:opacity-90 transition-opacity"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="w-6 h-6 text-white" />
            </div>
          </a>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold truncate">{profile.displayName}</h2>
            <a
              href={`https://bsky.app/profile/${profile.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-700 flex-shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <p className="text-gray-600 truncate">@{profile.handle}</p>
          {profile.description && (
            <p className="mt-2 text-gray-700 text-sm line-clamp-2">{profile.description}</p>
          )}
          <div className="flex items-center space-x-4 mt-4">
            <div className="flex items-center">
              <Users className="w-4 h-4 mr-1" />
              <span className="text-sm">
                <b>{profile.followersCount}</b> followers
              </span>
            </div>
            <div className="flex items-center">
              <Users className="w-4 h-4 mr-1" />
              <span className="text-sm">
                <b>{profile.followsCount}</b> following
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={handleFollow}
          disabled={isProcessing}
          className={`px-3 py-1.5 rounded-lg flex items-center text-xs ${
            profile.viewer?.following
              ? 'bg-gray-200 hover:bg-gray-300'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Users className="w-3.5 h-3.5 mr-1.5" />
          {getFollowButtonText()}
        </button>
        <button
          onClick={handleBlock}
          disabled={isProcessing}
          className={`px-3 py-1.5 rounded-lg flex items-center text-xs ${
            profile.viewer?.blocking
              ? 'bg-gray-200 hover:bg-gray-300'
              : 'bg-red-600 text-white hover:bg-red-700'
          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <UserX className="w-3.5 h-3.5 mr-1.5" />
          {profile.viewer?.blocking ? 'Unblock' : 'Block'}
        </button>
        <button
          onClick={handleMute}
          disabled={isProcessing}
          className={`px-3 py-1.5 rounded-lg flex items-center text-xs ${
            isMuted
              ? 'bg-gray-200 hover:bg-gray-300'
              : 'bg-orange-600 text-white hover:bg-orange-700'
          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isMuted ? (
            <>
              <Volume2 className="w-3.5 h-3.5 mr-1.5" />
              Unmute
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5 mr-1.5" />
              Mute
            </>
          )}
        </button>
        {profile.viewer?.followedBy && (
          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1.5 rounded-lg inline-flex items-center">
            Follows You
          </span>
        )}
      </div>
    </div>
  );

  return profileContent;
}