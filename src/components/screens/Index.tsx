import React from 'react';
import VRPlayer from '../domain/vr/VRPlayer';

const Index: React.FC = () => {
  return (
    <VRPlayer src="https://firebasestorage.googleapis.com/v0/b/addittest-player.firebasestorage.app/o/drug.mp4?alt=media&token=55fbbe08-7313-4d01-bb1c-26aa071128aa" />
  );
};

export default Index;
