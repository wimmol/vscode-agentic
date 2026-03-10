import type { CSSProperties } from 'react';

const truncateStyle: CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 1,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

interface TruncatedTextProps {
  text: string;
}

export const TruncatedText = ({ text }: TruncatedTextProps) => {
  return (
    <span className="truncated-text" style={truncateStyle} title={text}>
      {text}
    </span>
  );
};
