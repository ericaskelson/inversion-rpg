/**
 * API client for the editor server
 */

const EDITOR_API_BASE = 'http://localhost:3001/api';

export interface EditorApiError {
  error: string;
}

/**
 * Check if the editor server is available
 */
export async function isEditorAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${EDITOR_API_BASE}/character-creation`, {
      method: 'HEAD',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch character creation data from the editor server
 */
export async function fetchCharacterCreation(): Promise<unknown> {
  const response = await fetch(`${EDITOR_API_BASE}/character-creation`);
  if (!response.ok) {
    throw new Error('Failed to fetch character creation data');
  }
  return response.json();
}

/**
 * Save character creation data to the editor server
 */
export async function saveCharacterCreation(data: unknown): Promise<void> {
  const response = await fetch(`${EDITOR_API_BASE}/character-creation`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to save character creation data');
  }
}

/**
 * Fetch appearance config from the editor server
 */
export async function fetchAppearanceConfig(): Promise<unknown> {
  const response = await fetch(`${EDITOR_API_BASE}/appearance-config`);
  if (!response.ok) {
    throw new Error('Failed to fetch appearance config');
  }
  return response.json();
}

/**
 * Save appearance config to the editor server
 */
export async function saveAppearanceConfig(data: unknown): Promise<void> {
  const response = await fetch(`${EDITOR_API_BASE}/appearance-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to save appearance config');
  }
}

// ============================================
// PORTRAIT GENERATION API
// ============================================

export interface PortraitGenerationRequest {
  builds: string[];
  skinTones: string[];
  hairColors: string[];
  sexes: ('male' | 'female')[];
  races: string[];
  count?: number;  // Number of portraits per combination (default 1)
}

export interface PendingPortrait {
  id: string;
  tempPath: string;
  build: string;
  skinTone: string;
  hairColor: string;
  sex: 'male' | 'female';
  race: string;
  generatedAt: string;
  prompt: string;
}

export interface GenerationStatus {
  isGenerating: boolean;
  progress: {
    current: number;
    total: number;
    currentItem: { id: string } | null;
  };
  queueLength: number;
}

export interface RateLimitInfo {
  model: string | null;
  remaining: number | null;
  limit: number | null;
  reset: string | null;
  lastUpdated: string | null;
}

/**
 * Queue portrait generation for selected combinations
 */
export async function generatePortraits(request: PortraitGenerationRequest): Promise<{
  queued: number;
  total: number;
  message: string;
}> {
  const response = await fetch(`${EDITOR_API_BASE}/portraits/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to queue portrait generation');
  }
  return response.json();
}

/**
 * Get list of pending portraits awaiting review
 */
export async function fetchPendingPortraits(): Promise<PendingPortrait[]> {
  const response = await fetch(`${EDITOR_API_BASE}/portraits/pending`);
  if (!response.ok) {
    throw new Error('Failed to fetch pending portraits');
  }
  return response.json();
}

/**
 * Get current generation status
 */
export async function fetchGenerationStatus(): Promise<GenerationStatus> {
  const response = await fetch(`${EDITOR_API_BASE}/portraits/generation-status`);
  if (!response.ok) {
    throw new Error('Failed to fetch generation status');
  }
  return response.json();
}

/**
 * Get current rate limit info from last API call
 */
export async function fetchRateLimits(): Promise<RateLimitInfo> {
  const response = await fetch(`${EDITOR_API_BASE}/portraits/rate-limits`);
  if (!response.ok) {
    throw new Error('Failed to fetch rate limits');
  }
  return response.json();
}

/**
 * Accept a pending portrait (moves to final location)
 */
export async function acceptPortrait(id: string): Promise<void> {
  const response = await fetch(`${EDITOR_API_BASE}/portraits/accept/${encodeURIComponent(id)}`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to accept portrait');
  }
}

/**
 * Reject a pending portrait (deletes it)
 */
export async function rejectPortrait(id: string): Promise<void> {
  const response = await fetch(`${EDITOR_API_BASE}/portraits/pending/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to reject portrait');
  }
}

/**
 * Accept all pending portraits
 */
export async function acceptAllPortraits(): Promise<{ accepted: number }> {
  const response = await fetch(`${EDITOR_API_BASE}/portraits/accept-all`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to accept all portraits');
  }
  return response.json();
}

/**
 * Reject all pending portraits
 */
