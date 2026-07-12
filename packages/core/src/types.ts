export type ModelTier = 'micro' | 'standard' | 'premium';
export type UpgradePolicy = 'auto' | 'manual' | 'never';
export type ModelsSource = 'registry' | 'self-hosted' | 'custom';
export type ConnectionSpeed = 'slow' | 'medium' | 'fast';
export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ProgressEvent {
  tier?: ModelTier | 'nlp';
  capability?: string;
  percent: number;
  loaded?: number;
  total?: number;
  status: string;
}

export interface TierChangeEvent {
  from: ModelTier;
  to: ModelTier;
}

export interface CapabilityProfile {
  score: number;
  tier: ModelTier;
  webgpu: boolean;
  deviceMemoryGB: number;
  connection: ConnectionSpeed;
  saveData: boolean;
}

export interface ChatOptions {
  tier?: ModelTier | 'auto';
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface SummarizeOptions {
  maxLength?: number;
}

export interface ClassifyOptions {
  labels?: string[];
}

export interface RewriteOptions {
  tone?: 'formal' | 'casual' | 'concise';
}

export interface LocalizerOptions {
  preset?: 'basic' | 'chat-only' | 'nlp-only' | 'max';
  features?: Array<'chat' | 'summarize' | 'classify' | 'rewrite'>;
  registry?: string;
  models?: ModelsSource;
  modelBaseUrl?: string;
  customModel?: string;
  loadMicroAtStart?: boolean;
  deferMicroLoad?: boolean;
  upgradePolicy?: UpgradePolicy;
  cache?: 'indexeddb' | 'none';
  onProgress?: (event: ProgressEvent) => void;
  onTierChange?: (event: TierChangeEvent) => void;
  tiers?: Partial<Record<ModelTier, { url?: string }>>;
}

export interface ModelBundleManifest {
  version: string;
  id?: string;
  engine: 'transformers' | 'webllm';
  files: string[];
  sizeMB?: number;
  url?: string;
  mirrors?: string[];
  hfModelId?: string;
}

export interface RegistryManifest {
  version: string;
  tiers: Record<ModelTier, ModelBundleManifest>;
  nlp: Record<'summarize' | 'classify' | 'rewrite', ModelBundleManifest>;
}

export interface CustomModelManifest {
  version: string;
  id: string;
  engine: 'transformers' | 'webllm';
  files: string[];
  sizeMB?: number;
  baseModel?: string;
}

export interface WorkerInitPayload {
  type: 'init';
  id: string;
  options: SerializedInitOptions;
}

export interface SerializedInitOptions {
  registryManifest: RegistryManifest;
  resolvedSources: ResolvedModelSources;
  features: string[];
  cache: 'indexeddb' | 'none';
  upgradePolicy: UpgradePolicy;
  loadMicroAtStart: boolean;
  capability: CapabilityProfile;
}

export interface ResolvedModelSources {
  micro: ModelSourceConfig;
  standard: ModelSourceConfig;
  premium: ModelSourceConfig;
  nlp: Record<string, ModelSourceConfig>;
}

export interface ModelSourceConfig {
  baseUrl: string;
  manifest: ModelBundleManifest;
  engine: 'transformers' | 'webllm';
  /** When true, load weights from baseUrl only (self-hosted or custom bundles). */
  localOnly?: boolean;
}

export type WorkerRequest =
  | WorkerInitPayload
  | { type: 'prefetch'; id: string; tier: ModelTier }
  | { type: 'chat'; id: string; messages: ChatMessage[]; stream: boolean; options?: ChatOptions }
  | { type: 'summarize'; id: string; text: string; options?: SummarizeOptions }
  | { type: 'classify'; id: string; text: string; options?: ClassifyOptions }
  | { type: 'rewrite'; id: string; text: string; options?: RewriteOptions }
  | { type: 'dispose'; id: string };

export type WorkerResponse =
  | { type: 'ready'; id: string }
  | { type: 'progress'; id?: string; event: ProgressEvent }
  | { type: 'tierReady'; tier: ModelTier }
  | { type: 'tierChange'; from: ModelTier; to: ModelTier }
  | { type: 'token'; id: string; delta: string }
  | { type: 'done'; id: string; result: unknown }
  | { type: 'error'; id: string; message: string; code?: string };

export interface ClassifyResult {
  label: string;
  score: number;
  labels: Array<{ label: string; score: number }>;
}
