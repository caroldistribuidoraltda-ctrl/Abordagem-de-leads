import React, { useState, useRef } from 'react';
import { FileUp, FileText, X, AlertCircle, Sparkles, Check, UploadCloud } from 'lucide-react';
import { Client } from '../types';
import { sanitizePhoneForWhatsApp } from '../utils/phone';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (clients: Client[]) => void;
  onLoadSample: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  onLoadSample,
}) => {
  const [activeTab, setActiveTab] = useState<'pdf' | 'text'>('pdf');
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:application/pdf;base64, prefix
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      let payload: { pdfBase64?: string; text?: string; filename?: string } = {};

      if (activeTab === 'pdf') {
        if (!file) {
          throw new Error('Selecione um arquivo PDF para continuar.');
        }
        const base64 = await readFileAsBase64(file);
        payload = {
          pdfBase64: base64,
          filename: file.name,
        };
      } else {
        if (!rawText.trim()) {
          throw new Error('Cole o conteúdo da lista no campo de texto.');
        }
        payload = {
          text: rawText.trim(),
        };
      }

      const res = await fetch('/api/extract-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao analisar o documento.');
      }

      if (!data.clients || data.clients.length === 0) {
        throw new Error(
          'Nenhum cliente com telefone e vendedor foi identificado no documento. Verifique se o formato contém colunas legíveis.'
        );
      }

      // Format clients with unique IDs and sanitized WhatsApp phones
      const formattedClients: Client[] = data.clients.map((raw: any, idx: number) => {
        const cleanPhone = sanitizePhoneForWhatsApp(raw.phone || '');
        return {
          id: `client-${Date.now()}-${idx}`,
          name: raw.name?.trim() || `Cliente ${idx + 1}`,
          phone: raw.phone?.trim() || '',
          cleanPhone,
          daysInactive: typeof raw.daysInactive === 'number' ? raw.daysInactive : parseInt(raw.daysInactive || '0', 10) || 0,
          seller: raw.seller?.trim() || 'Geral / Sem Vendedor',
          lastPurchaseDate: raw.lastPurchaseDate,
          city: raw.city,
          status: 'pending',
        };
      });

      onImportSuccess(formattedClients);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao importar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <FileUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Importar Lista de Clientes Inativos
              </h3>
              <p className="text-xs text-slate-500">
                Identificação automática de cliente, telefone, dias inativos e vendedor
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-slate-200 flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('pdf')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'pdf'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Arquivo PDF do Relatório
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'text'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Colar Texto / Tabela
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Erro na importação:</strong> {error}
              </div>
            </div>
          )}

          {activeTab === 'pdf' ? (
            <div>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : file
                    ? 'border-emerald-400 bg-emerald-50/20'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>

                {file ? (
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <Check className="w-3.5 h-3.5" /> {file.name}
                    </span>
                    <p className="text-xs text-slate-500 mt-2">
                      Tamanho: {(file.size / 1024).toFixed(1)} KB. Clique para trocar de arquivo.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Arraste e solte seu relatório em PDF aqui
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      ou clique para navegar e selecionar do seu computador
                    </p>
                    <p className="text-[11px] text-slate-400 mt-3">
                      Suporta relatórios padrão de ERP (Sankhya, Bling, Tiny, Protheus, Omie, Linx, Excel em PDF, etc.)
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Cole o texto copiado do relatório ou planilha:
              </label>
              <textarea
                rows={6}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Cole aqui linhas com o nome do cliente, telefone, dias sem comprar e vendedor. Exemplo:&#10;Vendedor: Carlos Eduardo&#10;Auto Peças São José - (11) 98452-1920 - 42 dias&#10;Oficina Precision - (11) 97120-4491 - 88 dias"
                className="w-full text-xs text-slate-800 font-mono bg-slate-50 border border-slate-300 rounded-xl p-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
              />
            </div>
          )}

          {/* Demonstration shortcut */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-indigo-900">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Não tem um PDF em mãos agora?</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onLoadSample();
                onClose();
              }}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-white px-3 py-1.5 rounded-lg border border-indigo-200 shadow-2xs hover:bg-indigo-50 transition-colors cursor-pointer"
            >
              Carregar Exemplo Pronto
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading || (activeTab === 'pdf' && !file) || (activeTab === 'text' && !rawText.trim())}
            onClick={handleSubmit}
            className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white rounded-lg transition-all shadow-sm cursor-pointer ${
              loading || (activeTab === 'pdf' && !file) || (activeTab === 'text' && !rawText.trim())
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
            }`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processando com IA...
              </>
            ) : (
              <>
                <FileUp className="w-4 h-4" />
                Extrair e Agrupar Clientes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
