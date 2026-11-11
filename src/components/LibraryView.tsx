import React, { useState } from 'react';
import type { GenerationItem, User } from '../types';
import {
  FolderHeart,
  Search,
  Filter,
  Image as ImageIcon,
  Video,
  Heart,
  Download,
  Trash2,
  Copy,
  Check,
  Plus,
  Play,
  Share2,
  FileDown,
  FileUp,
  X,
  ExternalLink,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import { haptic } from '../utils/haptics';
import { UpscaleModal } from './UpscaleModal';

interface LibraryViewProps {
  items: GenerationItem[];
  user: User;
  hfToken?: string;
  onDeleteItem: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onSendToVideoLab: (imageUrl: string, prompt: string) => void;
  onExtendVideo: (item: GenerationItem) => void;
  onSaveGeneration?: (item: GenerationItem) => void;
  onExportData: () => void;
  onImportData: (jsonStr: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  items,
  user,
  hfToken,
  onDeleteItem,
  onToggleFavorite,
  onSendToVideoLab,
  onExtendVideo,
  onSaveGeneration,
  onExportData,
  onImportData,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video' | 'favorite'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<GenerationItem | null>(null);
  const [itemToUpscale, setItemToUpscale] = useState<GenerationItem | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');

  // Filter items
  const filteredItems = items.filter((item) => {
    if (filterType === 'image' && item.type !== 'image') return false;
    if (filterType === 'video' && item.type !== 'video') return false;
    if (filterType === 'favorite' && !item.isFavorite) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.prompt.toLowerCase().includes(q) ||
        item.model.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    haptic.trigger('selection');
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleImportSubmit = () => {
    if (!importJsonText.trim()) return;
    haptic.trigger('selection');
    onImportData(importJsonText);
    setShowImportDialog(false);
    setImportJsonText('');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-6">
      {/* Header and User profile summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Saved Creations & Library</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono">
              {items.length} Assets
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Persisted locally in your browser storage for account <strong className="text-slate-200">@{user.username}</strong>.
          </p>
        </div>

        {/* Backup & Restore Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              haptic.trigger('selection');
              onExportData();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
            title="Export all creations to JSON backup"
          >
            <FileDown className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export Backup</span>
          </button>

          <button
            onClick={() => {
              haptic.trigger('selection');
              setShowImportDialog(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
            title="Restore creations from JSON backup"
          >
            <FileUp className="w-3.5 h-3.5 text-violet-400" />
            <span>Import</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prompts, models, tags..."
            className="w-full bg-slate-900 text-slate-100 placeholder-slate-500 rounded-xl pl-9 pr-3.5 py-2 text-xs border border-slate-800 focus:border-cyan-400 focus:outline-none"
          />
        </div>

        {/* Filter Segmented Buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/90 rounded-xl border border-slate-800 shrink-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'image', label: 'Images' },
            { id: 'video', label: 'Videos' },
            { id: 'favorite', label: 'Favorites' },
          ].map((tab) => {
            const isSelected = filterType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  haptic.trigger('selection');
                  setFilterType(tab.id as any);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  isSelected
                    ? 'bg-slate-100 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Creations */}
      {filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-3">
          <FolderHeart className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-300">No creations found</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            {searchQuery
              ? 'No items match your search query. Try clearing the search.'
              : 'Generate images or videos in the Studio to build your private collection.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filteredItems.map((item) => {
            const isVid = item.type === 'video';

            return (
              <div
                key={item.id}
                onClick={() => {
                  haptic.trigger('selection');
                  setSelectedItem(item);
                }}
                className="group relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800/80 hover:border-cyan-500/50 cursor-pointer transition-all aspect-square flex flex-col justify-between"
              >
                {/* Media Thumbnail */}
                <img
                  src={item.thumbnailUrl || item.mediaUrl}
                  alt={item.prompt}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Top Badges Overlay */}
                <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                  <div className="flex items-center gap-1">
                    {isVid ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md text-[10px] font-bold text-cyan-300 border border-cyan-500/30">
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>{item.videoMetadata?.duration || 4}s</span>
                      </span>
                    ) : (
                      <>
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-950/70 text-[9px] font-mono text-slate-300">
                          {item.aspectRatio}
                        </span>
                        {item.isUpscaled && (
                          <span className="px-1.5 py-0.5 rounded-md bg-cyan-950/90 border border-cyan-500/40 text-[9px] font-mono font-bold text-cyan-300">
                            {item.upscaleFactor}x HD
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {!isVid && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          haptic.trigger('selection');
                          setItemToUpscale(item);
                        }}
                        className="pointer-events-auto p-1.5 rounded-full bg-slate-950/70 hover:bg-slate-900 text-slate-300 hover:text-cyan-400 transition-colors"
                        title="Upscale 2x or 4x Resolution"
                      >
                        <Maximize2 className="w-3 h-3" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        haptic.trigger('selection');
                        onToggleFavorite(item.id);
                      }}
                      className="pointer-events-auto p-1.5 rounded-full bg-slate-950/70 hover:bg-slate-900 text-slate-300 transition-colors"
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          item.isFavorite ? 'fill-rose-500 text-rose-500' : 'text-white'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Bottom Scrim & Caption */}
                <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                  <p className="text-[11px] font-medium text-white line-clamp-1">
                    {item.prompt}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                    <span className="truncate max-w-[90px]">{item.modelLabel}</span>
                    <span className="font-mono text-slate-500">
                      {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Media Inspector Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400">
                  {selectedItem.type.toUpperCase()}
                </span>
                <span className="text-xs text-slate-300 font-bold truncate max-w-xs">
                  {selectedItem.modelLabel}
                </span>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Viewport */}
            <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center max-h-[460px]">
              {selectedItem.type === 'video' ? (
                <video
                  src={selectedItem.mediaUrl}
                  autoPlay
                  loop
                  playsInline
                  controls
                  className="max-h-[460px] w-auto max-w-full"
                />
              ) : (
                <img
                  src={selectedItem.mediaUrl}
                  alt={selectedItem.prompt}
                  referrerPolicy="no-referrer"
                  className="max-h-[460px] w-auto max-w-full object-contain"
                />
              )}
            </div>

            {/* Prompt & Details */}
            <div className="space-y-2 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Prompt</span>
                <button
                  onClick={() => handleCopy(selectedItem.prompt)}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
                >
                  {copiedPrompt ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedPrompt ? 'Copied' : 'Copy Prompt'}</span>
                </button>
              </div>
              <p className="text-slate-200 leading-relaxed italic">
                "{selectedItem.prompt}"
              </p>

              {/* Metadata tags */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-800">
                <span>Seed: {selectedItem.seed}</span>
                <span>Dimensions: {selectedItem.width}×{selectedItem.height}px</span>
                {selectedItem.isUpscaled && (
                  <span className="text-cyan-400 font-bold font-mono">
                    ✓ {selectedItem.upscaleFactor}x Super-Res
                  </span>
                )}
                {selectedItem.videoMetadata && (
                  <span>Duration: {selectedItem.videoMetadata.duration}s</span>
                )}
                {selectedItem.videoMetadata?.isExtended && (
                  <span className="text-violet-400 font-bold">Extended Sequence</span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
              {/* If Image: Upscale 2x / 4x CTA */}
              {selectedItem.type === 'image' && (
                <button
                  type="button"
                  onClick={() => {
                    haptic.trigger('selection');
                    const target = selectedItem;
                    setSelectedItem(null);
                    setItemToUpscale(target);
                  }}
                  className="flex-1 min-h-[42px] px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <Maximize2 className="w-4 h-4" />
                  <span>Upscale (2x / 4x)</span>
                </button>
              )}

              {/* If Image: Convert to Video */}
              {selectedItem.type === 'image' && (
                <button
                  type="button"
                  onClick={() => {
                    haptic.trigger('selection');
                    const img = selectedItem.mediaUrl;
                    const pr = selectedItem.prompt;
                    setSelectedItem(null);
                    onSendToVideoLab(img, pr);
                  }}
                  className="flex-1 min-h-[42px] px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <Video className="w-4 h-4" />
                  <span>Convert to Video</span>
                </button>
              )}

              {/* If Video: Extend Video */}
              {selectedItem.type === 'video' && (
                <button
                  onClick={() => {
                    haptic.trigger('selection');
                    const itm = selectedItem;
                    setSelectedItem(null);
                    onExtendVideo(itm);
                  }}
                  className="flex-1 min-h-[42px] px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Extend Video (+3s)</span>
                </button>
              )}

              {/* Download */}
              <a
                href={selectedItem.mediaUrl}
                download={`noman_${selectedItem.id}.${selectedItem.type === 'video' ? 'webm' : 'jpg'}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => haptic.trigger('selection')}
                className="px-4 min-h-[42px] rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </a>

              {/* Delete */}
              <button
                onClick={() => {
                  haptic.trigger('warning');
                  onDeleteItem(selectedItem.id);
                  setSelectedItem(null);
                }}
                className="px-3 min-h-[42px] rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-rose-800/60"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JSON Import Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white">Import Collection Backup</h3>
            <p className="text-xs text-slate-400">
              Paste the exported JSON data below to restore your creations and settings:
            </p>
            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder='{"app": "NoMan AI", "generations": [...] }'
              rows={6}
              className="w-full bg-slate-950 text-slate-200 text-xs rounded-xl p-3 border border-slate-800 focus:border-cyan-400 focus:outline-none font-mono"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowImportDialog(false)}
                className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleImportSubmit}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
              >
                Import Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Super-Resolution Upscaling Modal */}
      {itemToUpscale && (
        <UpscaleModal
          item={itemToUpscale}
          hfToken={hfToken}
          isOpen={!!itemToUpscale}
          onClose={() => setItemToUpscale(null)}
          onSaveUpscaled={(newItem) => {
            if (onSaveGeneration) onSaveGeneration(newItem);
            setItemToUpscale(null);
          }}
        />
      )}
    </div>
  );
};
