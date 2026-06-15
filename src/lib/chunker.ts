interface Chunk {
  text: string;
  index: number;
}

interface ChunkOptions {
  targetWords?: number;
  overlapWords?: number;
}

/**
 * Splits document text into overlapping chunks.
 * Attempts to preserve paragraph boundaries.
 */
export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
  const targetWords = options.targetWords || 225; // Roughly 300 tokens
  const overlapWords = options.overlapWords || 35; // Roughly 15% overlap

  if (!text || !text.trim()) {
    return [];
  }

  const chunks: Chunk[] = [];
  
  // Normalize newlines
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  let currentChunkWords: string[] = [];
  let chunkIndex = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const paragraphWords = paragraph.split(/\s+/);

    // If a single paragraph is extremely long, chunk it by sentences or word counts
    if (paragraphWords.length > targetWords + overlapWords) {
      // Flush current chunk first if it has content
      if (currentChunkWords.length > 0) {
        chunks.push({
          text: currentChunkWords.join(" "),
          index: chunkIndex++
        });
        currentChunkWords = [];
      }

      // Chunk the giant paragraph
      let startIdx = 0;
      while (startIdx < paragraphWords.length) {
        const endIdx = Math.min(startIdx + targetWords, paragraphWords.length);
        const chunkSlice = paragraphWords.slice(startIdx, endIdx);
        
        chunks.push({
          text: chunkSlice.join(" "),
          index: chunkIndex++
        });

        // Slide window by targetWords - overlapWords
        startIdx += (targetWords - overlapWords);
        
        // Safety exit to prevent infinite loops
        if (startIdx >= paragraphWords.length || targetWords <= overlapWords) {
          break;
        }
      }
      continue;
    }

    // Normal paragraph grouping
    if (currentChunkWords.length + paragraphWords.length <= targetWords) {
      currentChunkWords.push(...paragraphWords);
    } else {
      // Flush current chunk
      if (currentChunkWords.length > 0) {
        chunks.push({
          text: currentChunkWords.join(" "),
          index: chunkIndex++
        });
      }

      // Create overlap: take the trailing words from the previous chunk
      const overlapStart = Math.max(0, currentChunkWords.length - overlapWords);
      const overlapSlice = currentChunkWords.slice(overlapStart);

      // Start new chunk with overlap + current paragraph
      currentChunkWords = [...overlapSlice, ...paragraphWords];
    }
  }

  // Flush any remaining words
  if (currentChunkWords.length > 0) {
    chunks.push({
      text: currentChunkWords.join(" "),
      index: chunkIndex++
    });
  }

  return chunks;
}
