import React from 'react';
import VRPlayer from '../domain/vr/VRPlayer';

const Player: React.FC = () => {
  return <VRPlayer src="/videos/drug/drug.m3u8" />;
};

export default Player; 