export async function rejectAllPortraits(): Promise<{ rejected: number }> {
  const response = await fetch(`${EDITOR_API_BASE}/portraits/pending`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to reject all portraits');
  }
  return response.json();
}

// ============================================
// BATCH API
// ============================================

export interface BatchJob {
  id: string;
  displayName: string;
  createdAt: string;
  requestCount: number;
  state: string;
  lastChecked?: string;
  stats?: {
    totalRequestCount?: number;
    pendingRequestCount?: number;
    successfulRequestCount?: number;
    failedRequestCount?: number;
  };
  imported?: boolean;
  importedAt?: string;
  importedCount?: number;
  failedCount?: number;
}

export interface BatchJobStatus {
  id: string;
  state: string;
  stats: BatchJob['stats'] | null;
  dest: unknown;
}

export interface BatchImportResult {
  success: boolean;
  imported: number;
  failed: number;
  total: number;
}

/**
 * Create a new batch job for portrait generation
 */
export async function createBatchJob(request: PortraitGenerationRequest): Promise<{
  success: boolean;
  jobId: string;
  requestCount: number;
  state: string;
}> {
  const response = await fetch(`${EDITOR_API_BASE}/portraits/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create batch job');
  }
  return response.json();
}

/**
 * Get list of all batch jobs
 */
export async function fetchBatchJobs(): Promise<BatchJob[]> {
  const response = await fetch(`${EDITOR_API_BASE}/portraits/batch`);
  if (!response.ok) {
    throw new Error('Failed to fetch batch jobs');
  }
  return response.json();
}

/**
 * Check status of a batch job
 */
export async function fetchBatchJobStatus(jobId: string): Promise<BatchJobStatus> {
  const response = await fetch(`${EDITOR_API_BASE}/portraits/batch/${encodeURIComponent(jobId)}/status`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to check batch job status');
  }
  return response.json();
}

/**
 * Import results from a completed batch job
 */
export async function importBatchResults(jobId: string): Promise<BatchImportResult> {
  const response = await fetch(`${EDITOR_API_BASE}/portraits/batch/${encodeURIComponent(jobId)}/import`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to import batch results');
  }
  return response.json();
}

/**
 * Delete a batch job record (local only)
 */
export async function deleteBatchJob(jobId: string): Promise<void> {
  const response = await fetch(`${EDITOR_API_BASE}/portraits/batch/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete batch job');
  }
}

// ============================================
// OPTION IMAGE GENERATION API
// ============================================

export interface OptionImageConfig {
  basePrompt: string;
  styleModifiers: string;
  aspectRatio: string;
  imageSize: string;
  model?: 'nano-banana-pro' | 'nano-banana';
}

export interface OptionForGeneration {
  category: string;
  id: string;
  name: string;
  description?: string;
  traits?: string[];
  attributes?: Record<string, number>;
  isDrawback?: boolean;
  subcategory?: string;
}

export interface PendingOptionImage {
  id: string;
  optionId: string;
  category: string;
  name: string;
  tempPath: string;
  generatedAt: string;
  prompt: string;
  batchJobId?: string;
}

export interface OptionGenerationStatus {
  isGenerating: boolean;
  progress: {
    current: number;
    total: number;
    currentItem: OptionForGeneration | null;
  };
  queueLength: number;
}

export interface OptionBatchJob {
  id: string;
  displayName: string;
  createdAt: string;
  requestCount: number;
  state: string;
  lastChecked?: string;
  responseCount?: number;
  imported?: boolean;
  importedAt?: string;
  importedCount?: number;
  failedCount?: number;
}

/**
 * Get option image generation config
 */
export async function fetchOptionImageConfig(): Promise<OptionImageConfig> {
  const response = await fetch(`${EDITOR_API_BASE}/options/image-config`);
  if (!response.ok) {
    throw new Error('Failed to fetch option image config');
  }
  return response.json();
}

/**
 * Save option image generation config
 */
export async function saveOptionImageConfig(config: OptionImageConfig): Promise<void> {
  const response = await fetch(`${EDITOR_API_BASE}/options/image-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    throw new Error('Failed to save option image config');
  }
}

/**
 * Queue option images for real-time generation
 */
export async function generateOptionImages(options: OptionForGeneration[]): Promise<{
  queued: number;
  total: number;
  message: string;
}> {
  const response = await fetch(`${EDITOR_API_BASE}/options/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ options }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to queue option image generation');
  }
  return response.json();
}

