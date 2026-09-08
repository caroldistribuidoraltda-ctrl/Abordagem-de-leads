import React from 'react';
import {
  MessageSquareShare,
  FileUp,
  Sparkles,
  Trash2,
  Download,
  CloudCheck,
  CloudUpload,
  RefreshCw,
} from 'lucide-react';

interface HeaderProps {
  totalClients: number;
  totalSellers: number;
  contactedCount: number;
  syncStatus: 'synced' | 'saving' | 'loading' | 'error';
  lastSavedAt: string | null;
  onOpenImport: () => void;
  onLoadSample: () => void;
  onClearData: () => void;
  onExportCsv: () => void;
  onManualSync: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalClients,
  totalSellers,
  contactedCount,
  syncStatus,
  lastSavedAt,
  onOpenImport,
  onLoadSample,
  onClearData,
  onExportCsv,
  onManualSync,
}) => {
  const formattedLastSaved = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
            <MessageSquareShare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Reativação WhatsApp
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Por Vendedor
              </span>

              {/* Firestore Status Badge */}
              <button
                type="button"
                onClick={onManualSync}
                title="Clique para sincronizar agora com Firebase Firestore"
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border cursor-pointer transition-colors bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
              >
                {syncStatus === 'saving' || syncStatus === 'loading' ? (
                  <>
                    <RefreshCw className="w-3 h-3 text-emerald-600 animate-spin" />
                    <span>Salvando no Firestore...</span>
                  </>
                ) : (
                  <>
                    <CloudCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Firestore Conectado {formattedLastSaved ? `(${formattedLastSaved})` : ''}</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Importação de PDF • Agrupamento por Vendedor • Salvo no Firebase Firestore
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {totalClients > 0 && (
            <>
              <button
                type="button"
                onClick={onExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Exportar dados e mensagens para CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                Exportar CSV
              </button>
              <button
                type="button"
                onClick={onClearData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                title="Limpar todos os clientes"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                Limpar
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onLoadSample}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer border border-indigo-200"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            Carregar Exemplo
          </button>

          <button
            type="button"
            onClick={onOpenImport}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <FileUp className="w-4 h-4" />
            Importar Lista PDF
          </button>
        </div>
      </div>
    </header>
  );
};
