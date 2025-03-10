import React, { useEffect, useRef, useState } from 'react';
import { setDoc, updateDoc, watchDoc } from '~/lib/firebase';
import { SHA256 } from 'crypto-js';
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pinCode, setPinCode] = useState<string | null>(null);
  const [session, setSession] = useState<PlaybackSession | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const [videoType, setVideoType] = useState<any>(VideoTypes[0]);

  const genToken = (pin:string | null) => !!pin ? SHA256(pin).toString() : null;

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

  useEffect(() => { loadPin() }, []);

  useEffect(() => {
    if(!pinCode) return;
    const token = genToken(pinCode) ?? 'UNKNOWN';
    const unsubscribe = watchDoc(token, (sessionRef, data) => {
      setSession(data);

      if (videoRef.current && userInteracted) {
        handlePlaybackCommand(data.command, sessionRef);
      }
    });
    return () => unsubscribe();
  }, [pinCode, userInteracted]);

  const handlePlaybackCommand = async (command: string, sessionRef: any) => {
    try {
      switch (command) {
        case 'NONE':
          break;
        case 'PLAY':
          if (!userInteracted) {
            setVideoError('请点击开始按钮开始播放');
            return;
          }
          if (videoRef.current && videoRef.current.readyState >= 2) {
            await videoRef.current.play();
            await set(sessionRef, {
              ...session,
              'command': 'PROCEEDED',
              'state': 'PLAYING'
            });
          } else {
            setVideoError('视频尚未准备好播放');
          }
          break;
        case 'STOP':
          videoRef.current?.pause();
          videoRef.current!.currentTime = 0;
          await set(sessionRef, {
            ...session,
            'command': 'PROCEEDED',
            'state': 'STOPPED'
          });
          break;
        case 'PAUSE':
          videoRef.current?.pause();
          await set(sessionRef, {
            ...session,
            'command': 'PROCEEDED',
            'state': 'PAUSED'
          });
          break;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setVideoError(`播放错误: ${errorMessage}`);
      console.error('视频播放错误:', error);
    }
  };
  
  const handleEnded = async () => {
    const token = genToken(pinCode) ?? 'UNKNOWN';
    await updateDoc(token, {
      'command': 'NONE',
      'state': 'ENDED'
    });
    videoRef.current?.removeEventListener('ended', handleEnded);
  };

  const handleStart = async () => {
    setUserInteracted(true);
    setVideoError(null);

    try {

      if (!videoRef.current) throw new Error("影片元素不存在");
      const videoElement = videoRef.current;
      
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
        frame.session.requestAnimationFrame(renderLoop);
      };
      xrSession.requestAnimationFrame(renderLoop);
      videoElement.addEventListener('ended', handleEnded);
      await videoElement.play();
      await videoElement.pause();
      videoElement.currentTime = 0;
    } catch (error: any) {
      console.error('错误:', error);
      setVideoError(`错误: ${error?.message ?? '未知错误'}`);
    }
  
  };
  

  return (
    <div className='w-dvw h-dvh flex flex-col items-center justify-center bg-black'>
      <video
        ref={videoRef}
        crossOrigin="anonymous"
        controls
        playsInline
        src={src} 
        onError={(e) => {
          const error = (e.target as HTMLVideoElement).error;
          setVideoError(`视频加载错误: ${error?.message}`);
        }}
        onLoadedData={() => setVideoError(null)}
      />
      
      {!userInteracted && (
        <div className="absolute top-0 left-0 w-full h-1/2 flex flex-col items-center justify-center bg-black bg-opacity-50">

          <div className="bg-white p-4 rounded-lg flex flex-col items-center space-y-4">
          
          {session?.app !== 'CONNECTED' && (
            <>
            <div className="text-lg text-center">請在檢測軟體內輸入以下號碼</div>
            <div className="text-center text-6xl font-bold text-blue-500">{pinCode}</div>
            <button
              className={`px-6 py-3 w-full bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-200 disabled:text-gray-500`}
              disabled={true}
            >
              等候檢測軟體連線中...
            </button>
            </>
          )}

          {session?.app === 'CONNECTED' && (
            <>
            <div className="text-lg text-center">檢測軟體已連接</div>
            <div className="text-lg text-center font-bold">準備好開始測試了嗎?</div>

            {VideoTypes.map((type) => (
              <button
                key={type.name}
                onClick={() => setVideoType(type)}
                className={`px-6 py-3 w-full bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors ${videoType.name === type.name ? 'bg-blue-600' : ''}`}
              >
                {type.name}
              </button>
            ))}

            <button
              onClick={handleStart}
              className={`px-6 py-3 w-full bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-200 disabled:text-gray-500`}
              disabled={session?.app !== 'CONNECTED'}
            >
              我準備好了
            </button>
            </>
          )}

          </div>

          <div onClick={refreshPin} className="text-white text-center text-sm mt-4 cursor-pointer">變更其他號碼</div>

        </div>
      )}

      {videoError && (
        <div className="w-full flex items-center justify-center text-red-500">
          {videoError}
        </div>
      )}

    </div>
  );
};

export default VRPlayer;