import React from 'react';
import { useParams } from 'react-router-dom';
import VRPlayer from '../domain/vr/VRPlayer';

const Player: React.FC = () => {
  const { key } = useParams<{ key: string }>();

  if (!key) {
    return <div>Invalid session key</div>;
  }

  return <VRPlayer sessionKey={key} />;
};

export default Player; 