interface ActionButtonProps {
	icon: string;
	title: string;
	disabled?: boolean;
	onClick: () => void;
}

export function ActionButton({ icon, title, disabled, onClick }: ActionButtonProps) {
	return (
		<button
			className="action-button"
			title={title}
			disabled={disabled}
			onClick={(e) => {
				e.stopPropagation();
				if (!disabled) onClick();
			}}
		>
			<span className={`codicon codicon-${icon}`} />
		</button>
	);
}
