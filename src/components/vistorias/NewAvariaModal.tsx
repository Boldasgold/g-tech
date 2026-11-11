"use client";

import React, { useState } from "react";

interface NewAvariaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    region_name: string;
    damage_type: string;
    description: string;
    photo_file?: File | null;
    author_name: string;
  }) => Promise<void>;
  initialRegion?: string;
}

export default function NewAvariaModal({
  isOpen,
  onClose,
  onSave,
  initialRegion = "Para-choque Dianteiro & Grade"
}: NewAvariaModalProps) {
  const [regionName, setRegionName] = useState(initialRegion);
  const [damageType, setDamageType] = useState("Risco superficial");
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState("Giovane Ribeiro");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      alert("Por favor, descreva detalhadamente a avaria identificada.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        region_name: regionName,
        damage_type: damageType,
        description: description.trim(),
        photo_file: photoFile,
        author_name: authorName
      });
      onClose();
    } catch (err: any) {
      alert("Erro ao salvar avaria: " + (err.message || "Falha de conexão"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500" />
              <span>Registrar Nova Avaria na Vistoria</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Documente avarias pré-existentes na entrada ou ocorridas durante o atendimento
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 text-base font-bold transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Região do Veículo *
              </label>
              <select
                value={regionName}
                onChange={(e) => setRegionName(e.target.value)}
                className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="Para-choque Dianteiro & Grade">Para-choque Dianteiro & Grade</option>
                <option value="Capô do Motor">Capô do Motor</option>
                <option value="Para-brisa Dianteiro">Para-brisa Dianteiro</option>
                <option value="Teto da Cabine">Teto da Cabine</option>
                <option value="Para-lama Diant. Esquerdo">Para-lama Diant. Esquerdo</option>
                <option value="Portas Lado Esquerdo">Portas Lado Esquerdo</option>
                <option value="Para-lama Tras. Esquerdo">Para-lama Tras. Esquerdo</option>
                <option value="Para-lama Diant. Direito">Para-lama Diant. Direito</option>
                <option value="Portas Lado Direito">Portas Lado Direito</option>
                <option value="Para-lama Tras. Direito">Para-lama Tras. Direito</option>
                <option value="Porta-Malas / Tampa Traseira">Porta-Malas / Tampa Traseira</option>
                <option value="Para-choque Traseiro">Para-choque Traseiro</option>
                <option value="Vidro Traseiro">Vidro Traseiro</option>
                <option value="Rodas & Pneus">Rodas & Pneus</option>
                <option value="Interior & Painel">Interior & Painel</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Tipo de Avaria *
              </label>
              <select
                value={damageType}
                onChange={(e) => setDamageType(e.target.value)}
                className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="Risco superficial">Risco superficial</option>
                <option value="Risco profundo / lataria exposta">Risco profundo / lataria exposta</option>
                <option value="Amassado pequeno">Amassado pequeno</option>
                <option value="Amassado extenso / vinco">Amassado extenso / vinco</option>
                <option value="Trinca / Rachadura no vidro">Trinca / Rachadura no vidro</option>
                <option value="Quebrado / Peça solta">Quebrado / Peça solta</option>
                <option value="Pintura descascada / Queimada">Pintura descascada / Queimada</option>
                <option value="Desgaste acentuado / Rasgo">Desgaste acentuado / Rasgo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Descrição Detalhada da Avaria *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Ex: Risco de aprox. 12 cm na parte inferior da porta dianteira esquerda, próximo ao friso. Lataria não deformada."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-base text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Fotografia Comprobatória da Avaria (Opcional)
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50">
              {photoPreview ? (
                <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-slate-300 flex-shrink-0">
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                    }}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-black"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-400 text-2xl flex-shrink-0">
                  📷
                </div>
              )}

              <div className="space-y-1 text-center sm:text-left flex-1">
                <label className="inline-block px-4 py-2 rounded-xl bg-white border border-slate-300 hover:border-blue-500 text-blue-600 font-semibold text-sm cursor-pointer shadow-sm transition">
                  <span>Selecionar Foto da Avaria</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
                <p className="text-xs text-slate-500">
                  Tire uma foto com a câmera ou escolha um arquivo de imagem (JPG, PNG, WebP).
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Responsável pelo Registro
            </label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="w-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base text-slate-900"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-base transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-sm transition flex items-center gap-2 disabled:opacity-50"
            >
              <span>{saving ? "Salvando..." : "Salvar Avaria"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

