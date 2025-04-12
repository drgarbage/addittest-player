import React, { useEffect, useRef, useState } from 'react';
import { set } from 'firebase/database';
import { setDoc, watchDoc } from '~/lib/firebase';
import { genToken } from '~/lib/utils';
import { VideoTypes } from './VideoTypes';

interface VRPlayerProps {
  src: string;
}

interface PlaybackSession {
  pin: string;
  token: string;
  app: 'PENDING' | 'CONNECTED' | 'DISCONNECTED';
  player: 'PENDING' | 'CONNECTED' | 'DISCONNECTED';
  command: 'NONE' | 'PLAY' | 'STOP' | 'PAUSE' | 'PROCEEDED';
  state: 'INITIAL' | 'PLAYING' | 'PAUSED' | 'STOPPED' | 'ENDED';
}

const VRPlayer: React.FC<VRPlayerProps> = ({src}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [pinCode, setPinCode] = useState<string | null>(null);
  const [sessionDocRef, setSessionDocRef] = useState<any>(null);
  const [session, setSession] = useState<PlaybackSession | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoType = VideoTypes[0];

  const newPinCode = async () => {
    localStorage.removeItem('pin');
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const token = genToken(pin) ?? 'UNKNOWN';
    const session: PlaybackSession = {
      pin, token, command: 'NONE', state: 'INITIAL', player: 'PENDING', app: 'PENDING'
    };
    await setDoc(token, session);
    localStorage.setItem('pin', pin);
    return pin;
  }

  const refreshPin = async () => {
    const pin = await newPinCode();
    
    setPinCode(pin);
  }

  const loadPin = async () => {
    let pin = localStorage.getItem('pin');

    if (!pin) {
      pin = await newPinCode();
    }

    setPinCode(pin);
  }

  const handlePlaybackCommand = (command: string) => {
    try {
      switch (command) {
        case 'NONE':
          break;
        case 'PLAY':
          videoRef.current?.play();
          break;
        case 'STOP':
          videoRef.current?.pause();
          videoRef.current!.currentTime = 0;
          break;
        case 'PAUSE':
          videoRef.current?.pause();
          break;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setVideoError(`播放错误: ${errorMessage}`);
      console.error('视频播放错误:', error);
    }
  };

  const handlePlaybackChanged = async (state:'INITIAL' | 'PLAYING' | 'PAUSED' | 'STOPPED' | 'ENDED') => {
    if (!sessionDocRef) return;
    await set(sessionDocRef, {
      ...session,
      'command': 'PROCEEDED',
      'state': state
    });
  };

  const requestVideoElement = async () : Promise<HTMLVideoElement> => {
    return new Promise((resolve, reject) => {
      if(videoRef.current && videoLoaded) {
        return resolve(videoRef.current);
      }

      if (videoRef.current && !videoLoaded) {
        videoRef.current.onloadeddata = () => {
          setVideoLoaded(true);
          resolve(videoElement);
        }
      }

      setVideoLoaded(false);
      const videoElement = document.createElement('video');
      videoRef.current = videoElement;
      videoElement.src = src;
      videoElement.crossOrigin = 'anonymous';
      videoElement.onerror = (e) => {
        const target = (e as Event).target as HTMLVideoElement;
        const error = target.error;
        reject(new Error(`视频加载错误: ${error?.message}`));
      };
      videoElement.addEventListener('play', () => handlePlaybackChanged('PLAYING'));
      videoElement.addEventListener('pause', () => handlePlaybackChanged('PAUSED'));
      videoElement.addEventListener('ended', () => handlePlaybackChanged('ENDED'));
      videoElement.onloadeddata = async () => {
        await videoElement.play();
        await videoElement.pause();
        videoElement.currentTime = 0;
        setVideoLoaded(true);
        resolve(videoElement);
      }
    });
  }

  const requestImmersive = async () => {
    try {
      setVideoError(null);
      let canContinue = true;
      const videoElement = await requestVideoElement();
      if (!videoElement) throw new Error('無法開啟影片');
      const xrSession = await navigator.xr?.requestSession("immersive-vr", { optionalFeatures: ["layers"] });
      if (!xrSession) throw new Error("不支援 WebXR");
      const xrSpace = await xrSession?.requestReferenceSpace("local");
      if (!xrSpace) throw new Error("不支援 WebXR");
      const xrMediaFactory = new XRMediaBinding(xrSession);
      const layerConfig = {space: xrSpace, ...videoType.config};
      const xrLayer = (videoType.method === 'createCylinderLayer') ? 
        xrMediaFactory.createCylinderLayer(videoElement, layerConfig) :
        xrMediaFactory.createEquirectLayer(videoElement, layerConfig);
      xrSession.updateRenderState({ layers: [xrLayer] });
      const renderLoop = (time: DOMHighResTimeStamp, frame: XRFrame) => {
        if (!canContinue) return;
        frame.session.requestAnimationFrame(renderLoop);
      };
      xrSession.addEventListener('end', () => {
        videoRef.current?.pause();
        canContinue = false;
      });
      xrSession.requestAnimationFrame(renderLoop);
    } catch (error: any) {
      console.error('错误:', error);
      setVideoError(`错误: ${error?.message ?? '未知错误'}`);
    }
  };

  const handleEnterImmersive = () => {
    // setUserInteracted(true);
    requestImmersive();
  };

  useEffect(() => { loadPin() }, []);

  useEffect(() => {
    if(!pinCode) return;
    const token = genToken(pinCode) ?? 'UNKNOWN';
    const unsubscribe = watchDoc(token, (sessionRef, data) => {
      setSessionDocRef(sessionRef);
      setSession(data);
      handlePlaybackCommand(data.command);
    });
    return () => unsubscribe();
  }, [pinCode]);
  

  return (
    <div className='w-dvw h-dvh flex flex-col items-center justify-center bg-gray-900'>

      { session?.app !== 'CONNECTED' && 
      
        <div className="border border-4 border-white text-white rounded-3xl flex flex-col items-center p-8 space-y-6">
          <div className="text-lg text-center">請告訴檢測人員以下號碼</div>
          <div className="text-center text-[96px] font-bold tracking-widest">{pinCode}</div>
          <div className="text-center text-white bg-red-900 rounded-xl w-full p-4 animate-pulse">正在等候連線</div>
        </div>
        
      }

      { session?.app === 'CONNECTED' &&
        <div onClick={handleEnterImmersive} className="flex flex-col justify-center aspect-video border border-4 border-white rounded-3xl p-8 hover:bg-blue-900">
          <span className="text-white font-bold text-[96px]">我準備好了</span>
        </div>
      }
      
      <div onClick={refreshPin} className="text-white text-center text-sm mt-4 cursor-pointer">變更其他號碼</div>

      {videoError && (
        <div className="w-full flex items-center justify-center text-red-500">
          {videoError}
        </div>
      )}

    </div>
  );
};

export default VRPlayer;