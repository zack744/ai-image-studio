import type { GenerateOptions, ImageProvider } from "./interface";

const SUBMIT_URL = "https://api.wuyinkeji.com/api/async/image_gpt";
const DETAIL_URL = "https://api.wuyinkeji.com/api/async/detail";
const DEFAULT_TIMEOUT_SECONDS = 300;
const POLL_INTERVAL_MS = 2000;

function aspectRatioToSize(aspectRatio?: string): string {
  switch (aspectRatio) {
    case "16:9": return "1920x1080";
    case "9:16": return "1080x1920";
    case "4:3": return "1600x1200";
    case "3:4": return "1200x1600";
    default: return "1024x1024";
  }
}

function extractTaskId(payload: any): string {
  const data = payload?.data;
  if (typeof data === "object" && data?.id) return String(data.id);
  if (payload?.id) return String(payload.id);
  throw new Error(`Suchuang submit response did not include a task id: ${JSON.stringify(payload)}`);
}

function extractImageUrl(data: any): string | null {
  if (typeof data === "string" && (data.startsWith("http://") || data.startsWith("https://"))) {
    return data;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const url = extractImageUrl(item);
      if (url) return url;
    }
  }
  if (typeof data === "object" && data !== null) {
    for (const key of ["url", "image_url", "imageUrl", "result", "result_url", "resultUrl", "data"]) {
      const url = extractImageUrl(data[key]);
      if (url) return url;
    }
  }
  return null;
}

function statusFromDetail(payload: any): number | null {
  const data = payload?.data;
  if (typeof data === "object" && data !== null) {
    const s = data.status;
    if (typeof s === "number") return s;
    if (typeof s === "string" && /^\d+$/.test(s)) return parseInt(s, 10);
  }
  const code = payload?.code;
  if (typeof code === "number") return code;
  if (typeof code === "string" && /^\d+$/.test(code)) return parseInt(code, 10);
  return null;
}

export const suchuangProvider: ImageProvider = {
  id: "suchuang",
  name: "速创AI",
  models: [{
    id: "suchuang-ai",
    name: "速创AI",
    ability: "t2i",
    supportedAspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
  }],

  async submit(prompt: string, options: GenerateOptions, apiKey: string): Promise<string> {
    const size = aspectRatioToSize(options.aspectRatio);

    const resp = await fetch(SUBMIT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": apiKey,
      },
      body: JSON.stringify({ prompt, size }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Suchuang submit failed with status ${resp.status}: ${text}`);
    }

    const payload: any = await resp.json();
    return extractTaskId(payload);
  },

  async poll(taskId: string, apiKey: string): Promise<{ status: string; images?: string[]; error?: string }> {
    const url = `${DETAIL_URL}?key=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(taskId)}`;

    const resp = await fetch(url, {
      headers: { "Authorization": apiKey },
    });

    if (!resp.ok) {
      return { status: "failed", error: `Poll failed with status ${resp.status}` };
    }

    const payload: any = await resp.json();
    const status = statusFromDetail(payload);
    const imageUrl = extractImageUrl(payload?.data);

    // status 2 = completed with images (速创 API specific)
    const isCompletedStatus = status === 1 || status === 2 || status === 3 || status === 200 || status === null || status === undefined;

    if (imageUrl && isCompletedStatus) {
      return { status: "completed", images: [imageUrl] };
    }

    if (!imageUrl && isCompletedStatus) {
      return { status: "failed", error: "Task completed without image URL" };
    }

    return { status: "generating" };
  },
};
