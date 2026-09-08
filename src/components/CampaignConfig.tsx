import React, { useState } from 'react';
import { Sparkles, MessageCircle, Sliders, ChevronDown, ChevronUp, Check, RefreshCw } from 'lucide-react';
import { MessageConfig, MessageTone } from '../types';

interface CampaignConfigProps {
  config: MessageConfig;
  onChangeConfig: (newConfig: MessageConfig) => void;
  onGenerateAll: () => Promise<void>;
  isGenerating: boolean;
  totalClients: number;
  generatedCount: number;
}

const TONES: Array<{ value: MessageTone; label: string; desc: string }> = [
  { value: 'amigavel', label: 'Amigável & Próximo', desc: 'Caloroso e acolhedor' },
  { value: 'consultivo', label: 'Consultivo', desc: 'Focado em solução e suporte' },
  { value: 'direto', label: 'Direto & Rápido', desc: 'Objetivo, ideal para B2B' },
  { value: 'promocional', label: 'Promocional', desc: 'Foco em ofertas e prazos' },
  { value: 'formal', label: 'Corporativo', desc: 'Polido e formal' },
];

export const CampaignConfig: React.FC<CampaignConfigProps> = ({
  config,
  onChangeConfig,
  onGenerateAll,
  isGenerating,
  totalClients,
  generatedCount,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const presetContexts = [
    {
      title: 'Desconto & Frete Grátis',
      context: 'Estamos com condições especiais de reativação esta semana com 15% de desconto no pedido de reposição e frete grátis para compras acima de R$ 500.',
      keywords: 'desconto especial, frete grátis, reposição rápida',
    },
    {
      title: 'Checagem de Estoque & Suporte',
      context: 'Passei para saber como estão seus estoques e se precisa de alguma cotação rápida para a semana, com condições de faturamento flexível.',
      keywords: 'reposição, cotação rápida, faturamento flexível',
    },
    {
      title: 'Novidades & Lançamentos',
      context: 'Acabamos de receber novos lotes de produtos com alta demanda e separamos uma prévia exclusiva para nossos parceiros antes da abertura geral.',
      keywords: 'lançamentos, novidades no catálogo, condições antecipadas',
    },
  ];

  const applyPreset = (preset: { context: string; keywords: string }) => {
    onChangeConfig({
      ...config,
      context: preset.context,
      keywords: preset.keywords,
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden mb-6 transition-all">
      <div
        className="px-5 py-4 bg-gradient-to-r from-emerald-50/70 via-slate-50 to-indigo-50/50 border-b border-slate-200 flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Gerador de Mensagens Únicas com Inteligência Artificial
              </h2>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-100 text-indigo-700">
                Texto diferente para cada cliente
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Defina o contexto e palavras-chave. Cada cliente receberá uma mensagem personalizada e exclusiva no link do WhatsApp.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            aria-label="Expandir ou recolher configurações de mensagem"
          >
            {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="p-5 space-y-4">
          {/* Quick presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Exemplos Rápidos de Campanhas:
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {presetContexts.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 rounded-md text-slate-700 transition-colors cursor-pointer"
                >
                  ⚡ {preset.title}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Context field */}
            <div className="md:col-span-7">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Contexto da Mensagem (O que você quer comunicar?):
              </label>
              <textarea
                rows={3}
                value={config.context}
                onChange={(e) => onChangeConfig({ ...config, context: e.target.value })}
                placeholder="Ex: Estamos com uma campanha de reativação oferecendo 15% de desconto nos pedidos fechados até sexta-feira e frete cortesia para reposição de estoque..."
                className="w-full text-sm text-slate-800 placeholder-slate-400 bg-slate-50/50 border border-slate-300 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                A IA adaptará a abordagem considerando se o cliente está inativo há poucos dias ou muitos meses.
              </p>
            </div>

            {/* Keywords field & Tone */}
            <div className="md:col-span-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Palavras-chave obrigatórias / de destaque:
                </label>
                <input
                  type="text"
                  value={config.keywords}
                  onChange={(e) => onChangeConfig({ ...config, keywords: e.target.value })}
                  placeholder="Ex: desconto, frete grátis, catálogo novo, reposição"
                  className="w-full text-sm text-slate-800 placeholder-slate-400 bg-slate-50/50 border border-slate-300 rounded-lg px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Separadas por vírgula. Serão distribuídas de forma orgânica e variada.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tom da conversa:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {TONES.slice(0, 3).map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => onChangeConfig({ ...config, tone: t.value })}
                      className={`text-xs px-2 py-1.5 rounded-lg border font-medium transition-all text-center cursor-pointer ${
                        config.tone === t.value
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Options & Action button */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.mentionDays}
                  onChange={(e) => onChangeConfig({ ...config, mentionDays: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span>Mencionar tempo de inatividade suavemente</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.mentionSeller}
                  onChange={(e) => onChangeConfig({ ...config, mentionSeller: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span>Assinar com o nome do vendedor</span>
              </label>
            </div>

            <button
              type="button"
              disabled={isGenerating || totalClients === 0}
              onClick={onGenerateAll}
              className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-xs tracking-wide text-white transition-all shadow-sm cursor-pointer ${
                isGenerating || totalClients === 0
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-emerald-600/20'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Gerando textos únicos com IA...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  Gerar Textos Únicos ({totalClients} clientes)
                </>
              )}
            </button>
          </div>

          {isGenerating && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-xs text-emerald-800">
                <strong>Criando mensagens personalizadas:</strong> A Inteligência Artificial está formulando saudações e propostas exclusivas para cada cliente...
              </div>
            </div>
          )}

          {!isGenerating && generatedCount > 0 && (
            <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>
                  <strong>{generatedCount} de {totalClients}</strong> clientes possuem mensagens exclusivas prontas nos botões de WhatsApp.
                </span>
              </div>
              <span className="text-[11px] text-emerald-700 font-medium">
                Você pode editar ou regenerar cada mensagem individualmente na lista abaixo.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
