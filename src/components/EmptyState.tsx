import React from 'react';
import { FileUp, Sparkles, Users, MessageSquareShare, ArrowRight, CheckCircle } from 'lucide-react';

interface EmptyStateProps {
  onOpenImport: () => void;
  onLoadSample: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onOpenImport, onLoadSample }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center max-w-3xl mx-auto shadow-xs">
      <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-5 shadow-inner">
        <MessageSquareShare className="w-8 h-8" />
      </div>

      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
        Reative seus clientes inativos via WhatsApp
      </h2>
      <p className="text-slate-600 text-sm max-w-lg mx-auto mt-2 leading-relaxed">
        Importe sua lista de clientes em PDF com <strong>telefone</strong>,{' '}
        <strong>dias sem comprar</strong> e <strong>nome do vendedor</strong>.
        O sistema agrupa por vendedor e gera links diretos com mensagens personalizadas e únicas.
      </p>

      {/* How it works steps */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8 text-left">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center mb-2">
            1
          </div>
          <h3 className="text-xs font-bold text-slate-900">Importação Direta</h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Envie o relatório em PDF exportado do seu ERP ou cole a tabela.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center mb-2">
            2
          </div>
          <h3 className="text-xs font-bold text-slate-900">Agrupamento por Vendedor</h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Visualização organizada em sanfona. Clique no vendedor para ver seus clientes.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center mb-2">
            3
          </div>
          <h3 className="text-xs font-bold text-slate-900">Mensagens Únicas com IA</h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Cada cliente recebe um texto diferente e você abre o WhatsApp com 1 clique.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={onOpenImport}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-sm transition-all cursor-pointer"
        >
          <FileUp className="w-4 h-4" />
          Importar Relatório em PDF
        </button>

        <button
          type="button"
          onClick={onLoadSample}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-indigo-600" />
          Ver com Dados de Exemplo (12 Clientes)
        </button>
      </div>
    </div>
  );
};
