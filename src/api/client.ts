import AsyncStorage from '@react-native-async-storage/async-storage';

// For iOS Simulator: http://localhost:3000
// For Android Emulator: http://10.0.2.2:3000
// For Physical Device: http://<YOUR_MACHINE_IP>:3000
const DEFAULT_BASE_URL = 'http://192.168.1.100:3000';

const TIMEOUT_MS = 10000;

async function getBaseUrl(): Promise<string> {
  const saved = await AsyncStorage.getItem('api_base_url');
  return saved || DEFAULT_BASE_URL;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your network connection.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function apiGet(path: string): Promise<any> {
  const base = await getBaseUrl();
  const res = await fetchWithTimeout(`${base}${path}`);
  return res.json();
}

export async function apiPost(path: string, body: any): Promise<any> {
  const base = await getBaseUrl();
  const res = await fetchWithTimeout(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function apiPut(path: string, body: any): Promise<any> {
  const base = await getBaseUrl();
  const res = await fetchWithTimeout(`${base}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function setApiBaseUrl(url: string): Promise<void> {
  await AsyncStorage.setItem('api_base_url', url);
}
