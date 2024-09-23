import { $ } from "bun";

function chunk(str: string, len: number): string[] {
  const chunks: string[] = [];

  let start = 0;

  while (start < str.length) {
    let end = start + len;
    if (end < str.length) {
      end = str.lastIndexOf(" ", end);
    }
    if (end === -1 || end <= start) {
      end = Math.min(start + len, str.length);
    }
    chunks.push(str.slice(start, end).trim());
    start = end;
  }

  return chunks;
}

async function sumChunk(chunk: string): Promise<string> {
  const prompt = `Summarize the following text:\n\n${chunk}`;

  try {
    const data = await $`ollama run llama3:8b "${prompt}"`.text();
    return data;
  } catch (error) {
    console.error("Error while summarizing chunk:", error);
    return "";
  }
}

async function sum(chunks: string[], maxLength = 500): Promise<string> {
  let g = "";

  for (const chunk of chunks) {
    const summary = await sumChunk(chunk);
    g += summary;
  }

  if (g.length > maxLength) {
    return await sum(g);
  }

  return await sumChunk(g);
}

async function main(): Promise<void> {
  const input = Bun.argv.includes("--input")
    ? Bun.argv[Bun.argv.indexOf("--input") + 1]
    : "hello prompt";

  const output = Bun.argv.includes("--output")
    ? Bun.argv[Bun.argv.indexOf("--output") + 1]
    : "./summary.txt";

  const chunks = chunk(input, 8000);
  console.log("Chunks:", chunks);
  const summary = await sum(chunks);

  Bun.write(output, summary);
  console.log(`Summary written to: ${output}`);
}

main().catch(console.error);