/**
 * Get list of pending option images awaiting review
 */
export async function fetchPendingOptionImages(): Promise<PendingOptionImage[]> {
  const response = await fetch(`${EDITOR_API_BASE}/options/pending`);
  if (!response.ok) {
    throw new Error('Failed to fetch pending option images');
  }
  return response.json();
}

/**
 * Get option image generation status
 */
export async function fetchOptionGenerationStatus(): Promise<OptionGenerationStatus> {
  const response = await fetch(`${EDITOR_API_BASE}/options/generation-status`);
  if (!response.ok) {
    throw new Error('Failed to fetch option generation status');
  }
  return response.json();
}

/**
 * Accept a pending option image
 */
export async function acceptOptionImage(id: string): Promise<void> {
  const response = await fetch(`${EDITOR_API_BASE}/options/accept/${encodeURIComponent(id)}`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to accept option image');
  }
}

/**
 * Reject a pending option image
 */
export async function rejectOptionImage(id: string): Promise<void> {
  const response = await fetch(`${EDITOR_API_BASE}/options/pending/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to reject option image');
  }
}

/**
 * Accept all pending option images
 */
export async function acceptAllOptionImages(): Promise<{ accepted: number }> {
  const response = await fetch(`${EDITOR_API_BASE}/options/accept-all`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to accept all option images');
  }
  return response.json();
}

/**
 * Reject all pending option images
 */
export async function rejectAllOptionImages(): Promise<{ rejected: number }> {
  const response = await fetch(`${EDITOR_API_BASE}/options/pending`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to reject all option images');
  }
  return response.json();
}

/**
 * Create a batch job for option images
 */
export async function createOptionBatchJob(options: OptionForGeneration[]): Promise<{
  success: boolean;
  jobId: string;
  requestCount: number;
  state: string;
}> {
  const response = await fetch(`${EDITOR_API_BASE}/options/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ options }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create option batch job');
  }
  return response.json();
}

/**
 * Get list of all option batch jobs
 */
export async function fetchOptionBatchJobs(): Promise<OptionBatchJob[]> {
  const response = await fetch(`${EDITOR_API_BASE}/options/batch`);
  if (!response.ok) {
    throw new Error('Failed to fetch option batch jobs');
  }
  return response.json();
}

/**
 * Check status of an option batch job
 */
export async function fetchOptionBatchJobStatus(jobId: string): Promise<{
  id: string;
  state: string;
  responseCount: number;
}> {
  const response = await fetch(`${EDITOR_API_BASE}/options/batch/${encodeURIComponent(jobId)}/status`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to check option batch job status');
  }
  return response.json();
}

/**
 * Import results from a completed option batch job
 */
export async function importOptionBatchResults(jobId: string): Promise<BatchImportResult> {
  const response = await fetch(`${EDITOR_API_BASE}/options/batch/${encodeURIComponent(jobId)}/import`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to import option batch results');
  }
  return response.json();
}

/**
 * Delete an option batch job record
 */
export async function deleteOptionBatchJob(jobId: string): Promise<void> {
  const response = await fetch(`${EDITOR_API_BASE}/options/batch/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete option batch job');
  }
}

// ============================================
// NAMES API
// ============================================

/**
 * Fetch names config from the editor server
 */
export async function fetchNamesConfig(): Promise<unknown> {
  const response = await fetch(`${EDITOR_API_BASE}/names`);
  if (!response.ok) {
    throw new Error('Failed to fetch names config');
  }
  return response.json();
}

/**
 * Save names config to the editor server
 */
export async function saveNamesConfig(data: unknown): Promise<void> {
  const response = await fetch(`${EDITOR_API_BASE}/names`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to save names config');
  }
}

/**
 * Add a name to a specific sex/race combination
 */
export async function addNameToList(
  sex: 'male' | 'female',
  race: string,
  name: string
): Promise<void> {
  const response = await fetch(`${EDITOR_API_BASE}/names/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sex, race, name }),
  });
  if (!response.ok) {
    throw new Error('Failed to add name');
  }
}

/**
 * Delete a name from a specific sex/race combination
 */
export async function deleteNameFromList(
  sex: 'male' | 'female',
  race: string,
  name: string
): Promise<void> {
  const response = await fetch(`${EDITOR_API_BASE}/names/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sex, race, name }),
  });
  if (!response.ok) {
    throw new Error('Failed to delete name');
  }
}
