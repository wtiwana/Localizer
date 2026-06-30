import type { CapabilityProfile, ConnectionSpeed } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getConnectionSpeed(downlinkMbps: number, effectiveType?: string): ConnectionSpeed {
  if (downlinkMbps >= 10 || effectiveType === '4g') return 'fast';
  if (downlinkMbps >= 2 || effectiveType === '3g') return 'medium';
  return 'slow';
}

export async function detectWebGPU(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
  if (!gpu) return false;
  try {
    const adapter = await gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

export async function detectBackend(): Promise<'webgpu' | 'wasm'> {
  return (await detectWebGPU()) ? 'webgpu' : 'wasm';
}

export interface ComputeCapabilityOptions {
  cachedStandardTier?: boolean;
}

export async function computeCapabilityProfile(
  options: ComputeCapabilityOptions = {},
): Promise<CapabilityProfile> {
  const webgpu = await detectWebGPU();
  const nav = typeof navigator !== 'undefined' ? navigator : ({} as Navigator);
  const connection = (nav as Navigator & { connection?: NetworkInformation }).connection;
  const deviceMemoryGB = (nav as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const downlinkMbps = connection?.downlink ?? 10;
  const effectiveType = connection?.effectiveType;
  const saveData = connection?.saveData ?? false;
  const hardwareConcurrency = nav.hardwareConcurrency ?? 4;

  let score = 0;
  if (webgpu) score += 40;
  if (deviceMemoryGB >= 4) score += 25;
  else if (deviceMemoryGB >= 2) score += 10;
  if (downlinkMbps >= 10) score += 20;
  else if (downlinkMbps >= 2) score += 10;
  if (effectiveType === '4g') score += 10;
  if (saveData) score -= 30;
  if (hardwareConcurrency >= 4) score += 5;
  if (options.cachedStandardTier) score += 20;

  score = clamp(score, 0, 100);

  let tier: CapabilityProfile['tier'] = 'micro';
  if (score >= 70) tier = 'premium';
  else if (score >= 40) tier = 'standard';

  return {
    score,
    tier,
    webgpu,
    deviceMemoryGB,
    connection: getConnectionSpeed(downlinkMbps, effectiveType),
    saveData,
  };
}

export function computeCapabilityScore(profile: CapabilityProfile): number {
  return profile.score;
}

interface GPU {
  requestAdapter(): Promise<{ readonly info?: unknown } | null>;
}

interface NetworkInformation {
  downlink?: number;
  effectiveType?: string;
  saveData?: boolean;
}
