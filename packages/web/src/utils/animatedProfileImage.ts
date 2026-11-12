/** Detect animated image containers before the still-image cropper can discard their frames. */
export async function isAnimatedProfileImage(file: File): Promise<boolean> {
  const name = file.name.toLowerCase();
  if (file.type === 'image/gif' || name.endsWith('.gif') || file.type === 'image/apng' || name.endsWith('.apng')) return true;
  const read = async (offset: number, length: number) => new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());
  const text = (data: Uint8Array, offset: number) => String.fromCharCode(...data.subarray(offset, offset + 4));
  const header = await read(0, 21);

  if (header.length >= 21 && text(header, 0) === 'RIFF' && text(header, 8) === 'WEBP') {
    return text(header, 12) === 'VP8X' && (header[20]! & 0x02) !== 0;
  }

  if (header[0] !== 137 || text(header, 1) !== 'PNG\r') return false;
  // APNG requires an animation control chunk before the first image data chunk.
  // Skip large metadata chunks by reading their headers only.
  for (let offset = 8; offset + 12 <= file.size;) {
    const chunk = await read(offset, 8);
    const type = text(chunk, 4);
    if (type === 'acTL') return true;
    if (type === 'IDAT' || type === 'IEND') return false;
    offset += new DataView(chunk.buffer).getUint32(0) + 12;
  }
  return false;
}
