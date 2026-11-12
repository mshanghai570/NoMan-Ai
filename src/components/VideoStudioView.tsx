import React, { useState, useRef, useEffect } from 'react';
import type { AIProvider, GenerationItem, MotionStyle, UserSettings } from '../types';
import { MOTION_STYLES } from '../constants/models';
import { VideoEngine } from '../services/videoEngine';
import { ImageGeneratorService } from '../services/imageGenerator';
import { MEDIA_PROVIDERS } from '../providers/catalog';
import { ProviderAgentSetupModal } from './ProviderAgentSetupModal';
import {
  Video,
  Play,
  Pause,
  RotateCcw,
  Download,
  Bookmark,
  Sparkles,
  Sliders,
  Upload,
  Plus,
  Layers,
  Wand2,
  Clock,
  Film,
  Maximize2,
  ArrowRight,
  ZoomIn,
  MoveLeft,
  MoveRight,
  RotateCw,
  AlertCircle,
  Cloud,
  Server,
  Shield,
  ShieldCheck,
  Check,
  Settings2,
} from 'lucide-react';
import { haptic } from '../utils/haptics';

interface VideoStudioViewProps {
  settings: UserSettings;
  libraryItems: GenerationItem[];
  preloadedImageUrl?: string;
  preloadedPrompt?: string;
  preloadedExtendItem?: GenerationItem;
  onSaveGeneration: (item: GenerationItem) => void;
  onUpdateSettings?: (newSettings: Partial<UserSettings>) => void;
}

