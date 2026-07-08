import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    NetInfo.fetch().then(state => {
      setIsOnline(!!state.isConnected);
    });

    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  return isOnline;
};

export const checkNetworkStatus = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return !!state.isConnected;
};