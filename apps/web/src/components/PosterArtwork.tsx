import { useState } from 'react';

export function PosterArtwork({ artworkUrl, title }: {
  artworkUrl: string | null;
  title: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!artworkUrl || failed) {
    return <span className="poster-letter">{title.slice(0, 1).toUpperCase()}</span>;
  }
  return <img className="poster-image" src={artworkUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