export const VideoStudioView: React.FC<VideoStudioViewProps> = ({
  settings,
  libraryItems,
  preloadedImageUrl,
  preloadedPrompt,
  preloadedExtendItem,
  onSaveGeneration,
  onUpdateSettings,
}) => {
  // Mode: 'image-to-video' | 'extend' | 'text-to-video'
  const [activeMode, setActiveMode] = useState<'image-to-video' | 'extend' | 'text-to-video'>(
    preloadedExtendItem ? 'extend' : 'image-to-video'
  );

  // Image to Video State
  const [sourceImage, setSourceImage] = useState<string>(
    preloadedImageUrl || '/src/assets/images/sample_cyber_portrait_1794392786213.jpg'
  );
  const [sourcePrompt, setSourcePrompt] = useState<string>(preloadedPrompt || 'Cyberpunk nomad in rain-soaked neo-Tokyo');
  const [motionStyle, setMotionStyle] = useState<MotionStyle>('zoom-in');
  const [duration, setDuration] = useState<number>(4); // seconds

  // Extend Video State
  const [videoToExtend, setVideoToExtend] = useState<GenerationItem | null>(
    preloadedExtendItem || libraryItems.find((i) => i.type === 'video') || null
  );
  const [extensionPrompt, setExtensionPrompt] = useState<string>(
    'Camera glides through neon mist as city lights flare into golden particles'
  );
  const [extensionDuration, setExtensionDuration] = useState<number>(3);
  const [extensionMotion, setExtensionMotion] = useState<MotionStyle>('parallax-drift');

  // Text to Video State
  const [textPrompt, setTextPrompt] = useState<string>('Aerial cinematic sweep over floating bioluminescent islands in violet twilight');

  // Negative Prompt State for video motion & keyframe generation
  const [negativePrompt, setNegativePrompt] = useState<string>(
    'blurry frames, flickering, jitter, unnatural morphing, faded colors, washed out, low contrast, distorted anatomy, stuttering, artifacts'
  );
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);

  // Quick video-specific negative tags
  const quickNegativeVideoTags = [
    { label: 'blurry frames', tag: 'blurry frames' },
    { label: 'flicker & jitter', tag: 'flickering, jitter' },
    { label: 'unnatural morphing', tag: 'unnatural morphing, distorted shapes' },
    { label: 'faded colors', tag: 'faded colors, washed out' },
    { label: 'distorted faces', tag: 'distorted faces, bad eyes' },
    { label: 'choppy motion', tag: 'choppy motion, low frame rate' },
    { label: 'artifacts & noise', tag: 'artifacts, noise, compression' },
    { label: 'watermark & text', tag: 'watermark, text, logo' },
  ];

  const handleToggleNegativeTag = (tag: string) => {
    haptic.trigger('selection');
    const parts = tag.split(',').map((p) => p.trim());
    const lowerNeg = negativePrompt.toLowerCase();
    const hasTag = parts.some((p) => lowerNeg.includes(p.toLowerCase()));

    if (hasTag) {
      let updated = negativePrompt;
      parts.forEach((p) => {
        const regex = new RegExp(`(,\\s*)?${p.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(,\\s*)?`, 'gi');
        updated = updated.replace(regex, (m, p1, p2) => (p1 && p2 ? ', ' : ''));
      });
      setNegativePrompt(updated.trim().replace(/^,\s*|,\s*$/g, ''));
    } else {
      const trimmed = negativePrompt.trim();
      if (!trimmed) {
        setNegativePrompt(tag);
      } else if (trimmed.endsWith(',')) {
        setNegativePrompt(`${trimmed} ${tag}`);
      } else {
        setNegativePrompt(`${trimmed}, ${tag}`);
      }
    }
  };

  const handleApplyVideoPhotorealismShield = () => {
    haptic.trigger('success');
    setNegativePrompt(
      'blurry frames, flickering, jitter, unnatural morphing, faded colors, washed out, low contrast, distorted anatomy, stuttering, artifacts'
    );
  };

  // Render & Playback State
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [renderedItem, setRenderedItem] = useState<GenerationItem | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLooping, setIsLooping] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Update if incoming preloaded item changes
  useEffect(() => {
    if (preloadedImageUrl) {
      setSourceImage(preloadedImageUrl);
      if (preloadedPrompt) setSourcePrompt(preloadedPrompt);
      setActiveMode('image-to-video');
    }
  }, [preloadedImageUrl, preloadedPrompt]);

  useEffect(() => {
    if (preloadedExtendItem) {
      setVideoToExtend(preloadedExtendItem);
      setActiveMode('extend');
    }
  }, [preloadedExtendItem]);

  // Video element event listeners
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setVideoDuration(videoRef.current.duration || duration);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    haptic.trigger('selection');
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSourceImage(event.target.result as string);
          setSourcePrompt(file.name.replace(/\.[^/.]+$/, ''));
          haptic.trigger('success');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Convert Image to Video Handler
  const handleRenderImageToVideo = async () => {
    if (!sourceImage || isRendering) return;
    haptic.trigger('impactHeavy');
    setIsRendering(true);
    setRenderProgress(5);
    setIsSaved(false);

    try {
      const result = await VideoEngine.renderImageToVideo({
        imageUrl: sourceImage,
        motionStyle,
        duration,
        prompt: sourcePrompt,
        negativePrompt: negativePrompt.trim() || undefined,
        fps: 30,
        onProgress: (p) => setRenderProgress(p),
      });

      setRenderedVideoUrl(result.videoUrl);
      const newItem: GenerationItem = {
        id: `gen_vid_${Date.now()}`,
        userId: 'current',
        type: 'video',
        prompt: sourcePrompt,
        negativePrompt: negativePrompt.trim() || undefined,
        model: 'noman-motion-engine',
        modelLabel: 'NoMan Cinematic Motion v2.4',
        provider: 'pollinations',
        aspectRatio: '16:9',
        width: 1280,
        height: 720,
        mediaUrl: result.videoUrl,
        thumbnailUrl: sourceImage,
        seed: Math.floor(Math.random() * 999999),
        steps: 30,
        cfgScale: 7.0,
        createdAt: Date.now(),
        isFavorite: false,
        tags: ['Video', motionStyle, 'Image-to-Video'],
        videoMetadata: {
          duration: result.duration,
          fps: 30,
          motionStyle,
          sourceImageUrl: sourceImage,
        },
      };

      setRenderedItem(newItem);
      haptic.trigger('success');
      if (settings.autoSave) {
        onSaveGeneration(newItem);
        setIsSaved(true);
      }
    } catch (e) {
      console.error('Video render error:', e);
      haptic.trigger('warning');
    } finally {
      setIsRendering(false);
    }
  };

  // Extend Video Handler
  const handleRenderExtendVideo = async () => {
    if (!videoToExtend || isRendering) return;
    haptic.trigger('impactHeavy');
    setIsRendering(true);
    setRenderProgress(5);
    setIsSaved(false);

    try {
      // 1. Generate continuation image keyframe with photorealism & negative prompt
      const baseImg = videoToExtend.thumbnailUrl || videoToExtend.mediaUrl;
      const continuationGen = await ImageGeneratorService.generateImage({
        prompt: `${extensionPrompt}, highly detailed cinematic continuation frame, photorealistic textures, 8k`,
        negativePrompt: negativePrompt.trim() || undefined,
        model: 'flux-realism',
        provider: 'pollinations',
        aspectRatio: videoToExtend.aspectRatio,
        width: videoToExtend.width || 1280,
        height: videoToExtend.height || 720,
        seed: Math.floor(Math.random() * 9999999),
        realismBoost: true,
      });

      // 2. Stitch and extend sequence
      const existingDur = videoToExtend.videoMetadata?.duration || 4;
      const result = await VideoEngine.renderExtendedVideo({
        baseImageUrl: baseImg,
        continuationImageUrl: continuationGen.imageUrl,
        existingDuration: existingDur,
        extensionDuration,
        existingMotion: videoToExtend.videoMetadata?.motionStyle || 'zoom-in',
        continuationMotion: extensionMotion,
        prompt: extensionPrompt,
        negativePrompt: negativePrompt.trim() || undefined,
        fps: 30,
        onProgress: (p) => setRenderProgress(p),
      });

      setRenderedVideoUrl(result.videoUrl);
      const extendedItem: GenerationItem = {
        id: `gen_ext_${Date.now()}`,
        userId: 'current',
        type: 'video',
        prompt: `${videoToExtend.prompt} [Extended: ${extensionPrompt}]`,
        negativePrompt: negativePrompt.trim() || undefined,
        model: 'noman-motion-engine',
        modelLabel: 'NoMan Extended Sequence v2.4',
        provider: 'pollinations',
        aspectRatio: videoToExtend.aspectRatio,
        width: videoToExtend.width || 1280,
        height: videoToExtend.height || 720,
        mediaUrl: result.videoUrl,
        thumbnailUrl: continuationGen.imageUrl,
        seed: continuationGen.seed,
        steps: 30,
        cfgScale: 7.0,
        createdAt: Date.now(),
        isFavorite: false,
        tags: ['Video', 'Extended-Sequence', extensionMotion],
        videoMetadata: {
          duration: result.duration,
          fps: 30,
          motionStyle: extensionMotion,
          isExtended: true,
          parentMediaId: videoToExtend.id,
          extensionCount: (videoToExtend.videoMetadata?.extensionCount || 0) + 1,
          timelineSegments: [
            ...(videoToExtend.videoMetadata?.timelineSegments || [
              { id: 'seg_1', prompt: videoToExtend.prompt, duration: existingDur, motionStyle: videoToExtend.videoMetadata?.motionStyle || 'zoom-in' }
            ]),
            { id: `seg_${Date.now()}`, prompt: extensionPrompt, duration: extensionDuration, motionStyle: extensionMotion }
          ]
        },
      };

      setRenderedItem(extendedItem);
      haptic.trigger('success');
      if (settings.autoSave) {
        onSaveGeneration(extendedItem);
        setIsSaved(true);
      }
    } catch (e) {
      console.error('Video extension error:', e);
      haptic.trigger('warning');
    } finally {
      setIsRendering(false);
    }
  };

  // Text to Video Handler
  const handleRenderTextToVideo = async () => {
    if (!textPrompt.trim() || isRendering) return;
    haptic.trigger('impactHeavy');
    setIsRendering(true);
    setRenderProgress(10);
    setIsSaved(false);
    setRenderError(null);

    try {
      const selectedProvider = settings.videoExecutionMethod === 'cloud'
        ? settings.videoCloudProvider
        : 'pollinations';
      const providerDefinition = MEDIA_PROVIDERS.find((provider) => provider.id === selectedProvider);
      const configuredVideoModel = settings.customModels.find(
        (model) =>
          model.provider === selectedProvider &&
          (model.type === 'video' || model.type === 'both') &&
          !['noman-motion-engine', 'webgpu-neural-motion'].includes(model.id)
      )?.id;
      const videoModel =
        configuredVideoModel ||
        (selectedProvider === 'pollinations'
          ? 'wan'
          : selectedProvider === 'byteplus'
          ? 'seedance-1-0-pro-250528'
          : '');

      let result: { videoUrl: string; duration: number; seed: number };
      let thumbnailUrl: string | undefined;
      let generationProvider: AIProvider = selectedProvider as AIProvider;
      let generationModel = videoModel;

      if (settings.videoExecutionMethod === 'cloud') {
        if (!providerDefinition?.supports.includes('video')) {
          throw new Error(
            `${providerDefinition?.label || selectedProvider} does not advertise video generation.`
          );
        }
        if (!videoModel) {
          throw new Error(
            `Add a video model for ${providerDefinition.label} in Settings → Custom Models before using it.`
          );
        }

        const cloudResult = await ImageGeneratorService.generateVideo({
          prompt: textPrompt,
          negativePrompt: negativePrompt.trim() || undefined,
          model: videoModel,
          provider: selectedProvider as AIProvider,
          aspectRatio: '16:9',
          width: 1280,
          height: 720,
          duration,
          seed: Math.floor(Math.random() * 999999),
          providerKeys: settings.providerKeys,
          providerBaseUrls: settings.providerBaseUrls,
          customProvider: settings.customProvider,
        });
        result = { ...cloudResult, duration };
      } else {
        // Local fallback: create a keyframe, then render a deterministic motion clip.
        const keyframe = await ImageGeneratorService.generateImage({
          prompt: `${textPrompt}, cinematic widescreen frame, 8k, dynamic composition, photorealistic direct lighting, sharp focus`,
          negativePrompt: negativePrompt.trim() || undefined,
          model: 'flux-realism',
          provider: 'pollinations',
          aspectRatio: '16:9',
          width: 1280,
          height: 720,
          seed: Math.floor(Math.random() * 999999),
          realismBoost: true,
        });
        thumbnailUrl = keyframe.imageUrl;
        generationProvider = 'pollinations';
        generationModel = 'noman-motion-engine';
        setRenderProgress(35);

        result = await VideoEngine.renderImageToVideo({
          imageUrl: keyframe.imageUrl,
          motionStyle,
          duration,
          prompt: textPrompt,
          negativePrompt: negativePrompt.trim() || undefined,
          fps: 30,
          onProgress: (p) => setRenderProgress(35 + Math.round(p * 0.65)),
        }).then((rendered) => ({ ...rendered, seed: keyframe.seed }));
      }

      setRenderedVideoUrl(result.videoUrl);
      const newItem: GenerationItem = {
        id: `gen_vid_${Date.now()}`,
        userId: 'current',
        type: 'video',
        prompt: textPrompt,
        negativePrompt: negativePrompt.trim() || undefined,
        model: generationModel || 'custom-video',
        modelLabel:
          settings.videoExecutionMethod === 'cloud'
            ? providerDefinition?.label || 'Cloud video provider'
            : 'NoMan Text-to-Video v2.4',
        provider: generationProvider,
        aspectRatio: '16:9',
        width: 1280,
        height: 720,
        mediaUrl: result.videoUrl,
        thumbnailUrl,
        seed: result.seed,
        steps: 30,
        cfgScale: 7.0,
        createdAt: Date.now(),
        isFavorite: false,
        tags: ['Text-to-Video', motionStyle],
        videoMetadata: {
          duration: result.duration,
          fps: 30,
          motionStyle,
          ...(thumbnailUrl ? { sourceImageUrl: thumbnailUrl } : {}),
        },
      };

      setRenderedItem(newItem);
      haptic.trigger('success');
      if (settings.autoSave) {
        onSaveGeneration(newItem);
        setIsSaved(true);
      }
    } catch (e) {
      console.error('Text to video error:', e);
      setRenderError(e instanceof Error ? e.message : 'Video generation failed.');
      haptic.trigger('warning');
    } finally {
      setIsRendering(false);
    }
  };

  const getMotionIcon = (style: MotionStyle) => {
    switch (style) {
      case 'zoom-in': return ZoomIn;
      case 'pan-left': return MoveLeft;
      case 'pan-right': return MoveRight;
      case 'orbit-360': return RotateCw;
      case 'parallax-drift': return Layers;
      default: return Sparkles;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-6">
      {/* Title & Mode Tabs */}
      <div className="space-y-3 border-b border-slate-800/80 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Video Lab & Extension Studio</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-800/60 font-mono">
                60 FPS Engine
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Generate text-to-video through a configured cloud adapter, or use the local canvas renderer for image-to-video and timeline extension.
            </p>
            {renderError && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-[11px] text-rose-200">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                <span>{renderError}</span>
              </div>
            )}
          </div>

          {/* Provider / Execution Agent Pill */}
          <button
            type="button"
            onClick={() => {
              haptic.trigger('selection');
              setIsProviderModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-violet-500 text-xs text-slate-200 transition-all active:scale-95 shadow-sm self-start sm:self-auto shrink-0"
            title="Configure Video Provider: Local Workstation vs Cloud APIs"
          >
            {settings.videoExecutionMethod === 'local' ? (
              <>
                <Server className="w-3.5 h-3.5 text-violet-400" />
                <span className="font-semibold text-violet-300">
                  {settings.videoLocalProvider === 'webgpu' ? 'Local · WebGPU' : 'Local · Workstation'}
                </span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold text-cyan-300">
                  {settings.videoCloudProvider === 'huggingface'
                    ? 'Cloud · HF SVD'
                    : settings.videoCloudProvider === 'gemini'
                    ? 'Cloud · Gemini'
                    : 'Cloud · 60fps Motion'}
                </span>
              </>
            )}
            <Settings2 className="w-3 h-3 text-slate-400 ml-0.5" />
          </button>
        </div>

        {/* Mode Segmented Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-xl border border-slate-800">
          <button
            onClick={() => {
              haptic.trigger('selection');
              setActiveMode('image-to-video');
            }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all min-h-[40px] flex items-center justify-center gap-1.5 ${
              activeMode === 'image-to-video'
                ? 'bg-slate-100 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Image to Video</span>
          </button>

          <button
            onClick={() => {
              haptic.trigger('selection');
              setActiveMode('extend');
            }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all min-h-[40px] flex items-center justify-center gap-1.5 ${
              activeMode === 'extend'
                ? 'bg-slate-100 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-cyan-500" />
            <span>Extend Video</span>
          </button>

          <button
            onClick={() => {
              haptic.trigger('selection');
              setActiveMode('text-to-video');
            }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all min-h-[40px] flex items-center justify-center gap-1.5 ${
              activeMode === 'text-to-video'
                ? 'bg-slate-100 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Text to Video</span>
          </button>
        </div>
      </div>

      {/* Mode 1: Convert Image to Video */}
      {activeMode === 'image-to-video' && (
        <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Source Visual Keyframe
            </span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Custom Photo</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Current Source Image Viewport */}
          <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 h-52 sm:h-64 flex items-center justify-center group">
            <img
              src={sourceImage}
              alt="Source keyframe"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-3.5">
              <span className="text-xs text-slate-200 font-medium truncate max-w-full">
                "{sourcePrompt}"
              </span>
            </div>
          </div>

          {/* Pick from Library Thumbnails */}
          {libraryItems.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-slate-400">Or pick from your saved creations:</span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {libraryItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      haptic.trigger('selection');
                      setSourceImage(item.thumbnailUrl || item.mediaUrl);
                      setSourcePrompt(item.prompt);
                    }}
                    className={`relative w-16 h-16 rounded-lg overflow-hidden border shrink-0 transition-all ${
                      sourceImage === (item.thumbnailUrl || item.mediaUrl)
                        ? 'border-cyan-400 ring-2 ring-cyan-500/40'
                        : 'border-slate-800 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={item.thumbnailUrl || item.mediaUrl}
                      alt={item.prompt}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Negative Prompt Section (Mode 1) */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="video-negative-prompt-1" className="flex items-center gap-1.5 text-xs font-semibold text-rose-300 uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5 text-rose-400" />
                <span>Negative Prompt (Exclude in Motion & Frame Clarity)</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyVideoPhotorealismShield}
                  className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1 bg-violet-950/70 px-2 py-0.5 rounded-md border border-violet-800/60 transition-all active:scale-95 shadow-sm"
                  title="Apply anti-jitter and anti-blur shield"
                >
                  <ShieldCheck className="w-3 h-3 text-violet-400" />
                  <span>Video Motion Shield</span>
                </button>
                {negativePrompt && (
                  <button
                    type="button"
                    onClick={() => setNegativePrompt('')}
                    className="text-slate-500 hover:text-slate-300 text-[11px]"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <textarea
              id="video-negative-prompt-1"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="e.g. blurry frames, flickering, jitter, unnatural morphing, faded colors..."
              rows={2}
              className="w-full bg-slate-900/90 text-slate-100 placeholder-slate-500 rounded-xl p-3 text-xs border border-rose-950/60 focus:border-rose-400/80 focus:outline-none resize-none font-mono"
            />
            {/* Quick negative chips */}
            <div className="flex flex-wrap gap-1.5">
              {quickNegativeVideoTags.map((item) => {
                const first = item.tag.split(',')[0].trim().toLowerCase();
                const isPresent = negativePrompt.toLowerCase().includes(first);
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleToggleNegativeTag(item.tag)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 active:scale-95 ${
                      isPresent
                        ? 'bg-rose-950/80 border border-rose-500/60 text-rose-200 shadow-sm'
                        : 'bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400'
                    }`}
                  >
                    {isPresent ? <Check className="w-2.5 h-2.5 text-rose-400" /> : <Plus className="w-2.5 h-2.5 text-slate-500" />}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Motion Style Selector */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Camera Motion Dynamics
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MOTION_STYLES.map((style) => {
                const isSelected = motionStyle === style.id;
                const Icon = getMotionIcon(style.id);
                return (
                  <button
                    key={style.id}
                    onClick={() => {
                      haptic.trigger('selection');
                      setMotionStyle(style.id);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all min-h-[64px] flex flex-col justify-between ${
                      isSelected
                        ? 'bg-violet-950/60 border-violet-400 text-white shadow-sm'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-100">{style.label}</span>
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-violet-300' : 'text-slate-500'}`} />
                    </div>
                    <span className="text-[10px] text-slate-400 line-clamp-1 mt-1">
                      {style.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration Slider */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-300 mb-1.5">
              <span>Clip Duration</span>
              <span className="font-mono text-cyan-400">{duration} Seconds ({duration * 30} Frames)</span>
            </div>
            <input
              type="range"
              min={2}
              max={8}
              step={1}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>2s (Quick loop)</span>
              <span>4s (Standard)</span>
              <span>8s (Extended cinema)</span>
            </div>
          </div>

          {/* Render Action Button */}
          <div className="pt-2">
            <button
              onClick={handleRenderImageToVideo}
              disabled={isRendering}
              className={`w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg min-h-[48px] ${
                isRendering
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white shadow-violet-500/20 active:scale-[0.98]'
              }`}
            >
              {isRendering ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Synthesizing Video Frames ({renderProgress}%)...</span>
                </>
              ) : (
                <>
                  <Video className="w-4 h-4" />
                  <span>Animate Keyframe into Video</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Mode 2: Extend Video */}
      {activeMode === 'extend' && (
        <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Base Video Timeline & Multi-Scene Extension
            </span>
            <span className="text-[11px] text-cyan-400 font-mono">
              Timeline Stitcher
            </span>
          </div>

          {/* Base Video Selector */}
          {videoToExtend ? (
            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center gap-3">
              <div className="w-16 h-12 rounded-lg overflow-hidden bg-slate-950 shrink-0 border border-slate-700">
                <img
                  src={videoToExtend.thumbnailUrl || videoToExtend.mediaUrl}
                  alt={videoToExtend.prompt}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white truncate">{videoToExtend.prompt}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
                  <span>Duration: {videoToExtend.videoMetadata?.duration || 4}s</span>
                  <span>·</span>
                  <span>Ext Count: {videoToExtend.videoMetadata?.extensionCount || 0}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-900/60 border border-dashed border-slate-800 text-center text-xs text-slate-400">
              No base video selected. Pick a video below or generate one in Image-to-Video mode first.
            </div>
          )}

          {/* Multi-Scene Timeline Visual Track */}
          <div className="space-y-1.5 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
              Multi-Scene Timeline Track
            </span>
            <div className="flex items-center gap-2 overflow-x-auto py-2 no-scrollbar">
              {/* Scene 1 (Original) */}
              <div className="min-w-[130px] p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs">
                <span className="text-[10px] text-slate-400 font-mono block">Scene 01 (Base)</span>
                <span className="font-semibold text-white truncate block mt-0.5">
                  {videoToExtend?.videoMetadata?.duration || 4}s Duration
                </span>
                <span className="text-[10px] text-cyan-400 mt-1 block">
                  {videoToExtend?.videoMetadata?.motionStyle || 'zoom-in'}
                </span>
              </div>

              {/* Seamless Cut Arrow */}
              <div className="shrink-0 flex items-center text-slate-500">
                <ArrowRight className="w-4 h-4" />
              </div>

              {/* Scene 2 (Extension) */}
              <div className="min-w-[160px] p-2.5 rounded-lg bg-violet-950/50 border border-violet-500/50 text-xs">
                <span className="text-[10px] text-violet-300 font-mono block">+ Scene 02 (New Extension)</span>
                <span className="font-semibold text-white truncate block mt-0.5">
                  +{extensionDuration}s Additional
                </span>
                <span className="text-[10px] text-cyan-300 mt-1 block">
                  {extensionMotion}
                </span>
              </div>
            </div>
          </div>

          {/* Extension Prompt Input */}
          <div className="space-y-1.5">
            <label htmlFor="extension-prompt" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Extension Continuation Cue
            </label>
            <textarea
              id="extension-prompt"
              value={extensionPrompt}
              onChange={(e) => setExtensionPrompt(e.target.value)}
              placeholder="Describe where the camera or scene moves next..."
              rows={2}
              className="w-full bg-slate-900 text-slate-100 placeholder-slate-500 rounded-xl p-3 text-xs border border-slate-700/80 focus:border-cyan-400 focus:outline-none resize-none"
            />
          </div>

          {/* Negative Prompt Section (Mode 2) */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="video-negative-prompt-2" className="flex items-center gap-1.5 text-xs font-semibold text-rose-300 uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5 text-rose-400" />
                <span>Negative Prompt (Exclude in Extension Motion)</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyVideoPhotorealismShield}
                  className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1 bg-violet-950/70 px-2 py-0.5 rounded-md border border-violet-800/60 transition-all active:scale-95 shadow-sm"
                  title="Apply anti-jitter and anti-blur shield"
                >
                  <ShieldCheck className="w-3 h-3 text-violet-400" />
                  <span>Video Motion Shield</span>
                </button>
                {negativePrompt && (
                  <button
                    type="button"
                    onClick={() => setNegativePrompt('')}
                    className="text-slate-500 hover:text-slate-300 text-[11px]"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <textarea
              id="video-negative-prompt-2"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="e.g. blurry frames, flickering, jitter, unnatural morphing, faded colors..."
              rows={2}
              className="w-full bg-slate-900/90 text-slate-100 placeholder-slate-500 rounded-xl p-3 text-xs border border-rose-950/60 focus:border-rose-400/80 focus:outline-none resize-none font-mono"
            />
            {/* Quick negative chips */}
            <div className="flex flex-wrap gap-1.5">
              {quickNegativeVideoTags.map((item) => {
                const first = item.tag.split(',')[0].trim().toLowerCase();
                const isPresent = negativePrompt.toLowerCase().includes(first);
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleToggleNegativeTag(item.tag)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 active:scale-95 ${
                      isPresent
                        ? 'bg-rose-950/80 border border-rose-500/60 text-rose-200 shadow-sm'
                        : 'bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400'
                    }`}
                  >
                    {isPresent ? <Check className="w-2.5 h-2.5 text-rose-400" /> : <Plus className="w-2.5 h-2.5 text-slate-500" />}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Extension Duration & Motion Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
            <div>
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
                Extend Duration (+Seconds)
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[3, 5, 8].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => {
                      haptic.trigger('selection');
                      setExtensionDuration(sec);
                    }}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                      extensionDuration === sec
                        ? 'bg-violet-900/60 border-violet-400 text-violet-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    +{sec}s
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
                Extension Camera Angle
              </span>
              <select
                value={extensionMotion}
                onChange={(e) => {
                  haptic.trigger('selection');
                  setExtensionMotion(e.target.value as MotionStyle);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none font-medium"
              >
                {MOTION_STYLES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Extend Action Button */}
          <div className="pt-2">
            <button
              onClick={handleRenderExtendVideo}
              disabled={!videoToExtend || isRendering}
              className={`w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg min-h-[48px] ${
                !videoToExtend || isRendering
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-500 via-indigo-600 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white shadow-cyan-500/20 active:scale-[0.98]'
              }`}
            >
              {isRendering ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Stitching Extended Sequence ({renderProgress}%)...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Render Extended Video Clip</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Mode 3: Text to Video */}
      {activeMode === 'text-to-video' && (
        <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <label htmlFor="text-video-prompt" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Text to Motion Video Prompt
          </label>
          <textarea
            id="text-video-prompt"
            value={textPrompt}
            onChange={(e) => setTextPrompt(e.target.value)}
            placeholder="Describe an entire scene in motion..."
            rows={3}
            className="w-full bg-slate-900 text-slate-100 placeholder-slate-500 rounded-xl p-3.5 text-sm border border-slate-700/80 focus:border-cyan-400 focus:outline-none resize-none"
          />

          {/* Negative Prompt Section (Mode 3) */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="video-negative-prompt-3" className="flex items-center gap-1.5 text-xs font-semibold text-rose-300 uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5 text-rose-400" />
                <span>Negative Prompt (Exclude in Motion & Keyframe)</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyVideoPhotorealismShield}
                  className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1 bg-violet-950/70 px-2 py-0.5 rounded-md border border-violet-800/60 transition-all active:scale-95 shadow-sm"
                  title="Apply anti-jitter and anti-blur shield"
                >
                  <ShieldCheck className="w-3 h-3 text-violet-400" />
                  <span>Video Motion Shield</span>
                </button>
                {negativePrompt && (
                  <button
                    type="button"
                    onClick={() => setNegativePrompt('')}
                    className="text-slate-500 hover:text-slate-300 text-[11px]"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <textarea
              id="video-negative-prompt-3"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="e.g. blurry frames, flickering, jitter, unnatural morphing, faded colors..."
              rows={2}
              className="w-full bg-slate-900/90 text-slate-100 placeholder-slate-500 rounded-xl p-3 text-xs border border-rose-950/60 focus:border-rose-400/80 focus:outline-none resize-none font-mono"
            />
            {/* Quick negative chips */}
            <div className="flex flex-wrap gap-1.5">
              {quickNegativeVideoTags.map((item) => {
                const first = item.tag.split(',')[0].trim().toLowerCase();
                const isPresent = negativePrompt.toLowerCase().includes(first);
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleToggleNegativeTag(item.tag)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 active:scale-95 ${
                      isPresent
                        ? 'bg-rose-950/80 border border-rose-500/60 text-rose-200 shadow-sm'
                        : 'bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400'
                    }`}
                  >
                    {isPresent ? <Check className="w-2.5 h-2.5 text-rose-400" /> : <Plus className="w-2.5 h-2.5 text-slate-500" />}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
            <div>
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
                Camera Motion Path
              </span>
              <select
                value={motionStyle}
                onChange={(e) => {
                  haptic.trigger('selection');
                  setMotionStyle(e.target.value as MotionStyle);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none font-medium"
              >
                {MOTION_STYLES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
                Video Duration
              </span>
              <div className="flex gap-2">
                {[3, 5, 8].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      haptic.trigger('selection');
                      setDuration(s);
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                      duration === s
                        ? 'bg-cyan-950 border-cyan-400 text-cyan-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleRenderTextToVideo}
            disabled={!textPrompt.trim() || isRendering}
            className={`w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg min-h-[48px] ${
              !textPrompt.trim() || isRendering
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 text-white shadow-cyan-500/20 active:scale-[0.98]'
            }`}
          >
            {isRendering ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Generating Text-to-Video ({renderProgress}%)...</span>
              </>
            ) : (
              <>
                <Video className="w-4 h-4" />
                <span>Generate Video from Prompt</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Rendered Video Player Showcase */}
      {(renderedVideoUrl || renderedItem) && (
        <div className="glass-panel rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 border border-violet-500/30">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              <h2 className="text-sm font-bold text-white">Synthesized Motion Video</h2>
              <span className="text-slate-500 text-xs">·</span>
              <span className="text-xs text-slate-400 font-mono">
                {renderedItem?.videoMetadata?.isExtended ? 'Extended Sequence' : 'Single Scene'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (renderedItem) {
                    haptic.trigger('selection');
                    onSaveGeneration(renderedItem);
                    setIsSaved(true);
                  }
                }}
                disabled={isSaved}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isSaved
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-750'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{isSaved ? 'Saved to Library' : 'Save Video'}</span>
              </button>
            </div>
          </div>

          {/* Video Viewport & Controls */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center group">
            <video
              ref={videoRef}
              src={renderedVideoUrl || renderedItem?.mediaUrl}
              autoPlay
              playsInline
              loop={isLooping}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              className="w-full h-full object-contain"
            />

            {/* Play/Pause Overlay */}
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors"
            >
              {!isPlaying && (
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-xl">
                  <Play className="w-6 h-6 fill-white ml-1" />
                </div>
              )}
            </button>
          </div>

          {/* Video Playback Bar */}
          <div className="space-y-2 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              {/* Progress Slider */}
              <input
                type="range"
                min={0}
                max={videoDuration || 1}
                step={0.05}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 accent-cyan-400 cursor-pointer"
              />

              {/* Timecode */}
              <span className="text-[11px] font-mono text-slate-400 tabular-nums shrink-0">
                {currentTime.toFixed(1)}s / {(videoDuration || duration).toFixed(1)}s
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    haptic.trigger('selection');
                    setIsLooping(!isLooping);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    isLooping ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/60' : 'text-slate-500'
                  }`}
                >
                  Loop
                </button>
                <button
                  onClick={() => {
                    haptic.trigger('selection');
                    const speeds = [0.5, 1.0, 1.5, 2.0];
                    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
                    const next = speeds[nextIdx];
                    setPlaybackSpeed(next);
                    if (videoRef.current) videoRef.current.playbackRate = next;
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300"
                >
                  {playbackSpeed}x Speed
                </button>
              </div>

              {/* Extend further CTA right on the player */}
              {renderedItem && (
                <button
                  onClick={() => {
                    haptic.trigger('selection');
                    setVideoToExtend(renderedItem);
                    setActiveMode('extend');
                  }}
                  className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Extend Timeline (+3s)</span>
                </button>
              )}
            </div>
          </div>

          {/* Download & Export */}
          <div className="flex gap-2">
            <a
              href={renderedVideoUrl || renderedItem?.mediaUrl}
              download={`noman_video_${Date.now()}.webm`}
              target="_blank"
              rel="noreferrer"
              onClick={() => haptic.trigger('selection')}
              className="flex-1 h-11 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700/80 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>Download Master Video File</span>
            </a>
          </div>
        </div>
      )}

      {/* Provider & Execution Agent Setup Modal */}
      {isProviderModalOpen && (
        <ProviderAgentSetupModal
          isOpen={isProviderModalOpen}
          onClose={() => setIsProviderModalOpen(false)}
          settings={settings}
          onUpdateSettings={onUpdateSettings || (() => {})}
          initialTab="video"
        />
      )}
    </div>
  );
};
