import React, { useEffect, useRef, useState } from 'react';
import { ref, onValue, set, Unsubscribe, DatabaseReference, update } from 'firebase/database';
import { useDatabase } from '~/lib/firebase';
import { SHA256 } from 'crypto-js';

const VideoTypes = [
  {
    "name": "VR 360 (2D)",
    "config": {
      "centralAngle": Math.PI * 2,
      "aspectRatio": 2.0,
      "layout": "mono"
    }
  },
  {
    "name": "VR 180 (2D)",
    "config": {
      "centralAngle": Math.PI,
      "aspectRatio": 1.0,
      "layout": "mono"
    }
  },
  {
    "name": "VR 3D 360 (Top-Bottom)",
    "config": {
      "centralAngle": Math.PI * 2,
      "aspectRatio": 1.0,
      "layout": "stereo-top-bottom"
    }
  },
  {
    "name": "VR 3D 360 (Left-Right)",
    "config": {
      "centralAngle": Math.PI * 2,
      "aspectRatio": 2.0,
      "layout": "stereo-left-right"
    }
  },
  {
    "name": "VR 3D 180 (Top-Bottom)",
    "config": {
      "centralAngle": Math.PI,
      "aspectRatio": 1.0,
      "layout": "stereo-top-bottom"
    }
  },
  {
    "name": "VR 3D 180 (Left-Right)",
    "config": {
      "centralAngle": Math.PI,
      "aspectRatio": 2.0,
      "layout": "stereo-left-right"
    }
  },
  {
    "name": "VR 360 (2D - Cylinder Layer)",
    "config": {
      "centralAngle": Math.PI * 2,
      "aspectRatio": 16.0 / 9.0,
      "layout": "mono"
    }
  },
  {
    "name": "VR 180 (2D - Cylinder Layer)",
    "config": {
      "centralAngle": Math.PI,
      "aspectRatio": 16.0 / 9.0,
      "layout": "mono"
    }
  }
];

interface VRPlayerProps {
}

interface PlaybackSession {
  pin: string;
  token: string;
  app: 'PENDING' | 'CONNECTED' | 'DISCONNECTED';
  player: 'PENDING' | 'CONNECTED' | 'DISCONNECTED';
  command: 'NONE' | 'PLAY' | 'STOP' | 'PAUSE' | 'PROCEEDED';
  state: 'INITIAL' | 'PLAYING' | 'PAUSED' | 'STOPPED' | 'ENDED';
}

const setDoc = async (index: string, data: any) => {
  const db = useDatabase();
  const docRef = ref(db, `sessions/${index}`);
  await set(docRef, data);
}

const updateDoc = async (index: string, changes: any) => {
  const db = useDatabase();
  const docRef = ref(db, `sessions/${index}`);
  await update(docRef, changes);
}

const watchDoc = (index: string, callback: (ref: DatabaseReference, data: any) => void): Unsubscribe => {
  const db = useDatabase();
  const docRef = ref(db, `sessions/${index}`);
  return onValue(docRef, (snapshot) => {
    callback(docRef, snapshot.val());
  });
}

const VRPlayer: React.FC<VRPlayerProps> = ({}) => {
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

  useEffect(() => {
    if (videoRef.current) {
      const handleEnded = async () => {
        const token = genToken(pinCode) ?? 'UNKNOWN';
        await updateDoc(token, {
          'command': 'NONE',
          'state': 'ENDED'
        });
      };

      videoRef.current.addEventListener('ended', handleEnded);

      return () => {
        videoRef.current?.removeEventListener('ended', handleEnded);
      };
    }
  }, [pinCode]);

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
  const handleStart = () => {
    setUserInteracted(true);
    setVideoError(null);
  
    navigator.xr?.requestSession("immersive-vr", { optionalFeatures: ["layers"] }) // ✅ 啟用 WebXR Layers
      .then(async (xrSession: XRSession) => {
        if (!videoRef.current) return;
  
        const videoElement = videoRef.current;
        videoElement.src = "/videos/demo.mp4";
        videoElement.load();
  
        await videoElement.play(); // 確保影片在用戶互動後播放
  
        // **請求 XR 空間**
        xrSession.requestReferenceSpace("local").then((xrSpace:any) => { // ✅ 使用 'local' 參考空間
          try {
            let xrMediaFactory = new XRMediaBinding(xrSession);
            let layer = xrMediaFactory.createCylinderLayer(videoElement, { 
              space: xrSpace,  // ✅ 這裡改成獲取的 XRSpace
              layout: videoType.config.layout,   // ✅ 使用適當的影片格式
              aspectRatio: videoType.config.aspectRatio, // ✅ 使用適當的影片格式
              centralAngle: videoType.config.centralAngle, // ✅ 使用適當的影片格式
            });
  
            xrSession.updateRenderState({ layers: [layer] });
  
            // 確保 WebXR 會持續渲染
            const renderLoop = (time: DOMHighResTimeStamp, frame: XRFrame) => {
              xrSession.updateRenderState({ layers: [layer] });
              xrSession.requestAnimationFrame(renderLoop);
            };
            xrSession.requestAnimationFrame(renderLoop);
  
            videoElement.play().catch((error) => {
              setVideoError(`播放错误: ${error.message}`);
            });
  
          } catch (error) {
            setVideoError(`播放错误: XRMediaBinding 失敗: ${(error as Error).message}`);
          }
        });
  
      })
      .catch((error: Error) => setVideoError(`播放错误: 不支援 WebXR 播放: ${error.message}`));
  };
  

  return (
    <div className='w-dvw h-dvh flex flex-col items-center justify-center bg-blue-500'>
      <video
        ref={videoRef}
        crossOrigin="anonymous"
        playsInline
        src="/videos/drug_injected.mp4"
        controls
        onError={(e) => {
          const error = (e.target as HTMLVideoElement).error;
          setVideoError(`视频加载错误: ${error?.message}`);
        }}
        onLoadedData={() => setVideoError(null)}
      />
      {!userInteracted && (
      <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-black bg-opacity-50">

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
      <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center text-red-500">
        {videoError}
      </div>
      )}
    </div>
  );
};

export default VRPlayer;