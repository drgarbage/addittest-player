import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { VideoTexture, SphereGeometry } from 'three';
import { ref, onValue, set } from 'firebase/database';
import { useDatabase } from '~/lib/firebase';

interface VRPlayerProps {
  sessionKey: string;
}

interface PlaybackSession {
  'playback-command': 'NONE' | 'PLAY' | 'STOP' | 'PAUSE' | 'PROCEEDED';
  'playback-state': 'INITIAL' | 'PLAYING' | 'PAUSED' | 'STOPPED' | 'ENDED';
}

const VRPlayer: React.FC<VRPlayerProps> = ({ sessionKey }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [session, setSession] = useState<PlaybackSession | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);

  useEffect(() => {
    const database = useDatabase();
    const sessionRef = ref(database, `sessions/${sessionKey}`);
    
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      setSession(data);
      
      if (videoRef.current && userInteracted) {
        handlePlaybackCommand(data['playback-command'], sessionRef);
      }
    });

    return () => unsubscribe();
  }, [sessionKey, userInteracted]);

  const handlePlaybackCommand = async (command: string, sessionRef: any) => {
    try {
      switch (command) {
        case 'NONE':
          // NONE 命令不需要执行任何操作
          break;
        case 'PLAY':
          if (!userInteracted) {
            setVideoError('请点击开始按钮开始播放');
            return;
          }
          if (videoRef.current?.readyState >= 2) {
            await videoRef.current.play();
            await set(sessionRef, {
              ...session,
              'playback-command': 'PROCEEDED',
              'playback-state': 'PLAYING'
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
            'playback-command': 'PROCEEDED',
            'playback-state': 'STOPPED'
          });
          break;
        case 'PAUSE':
          videoRef.current?.pause();
          await set(sessionRef, {
            ...session,
            'playback-command': 'PROCEEDED',
            'playback-state': 'PAUSED'
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
    if (videoRef.current) {
      videoRef.current.play().catch((error) => {
        setVideoError(`播放错误: ${error.message}`);
      });
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div className='w-dvw h-dvh flex items-center justify-center'>
      <video
        ref={videoRef}
        className='display-none'
        crossOrigin="anonymous"
        playsInline
        src="/videos/demo.mp4"
        onError={(e) => {
          const error = (e.target as HTMLVideoElement).error;
          setVideoError(`视频加载错误: ${error?.message}`);
        }}
        onLoadedData={() => setVideoError(null)}
      />
      <Canvas className='bg-black'>
        <mesh>
          <sphereGeometry args={[500]} />
          <meshBasicMaterial>
            {videoRef.current && (
              <videoTexture attach="map" args={[videoRef.current]} />
            )}
          </meshBasicMaterial>
        </mesh>
      </Canvas>
      {!userInteracted && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-50">
          <button
            onClick={handleStart}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            点击开始播放
          </button>
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