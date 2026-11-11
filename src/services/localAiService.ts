/**
 * Service for in-browser WebGPU edge acceleration and Localhost AI bridges.
 * Addresses user question: "Can local models be used in a web app?"
 */

export interface WebGpuDiagnostics {
  isSupported: boolean;
  adapterName?: string;
  vendor?: string;
  architecture?: string;
  description: string;
}

export interface LocalEndpointStatus {
  endpoint: string;
  isReachable: boolean;
  latencyMs?: number;
  detectedEngine?: 'ollama' | 'comfyui' | 'sd-webui' | 'lm-studio' | 'unknown';
  errorDetails?: string;
}

export class LocalAiService {
  /**
   * Evaluates client browser for WebGPU hardware acceleration
   */
  public static async testWebGpu(): Promise<WebGpuDiagnostics> {
    if (typeof window === 'undefined') {
      return { isSupported: false, description: 'Server-side rendering environment' };
    }

    const nav = navigator as any;
    if (!nav.gpu) {
      return {
        isSupported: false,
        description: 'WebGPU is unavailable. Use iOS 26+ Safari on a secure (HTTPS) origin and check browser and device WebGPU support.',
      };
    }

    try {
      const adapter = await nav.gpu.requestAdapter();
      if (!adapter) {
        return {
          isSupported: false,
          description: 'WebGPU is present, but no compatible adapter is available on this device.',
        };
      }

      const info = (adapter as any).info || {};
      return {
        isSupported: true,
        adapterName: info.description || info.device || 'Apple Silicon / Device GPU',
        vendor: info.vendor || 'Hardware Accelerated',
        architecture: info.architecture || 'Unified Memory',
        description: 'WebGPU is available for browser-based model inference.',
      };
    } catch (e: any) {
      return {
        isSupported: false,
        description: `WebGPU initialization error: ${e.message}`,
      };
    }
  }

  /**
   * Pings a local AI endpoint (e.g. Ollama, ComfyUI, Automatic1111) to check connectivity
   */
  public static async pingLocalEndpoint(endpointUrl: string): Promise<LocalEndpointStatus> {
    const cleanUrl = endpointUrl.trim().replace(/\/$/, '');
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      // Attempt GET to root or /api/tags (Ollama) or /system_stats (ComfyUI)
      let detected: LocalEndpointStatus['detectedEngine'] = 'unknown';

      // 1. Try Ollama tags
      try {
        const ollamaRes = await fetch(`${cleanUrl}/api/tags`, {
          method: 'GET',
          signal: controller.signal,
        });
        if (ollamaRes.ok) {
          detected = 'ollama';
          clearTimeout(timeoutId);
          return {
            endpoint: cleanUrl,
            isReachable: true,
            latencyMs: Math.round(performance.now() - startTime),
            detectedEngine: detected,
          };
        }
      } catch (err) {
        // continue to next check
      }

      // 2. Try ComfyUI system stats
      try {
        const comfyRes = await fetch(`${cleanUrl}/system_stats`, {
          method: 'GET',
          signal: controller.signal,
        });
        if (comfyRes.ok) {
          detected = 'comfyui';
          clearTimeout(timeoutId);
          return {
            endpoint: cleanUrl,
            isReachable: true,
            latencyMs: Math.round(performance.now() - startTime),
            detectedEngine: detected,
          };
        }
      } catch (err) {
        // continue to next check
      }

      // 3. Fallback generic ping
      const res = await fetch(cleanUrl, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors', // allows checking reachability even with strict CORS
      });
      clearTimeout(timeoutId);

      return {
        endpoint: cleanUrl,
        isReachable: true,
        latencyMs: Math.round(performance.now() - startTime),
        detectedEngine: 'unknown',
      };
    } catch (err: any) {
      return {
        endpoint: cleanUrl,
        isReachable: false,
        errorDetails: err.name === 'AbortError' ? 'Connection timed out after 4 seconds' : 'Local endpoint unreachable or CORS blocked',
      };
    }
  }
}
