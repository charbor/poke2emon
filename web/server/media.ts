import { randomUUID } from "crypto";

interface MediaEntry {
  data: Buffer;
  mimeType: string;
}

const store = new Map<string, MediaEntry>();

export function storeMedia(base64: string, mimeType: string): string {
  const id = randomUUID();
  store.set(id, { data: Buffer.from(base64, "base64"), mimeType });
  return id;
}

export function getMedia(id: string): MediaEntry | undefined {
  return store.get(id);
}
