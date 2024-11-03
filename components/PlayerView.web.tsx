import React, { useLayoutEffect, useRef } from "react";

interface PlayerViewProps {
  link: string;
}

const PlayerView = ({ link }: PlayerViewProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useLayoutEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.focus(); // Focus the iframe when component mounts
    }
  }, []);

  return (
    <div className="container" style={{ maxHeight: "80%" }}>
      <iframe
        ref={iframeRef}
        src={link}
        referrerPolicy="origin"
        allowFullScreen
        className="container"
        scrolling="no"
        autoFocus
        tabIndex={0}
        style={{ width: "100%", height: "100%", border: 0, alignSelf: "center", overflow: "hidden", resize: "vertical" }}
      />
    </div>
  );
};

export default PlayerView;
