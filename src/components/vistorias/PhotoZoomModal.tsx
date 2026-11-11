"use client";

import React from "react";

interface PhotoZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  title?: string;
  subtitle?: string;
}

export default function PhotoZoomModal({
  isOpen,
  onClose,
  imageUrl,
  title = "Fotografia da Vistoria",
  subtitle
}: PhotoZoomModalProps) {
  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white">
          <div>
            <h4 className="text-base font-bold text-slate-100">{title}</h4>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white text-base font-bold transition"
          >
            ✕
          </button>
        </div>

        {/* High-res Image Viewer */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/60 min-h-[350px] max-h-[70vh]">
          <img
            src={imageUrl}
            alt={title}
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg select-none"
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Evidência fotográfica homologada do atendimento G-Tech</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold transition"
          >
            Fechar Visualização
          </button>
        </div>
      </div>
    </div>
  );
}

