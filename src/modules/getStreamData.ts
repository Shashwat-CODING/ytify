import { playButton } from "../lib/dom";
import { store } from "../lib/store";
import { notify } from "../lib/utils";

interface Piped {
  title: string;
  uploader: string;
  duration: number;
  uploaderUrl: string;
  category: string;
  liveStream: boolean;
  subtitles: any[];
  relatedStreams: RelatedStream[];
  audioStreams: AudioStream[];
}

interface RelatedStream {
  url: string;
  title: string;
  uploaderName: string;
  duration: number;
  uploaderUrl: string;
  type: string;
}

interface AudioStream {
  url: string;
  bitrate: number;
  codec: string;
  contentLength: string;
  quality: string;
  mimeType: string;
}

export async function getData(id: string): Promise<Piped> {
  const apis = [
    { name: 'PipedAPI', fetch: fetchPipedApiUrl },
    { name: 'SecondPipedAPI', fetch: fetchSecondPipedApiUrl },
    { name: 'AceThinkerAPI', fetch: fetchAceThinkerApiUrl },
    { name: 'NewAPI', fetch: fetchNewApiUrl },
    { name: 'CobaltAPI', fetch: fetchCobaltApiUrl },
    { name: 'YtdlOnlineAPI', fetch: fetchYtdlOnlineUrl }
  ];

  for (let attempt = 0; attempt < 3; attempt++) {
    for (const api of apis) {
      try {
        console.log(`Attempting to fetch from ${api.name}...`);
        const data = await api.fetch(id);
        if (data) {
          console.log(`Success! ${api.name} returned valid data.`);
          return formatData(data, api.name);
        } else {
          console.log(`${api.name} did not return valid data.`);
        }
      } catch (error) {
        console.error(`Error fetching from ${api.name}:`, error);
      }
    }
    console.log(`Retrying in ${attempt + 1} seconds...`);
    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
  }

  // If all attempts fail
  if (store.stream.id === id) {
    playButton.classList.replace(playButton.className, 'ri-stop-circle-fill');
    notify('Could not retrieve stream data in any way. Please try again later.');
  }
  throw new Error('All APIs failed to provide valid data');
}

async function fetchPipedApiUrl(videoId: string): Promise<any> {
  const response = await fetch(`https://pipedapi.reallyaweso.me/streams/${videoId}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

async function fetchSecondPipedApiUrl(videoId: string): Promise<any> {
  const response = await fetch(`https://pipedapi.adminforge.de/streams/${videoId}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

async function fetchAceThinkerApiUrl(videoId: string): Promise<any> {
  const encodedVideoId = encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`);
  const apiUrl = `https://www.acethinker.com/downloader/api/video_info.php?url=${encodedVideoId}&israpid=1&ismp3=0`;
  const response = await fetch(apiUrl);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

async function fetchNewApiUrl(videoId: string): Promise<any> {
  const response = await fetch(`https://kityune.imput.net/api/json?id=${videoId}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

async function fetchCobaltApiUrl(videoId: string): Promise<any> {
  const response = await fetch('https://api.cobalt.tools/api/json', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: `https://www.youtube.com/watch?v=${videoId}`,
      aFormat: "mp3",
      isAudioOnly: true,
      audioBitrate: 8000 
    }),
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

async function fetchYtdlOnlineUrl(videoId: string): Promise<any> {
  const response = await fetch(`https://api.allorigins.win/raw?url=https://ytdlp.online/stream?command=https://www.youtube.com/watch?v=${videoId} --get-url`, {

  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const responseText = await response.text();
  const urls = responseText.split('\n')
    .filter(line => line.trim().startsWith('data:'))
    .map(line => line.substring(5).trim())
    .filter(url => url.startsWith('http'));
  return { urls };
}

function formatData(data: any, apiName: string): Piped {
  // This function will need to be customized based on the actual structure of the data returned by each API
  // Here's a basic implementation that you'll need to adjust:
  return {
    title: data.title || 'Unknown Title',
    uploader: data.uploader || data.author || 'Unknown Uploader',
    duration: data.duration || data.lengthSeconds || 0,
    uploaderUrl: data.uploaderUrl || data.authorUrl || '',
    category: data.category || data.genre || 'Unknown',
    liveStream: data.liveStream || data.liveNow || false,
    subtitles: data.subtitles || [],
    relatedStreams: data.relatedStreams || [],
    audioStreams: formatAudioStreams(data, apiName),
  };
}

function formatAudioStreams(data: any, apiName: string): AudioStream[] {
  // This function will need to be customized based on the actual structure of the audio data returned by each API
  // Here's a basic implementation that you'll need to adjust:
  switch (apiName) {
    case 'PipedAPI':
    case 'SecondPipedAPI':
      return data.audioStreams || [];
    case 'AceThinkerAPI':
      return data.links.flat().filter((link: any) => link.ext === 'weba').map((link: any) => ({
        url: link.url,
        bitrate: 0,
        codec: '',
        contentLength: '',
        quality: '',
        mimeType: 'audio/webm',
      }));
    case 'NewAPI':
      return data.status === 'stream' && data.url ? [{
        url: data.url,
        bitrate: 0,
        codec: '',
        contentLength: '',
        quality: '',
        mimeType: 'audio/unknown',
      }] : [];
    case 'CobaltAPI':
      return (data.audio || data.url) ? [{
        url: data.audio || data.url,
        bitrate: 8000,
        codec: '',
        contentLength: '',
        quality: '8 kbps',
        mimeType: 'audio/mp3',
      }] : [];
    case 'YtdlOnlineAPI':
      return data.urls.map((url: string) => ({
        url,
        bitrate: 0,
        codec: '',
        contentLength: '',
        quality: '',
        mimeType: 'audio/unknown',
      }));
    default:
      return [];
  }
}
