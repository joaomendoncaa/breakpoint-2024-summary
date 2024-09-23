import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { $ } from "bun";

interface VideoInfo {
  title: string;
  participants: string[];
  link: string;
}

async function getPlaylistData(url: string): Promise<string[]> {
  console.log("Fetching playlist data from:", url);

  $.nothrow();

  const { stdout, stderr, success } =
    await $`yt-dlp --flat-playlist --abort-on-error --extractor-retries 3 --no-warnings --skip-unavailable-fragments --print "%(title)s %(url)s" "${url}"`;

  console.log("yt-dlp output:", stdout);

  if (success && typeof stdout === "string") {
    console.log("Successfully fetched playlist data");
    return stdout.trim().split("\n");
  }
}

function parseDlpData(videoData: string[]): VideoInfo[] {
  return videoData.map((line) => {
    const [titlePart, url] = line.split(" https://");
    const titleComponents = titlePart.split(":");

    // Extract event name, talk type, and content
    const event = titleComponents[0].trim(); // "Breakpoint 2024"
    const talkType = titleComponents[1].trim(); // "Keynote", "Workshop", etc.
    const talkContent = titleComponents[2].trim(); // "The Solana Network State"

    // Extract participants
    const participantsMatch = talkContent.match(/\(([^)]+)\)/);
    let participants: string[] = [];
    if (participantsMatch) {
      participants = participantsMatch[1]
        .split(",")
        .map((name) => name.trim().replace(/\s+/g, "").toLowerCase()); // Clean up names
    }

    // Create the short title using type and content
    const shortTitle = `${event.slice(0, 2).toLowerCase()}24-${talkType.toLowerCase()}-${talkContent
      .toLowerCase()
      .split(" ")
      .join("-")
      .replace(/[^\w-]/g, "")}`;

    return {
      title: shortTitle,
      participants,
      link: `https://${url}`,
    };
  });
}

async function summarize(text: string): Promise<string> {
  try {
    const output =
      await $`ollama run llama3.1:8B "Summarize the following text:\n\n${text}"`.text();
    console.log(output);
    return output;
  } catch (err) {
    console.log(`Failed with code ${err.exitCode}`);
    console.log(err.stdout.toString());
    console.log(err.stderr.toString());
  }
}

async function getEpisodeAudio(title: string, link: string): Promise<void> {
  await $`yt-dlp -x --audio-format mp3 -o './data/audio/${title}.mp3' "${link}"`;
}

async function getEpisodeTranscriptions(path: string): Promise<void> {
  await $`whisper ${path} --model medium --output_format json --output_dir ./data/transcriptions/ --language en`;
}

async function main(): Promise<void> {
  // const PLAYLIST_URL =
  //   "https://youtube.com/playlist?list=PLilwLeBwGuK7YY8igEkLeFcpdoFRJAa0L&si=A0M2X_3aQDD2FMO2";

  // const playlistData = await getPlaylistData(PLAYLIST_URL);
  // const parsedData = parseDlpData(playlistData);

  // Bun.write("talks.json", JSON.stringify(parsedData, null, 2));
  console.log("Successfully written data");

  const talks = [
    {
      title: "the-solana-network-state",
      category: "fireside",
      participants: ["@rajgokal", "@balajis"],
      link: "https://youtu.be/WwVv_kWS_B8?si=_dgEw65RBox4rE-j",
    },
    {
      title: "solana-seeker",
      category: "keynote",
      participants: ["Emmett Hollyer"],
      link: "https://youtu.be/W7hKbYI0t9U?si=fBM-qYNIucgE0UQy",
    },
  ];

  for (const talk of talks) {
    const { title, link } = talk;

    console.log("Downloading audio:", title);
    const isAudioExists = existsSync(`data/audio/${title}.mp3`);
    if (!isAudioExists) await getEpisodeAudio(title, link);
    else console.log("Audio already exists:", title);

    console.log("Transcribing:", title);
    const isTranscriptionExists = existsSync(
      `data/transcriptions/${title}.json`,
    );
    if (!isTranscriptionExists)
      await getEpisodeTranscriptions(`data/audio/${title}.mp3`);
    else console.log("Transcription already exists:", title);

    const transcriptions = await Bun.file(
      `data/transcriptions/${title}.json`,
    ).text();

    const text = JSON.parse(transcriptions).text;
    const summary = await summarize(text);

    console.log("Summary:", summary);
  }
}

main().catch((error) => {
  console.error("Error occurred:", error.message);
});
