interface TruncatedTextProps {
  text: string | null;
}

export const TruncatedText = ({ text }: TruncatedTextProps) => {
  return (
    <span className="truncated-text" title={text ?? undefined}>
      {text}
    </span>
  );
};
