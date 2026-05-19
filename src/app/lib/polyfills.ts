if (!globalThis.crypto?.randomUUID) {
	//@ts-ignore
	globalThis.crypto.randomUUID = () => {
		const bytes = new Uint8Array(16);
		globalThis.crypto.getRandomValues(bytes);
		bytes[6] = (bytes[6]! & 0x0f) | 0x40; // Set version to 4
		bytes[8] = (bytes[8]! & 0x3f) | 0x80; // Set variant to RFC4122
		return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
	};
}
