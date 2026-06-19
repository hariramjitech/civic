import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import api, { setAuthToken, setGetTokenFn } from '../lib/api';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import toast from 'react-hot-toast';

const CivicContext = createContext(null);

export const CivicProvider = ({ children }) => {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { user } = useUser();
  const [userProfile, setUserProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [socket, setSocket] = useState(null);

  const fetchProfile = async () => {
    try {
      setLoadingProfile(true);
      const res = await api.get('/auth/me');
      setUserProfile(res.data);
      
      // Initialize socket once we have the user profile
      const sk = connectSocket(userId || res.data.clerkId);
      setSocket(sk);
    } catch (err) {
      console.error('Failed to sync profile with database:', err);
      // Soft fail, user may not be in DB yet or server is slow
      if (err.response?.status === 401) {
        toast.error('Session expired. Please sign in again.');
      }
    } finally {
      setLoadingProfile(false);
    }
  };

  // Sync Clerk token getter with Axios interceptor when signed in state changes
  useEffect(() => {
    const syncToken = async () => {
      if (!isLoaded) return;

      if (isSignedIn) {
        setLoadingProfile(true);
        try {
          // Register the live getToken fn so interceptor always gets a fresh JWT
          setGetTokenFn(getToken);
          await fetchProfile();
        } catch (err) {
          console.error('Failed to sync Clerk token:', err);
          setLoadingProfile(false);
        }
      } else {
        setUserProfile(null);
        setLoadingProfile(false);
        disconnectSocket();
        setSocket(null);
        // Clear the token getter on sign-out
        setGetTokenFn(null);
        setAuthToken(null);
      }
    };

    syncToken();

    return () => {
      disconnectSocket();
    };
  }, [isLoaded, isSignedIn, userId, getToken]);

  const updateDistrict = async (district) => {
    try {
      const res = await api.patch('/auth/profile', { district });
      if (res.data.success) {
        setUserProfile(prev => prev ? { ...prev, district } : null);
        toast.success(`District updated to ${district}`);
        return true;
      }
    } catch (err) {
      console.error('Error updating district:', err);
      toast.error('Failed to update district.');
    }
    return false;
  };

  return (
    <CivicContext.Provider
      value={{
        userProfile,
        role: userProfile?.role || 'citizen',
        userDistrict: userProfile?.district || '',
        loadingProfile,
        fetchProfile,
        socket,
        updateDistrict,
        isSignedIn,
        clerkUser: user,
      }}
    >
      {children}
    </CivicContext.Provider>
  );
};

export const useCivic = () => {
  const context = useContext(CivicContext);
  if (!context) {
    throw new Error('useCivic must be used within a CivicProvider');
  }
  return context;
};
