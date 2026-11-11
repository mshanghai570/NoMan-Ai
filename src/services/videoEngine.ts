import type { MotionStyle, VideoMetadata } from '../types';

export interface VideoRenderOptions {
  imageUrl: string;
  motionStyle: MotionStyle;
  duration: number; // seconds
  prompt?: string;
  negativePrompt?: string;
  fps?: number;
  width?: number;
  height?: number;
  onProgress?: (percent: number) => void;
}

export interface VideoExtendOptions {
  baseImageUrl: string;
  continuationImageUrl?: string;
  existingDuration: number;
  extensionDuration: number;
  existingMotion: MotionStyle;
  continuationMotion: MotionStyle;
  prompt: string;
  negativePrompt?: string;
  fps?: number;
  onProgress?: (percent: number) => void;
}

export class VideoEngine {
  /**
   * Loads an HTMLImageElement safely
   */
  public static loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error('Failed to load image for video processing'));
      img.src = url;
    });
  }

  /**
   * Renders a motion video from a still image using HTML5 Canvas & MediaRecorder
   */
  public static async renderImageToVideo(options: VideoRenderOptions): Promise<{ videoUrl: string; duration: number }> {
    const { imageUrl, motionStyle, duration, fps = 30, onProgress } = options;

    const img = await this.loadImage(imageUrl);
    const canvas = document.createElement('canvas');
    // Reasonable resolution for smooth browser recording
    const renderWidth = options.width || (img.naturalWidth > 1280 ? 1280 : img.naturalWidth || 960);
    const renderHeight = options.height || Math.round(renderWidth * (img.naturalHeight / (img.naturalWidth || 1))) || 540;

    canvas.width = renderWidth;
    canvas.height = renderHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not get 2D canvas context');

    // Setup MediaRecorder
    let mimeType = 'video/webm;codecs=vp9';
    if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
        mimeType = 'video/mp4;codecs=avc1';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        mimeType = 'video/webm;codecs=vp8';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mimeType = 'video/webm';
      }
    }

    const totalFrames = Math.max(fps * duration, 15);
    const recordedChunks: Blob[] = [];

    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;

    try {
      stream = canvas.captureStream(fps);
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6000000 });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      };
      recorder.start();
    } catch (e) {
      console.warn('MediaRecorder not fully supported in this environment, falling back to simulated loop', e);
    }

    // Floating atmospheric particle dust for cinematic realism
    const particles = Array.from({ length: 45 }, () => ({
      x: Math.random() * renderWidth,
      y: Math.random() * renderHeight,
      size: Math.random() * 2.5 + 0.8,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: -Math.random() * 0.6 - 0.2,
      opacity: Math.random() * 0.4 + 0.1,
    }));

    // Render loop frame-by-frame
    for (let frame = 0; frame < totalFrames; frame++) {
      const progress = frame / totalFrames;
      const eased = this.easeInOutCubic(progress);

      this.renderMotionFrame(ctx, img, renderWidth, renderHeight, motionStyle, eased, progress);

      // Render atmospheric particle layer
      ctx.save();
      for (const p of particles) {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.y < 0) p.y = renderHeight;
        if (p.x < 0) p.x = renderWidth;
        if (p.x > renderWidth) p.x = 0;

        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * (1 - Math.abs(progress - 0.5) * 0.5)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (onProgress && frame % 5 === 0) {
        onProgress(Math.round((frame / totalFrames) * 95));
      }

      // Small tick for stream capture
      await new Promise((r) => setTimeout(r, 1000 / fps));
    }

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      await new Promise((resolve) => {
        recorder!.onstop = resolve;
      });
    }

    if (onProgress) onProgress(100);

    if (recordedChunks.length > 0) {
      const videoBlob = new Blob(recordedChunks, { type: mimeType });
      const videoUrl = URL.createObjectURL(videoBlob);
      return { videoUrl, duration };
    }

    // If recording chunks was empty, return original image as source with metadata duration
    return { videoUrl: imageUrl, duration };
  }

  /**
   * Stitches an existing video sequence with a new extension sequence
   */
  public static async renderExtendedVideo(options: VideoExtendOptions): Promise<{ videoUrl: string; duration: number }> {
    const {
      baseImageUrl,
      continuationImageUrl,
      existingDuration,
      extensionDuration,
      existingMotion,
      continuationMotion,
      fps = 30,
      onProgress,
    } = options;

    const totalDuration = existingDuration + extensionDuration;
    const img1 = await this.loadImage(baseImageUrl);
    const img2 = continuationImageUrl ? await this.loadImage(continuationImageUrl) : img1;

    const renderWidth = 960;
    const renderHeight = Math.round(renderWidth * (img1.naturalHeight / (img1.naturalWidth || 1))) || 540;

    const canvas = document.createElement('canvas');
    canvas.width = renderWidth;
    canvas.height = renderHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');

    let mimeType = 'video/webm';
    if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) mimeType = 'video/mp4;codecs=avc1';
    }

    const recordedChunks: Blob[] = [];
    let recorder: MediaRecorder | null = null;
    try {
      const stream = canvas.captureStream(fps);
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6000000 });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      };
      recorder.start();
    } catch (e) {
      console.warn('Recorder fallback in extend:', e);
    }

    const totalFrames = Math.max(fps * totalDuration, 30);
    const transitionPoint = (existingDuration / totalDuration);
    const transitionWindow = 0.15; // 15% crossfade blend window

    for (let frame = 0; frame < totalFrames; frame++) {
      const globalProgress = frame / totalFrames;

      if (globalProgress < transitionPoint - transitionWindow / 2) {
        // Part 1: Initial clip motion
        const p1 = globalProgress / transitionPoint;
        this.renderMotionFrame(ctx, img1, renderWidth, renderHeight, existingMotion, this.easeInOutCubic(p1), globalProgress);
      } else if (globalProgress > transitionPoint + transitionWindow / 2) {
        // Part 2: Extension continuation motion
        const p2 = (globalProgress - transitionPoint) / (1 - transitionPoint);
        this.renderMotionFrame(ctx, img2, renderWidth, renderHeight, continuationMotion, this.easeInOutCubic(p2), globalProgress);
      } else {
        // Crossfade transition between scene 1 and extension scene 2
        const blend = (globalProgress - (transitionPoint - transitionWindow / 2)) / transitionWindow;
        
        // Render scene 1 into canvas
        this.renderMotionFrame(ctx, img1, renderWidth, renderHeight, existingMotion, 1.0, globalProgress);
        
        // Render scene 2 on top with blend opacity
        ctx.save();
        ctx.globalAlpha = blend;
        this.renderMotionFrame(ctx, img2, renderWidth, renderHeight, continuationMotion, blend, globalProgress);
        ctx.restore();
      }

      if (onProgress && frame % 6 === 0) {
        onProgress(Math.round((frame / totalFrames) * 95));
      }

      await new Promise((r) => setTimeout(r, 1000 / fps));
    }

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      await new Promise((resolve) => {
        recorder!.onstop = resolve;
      });
    }

    if (onProgress) onProgress(100);

    if (recordedChunks.length > 0) {
      const videoBlob = new Blob(recordedChunks, { type: mimeType });
      const videoUrl = URL.createObjectURL(videoBlob);
      return { videoUrl, duration: totalDuration };
    }

    return { videoUrl: continuationImageUrl || baseImageUrl, duration: totalDuration };
  }

  /**
   * Renders an individual cinematic motion frame
   */
  public static renderMotionFrame(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    w: number,
    h: number,
    style: MotionStyle,
    eased: number,
    rawProgress: number
  ) {
    ctx.clearRect(0, 0, w, h);
    ctx.save();

    // Center pivot
    const cx = w / 2;
    const cy = h / 2;
    ctx.translate(cx, cy);

    let scale = 1.0;
    let translateX = 0;
    let translateY = 0;
    let rotate = 0;

    switch (style) {
      case 'zoom-in':
        // Smooth exponential push forward from 1.0x to 1.35x
        scale = 1.0 + eased * 0.35;
        translateY = -eased * 18;
        break;

      case 'pan-left':
        // Smooth horizontal sweep to the left
        scale = 1.15;
        translateX = (0.5 - eased) * (w * 0.18);
        break;

      case 'pan-right':
        // Smooth horizontal sweep to the right
        scale = 1.15;
        translateX = (eased - 0.5) * (w * 0.18);
        break;

      case 'orbit-360':
        // 3D perspective tilting orbit
        scale = 1.08 + Math.sin(rawProgress * Math.PI) * 0.12;
        rotate = Math.sin(rawProgress * Math.PI * 2) * 0.045;
        translateX = Math.sin(rawProgress * Math.PI * 2) * (w * 0.04);
        translateY = Math.cos(rawProgress * Math.PI * 2) * (h * 0.02);
        break;

      case 'dolly-forward':
        scale = 1.0 + eased * 0.45;
        translateX = Math.sin(eased * Math.PI) * 12;
        translateY = -eased * 25;
        break;

      case 'pulse-morph':
        // Pulsing breathing wave
        const wave = Math.sin(rawProgress * Math.PI * 4);
        scale = 1.05 + wave * 0.06;
        rotate = wave * 0.015;
        break;

      case 'parallax-drift':
      default:
        scale = 1.12;
        translateX = Math.sin(rawProgress * Math.PI * 2) * 20;
        translateY = Math.cos(rawProgress * Math.PI * 2) * 14;
        break;
    }

    ctx.rotate(rotate);
    ctx.scale(scale, scale);
    ctx.translate(translateX, translateY);

    // Draw base image centered
    const imgAspect = img.naturalWidth / (img.naturalHeight || 1);
    const canvasAspect = w / h;
    let dw = w;
    let dh = h;

    if (imgAspect > canvasAspect) {
      dh = h;
      dw = h * imgAspect;
    } else {
      dw = w;
      dh = w / imgAspect;
    }

    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    // Subtle lens vignette for cinematic look
    const vignette = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.4, cx, cy, Math.max(w, h) * 0.7);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }

  private static easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}
