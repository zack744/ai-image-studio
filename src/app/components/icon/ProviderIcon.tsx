type ProviderIconProps = {
	provider?: string;
	type?: "mono" | "avatar" | "color" | "text" | "combined";
	size?: number;
	className?: string;
	model?: string;
};

export default function ProviderIcon({ provider, size = 16, className }: ProviderIconProps) {
	return <img src="/logo.png" alt={provider || "AI"} width={size} height={size} className={className} />;
}
