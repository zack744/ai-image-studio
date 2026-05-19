import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function base64ToDataURI(base64: string, fmt = "png") {
	return `data:image/${fmt};base64,${base64}`;
}

export async function fetchUrlToDataURI(url: string) {
	const resp = await fetch(url);
	if (!resp.ok) {
		throw new Error(`Failed to fetch URL: ${url}, status: ${resp.status}`);
	}

	const arrayBuffer = await resp.arrayBuffer();
	const uint8Array = new Uint8Array(arrayBuffer);
	const binaryString = Array.from(uint8Array, (byte) => String.fromCharCode(byte)).join("");
	const base64 = btoa(binaryString);
	return base64ToDataURI(base64);
}
