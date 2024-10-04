import { playButton } from "../lib/dom";
import { store } from "../lib/store";
import { notify } from "../lib/utils";

interface Stream {
  url: string;
  title: string;
  uploaderName: string;
  uploaderUrl: string;
  uploaderAvatar: string;
  uploadDate: string;
  duration: number;
  views: number;
  thumbnail: string;
  type: 'stream';
}

interface AudioStream {
  url: string;
  bitrate: number;
  codec: string;
  mimeType: string;
  quality: string;
  contentLength: string | null;
}

interface Piped {
  title: string;
  description: string;
  uploadDate: string;
  uploader: string;
  uploaderUrl: string;
  uploaderAvatar: string | null;
  thumbnailUrl: string;
  hls: string | null;
  dash: string | null;
  duration: number;
  views: number;
  likes: number;
  dislikes: number;
  audioStreams: AudioStream[];
  videoStreams: any[]; // Keeping this as any[] for simplicity
  relatedStreams: Stream[];
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(url, {
    ...options,
    signal: controller.signal
  });
  clearTimeout(id);
  return response;
}

async function fetchPipedApi(videoId: string, instance: string): Promise<Piped> {
  const response = await fetchWithTimeout(`${instance}/streams/${videoId}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

async function fetchCustomApi(videoId: string, apiUrl: string): Promise<Partial<Piped>> {
  const response = await fetchWithTimeout(apiUrl.replace('{videoId}', videoId));
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data = await response.json();
  
  // Implement custom parsing logic here based on the API response
  // This is a basic example and should be adjusted based on the actual API response
  return {
    title: data.title,
    audioStreams: [{
      url: data.audioUrl,
      bitrate: data.bitrate || 0,
      codec: data.codec || '',
      mimeType: data.mimeType || 'audio/unknown',
      quality: data.quality || 'unknown',
      contentLength: data.contentLength || null
    }],
    // Add other fields as necessary
  };
}

export async function getData(id: string): Promise<Piped> {
  const pipedInstances = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.adminforge.de',
    'https://pipedapi.syncpundit.io'
  ];

  const customApis = [
    'https://kityune.imput.net/api/json?id={videoId}',
    'https://api.cobalt.tools/api/json',
    'https://api.allorigins.win/raw?url=https://ytdlp.online/stream?command=https://www.youtube.com/watch?v={videoId} --get-url'
  ];

  const allApis = [...pipedInstances, ...customApis];

  for (let attempt = 0; attempt < 3; attempt++) {
    for (const api of allApis) {
      try {
        console.log(`Attempting to fetch from ${api}...`);
        let data: Partial<Piped>;
        
        if (pipedInstances.includes(api)) {
          data = await fetchPipedApi(id, api);
        } else {
          data = await fetchCustomApi(id, api);
        }

        if (data && data.audioStreams && data.audioStreams.length > 0) {
          console.log(`Success! ${api} returned valid data.`);
          return formatData(data as Piped);
        } else {
          console.log(`${api} did not return valid data.`);
        }
      } catch (error) {
        console.error(`Error fetching from ${api}:`, error);
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

function formatData(data: Piped): Piped {
  // Ensure all required fields are present, use default values if not
  return {
    title: data.title || 'Unknown Title',
    description: data.description || '',
    uploadDate: data.uploadDate || new Date().toISOString(),
    uploader: data.uploader || 'Unknown Uploader',
    uploaderUrl: data.uploaderUrl || '',
    uploaderAvatar: data.uploaderAvatar || null,
    thumbnailUrl: data.thumbnailUrl || '',
    hls: data.hls || null,
    dash: data.dash || null,
    duration: data.duration || 0,
    views: data.views || 0,
    likes: data.likes || 0,
    dislikes: data.dislikes || 0,
    audioStreams: data.audioStreams.map(stream => ({
      url: stream.url,
      bitrate: stream.bitrate || 0,
      codec: stream.codec || '',
      mimeType: stream.mimeType || 'audio/unknown',
      quality: stream.quality || 'unknown',
      contentLength: stream.contentLength || null
    })),
    videoStreams: data.videoStreams || [],
    relatedStreams: (data.relatedStreams || []).map(stream => ({
      url: stream.url,
      title: stream.title || 'Unknown Title',
      uploaderName: stream.uploaderName || 'Unknown Uploader',
      uploaderUrl: stream.uploaderUrl || '',
      uploaderAvatar: stream.uploaderAvatar || '',
      uploadDate: stream.uploadDate || new Date().toISOString(),
      duration: stream.duration || 0,
      views: stream.views || 0,
      thumbnail: stream.thumbnail || '',
      type: 'stream'
    }))
  };
}
