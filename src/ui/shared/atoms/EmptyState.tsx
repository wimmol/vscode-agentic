interface EmptyStateProps {
  text: string;
}

export const EmptyState = ({ text }: EmptyStateProps) => {
  return <p className="empty-state">{text}</p>;
};
