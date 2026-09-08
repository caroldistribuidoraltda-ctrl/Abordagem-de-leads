import React, { useState, useMemo, useEffect } from 'react';
import { Client, SellerGroup, MessageConfig } from './types';
import { SAMPLE_CLIENTS } from './data/sampleClients';
import { buildWhatsAppLink } from './utils/phone';
import { Header } from './components/Header';
import { SummaryStats } from './components/SummaryStats';
import { CampaignConfig } from './components/CampaignConfig';
import { SellerGroupView } from './components/SellerGroupView';
import { ImportModal } from './components/ImportModal';
import { EmptyState } from './components/EmptyState';

const LOCAL_STORAGE_KEY = 'whatsapp_reactivation_clients';
const LOCAL_STORAGE_CONFIG_KEY = 'whatsapp_reactivation_config';

const DEFAULT_CONFIG: MessageConfig = {
  context:
    'Estamos com uma campanha especial de reativação com 15% de desconto no pedido de reposição e frete grátis para pedidos fechados esta semana.',
  keywords: 'desconto especial, frete grátis, reposição rápida, novidades',
  tone: 'amigavel',
  mentionDays: true,
  mentionSeller: true,
};

export default function App() {
  const [clients, setClients] = useState<Client[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading saved clients:', e);
    }
    // Start with sample data loaded for instant first-look satisfaction
    return SAMPLE_CLIENTS;
  });

  const [config, setConfig] = useState<MessageConfig>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Error loading config:', e);
    }
    return DEFAULT_CONFIG;
  });

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [regeneratingClientId, setRegeneratingClientId] = useState<string | null>(null);

  // Save clients to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(clients));
    } catch (e) {
      console.error('Error persisting clients:', e);
    }
  }, [clients]);

  // Save config to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Error persisting config:', e);
    }
  }, [config]);

  // Group clients by seller
  const sellerGroups = useMemo<SellerGroup[]>(() => {
    const map = new Map<string, Client[]>();

    clients.forEach((client) => {
      const seller = client.seller?.trim() || 'Geral';
      if (!map.has(seller)) {
        map.set(seller, []);
      }
      map.get(seller)!.push(client);
    });

    const groups: SellerGroup[] = [];
    map.forEach((sellerClients, sellerName) => {
      const totalClients = sellerClients.length;
      const contactedCount = sellerClients.filter((c) => c.status === 'contacted').length;
      const avgDaysInactive = Math.round(
        sellerClients.reduce((acc, c) => acc + (c.daysInactive || 0), 0) / (totalClients || 1)
      );
      const maxDaysInactive = Math.max(...sellerClients.map((c) => c.daysInactive || 0), 0);

      groups.push({
        sellerName,
        clients: sellerClients,
        totalClients,
        avgDaysInactive,
        maxDaysInactive,
        contactedCount,
      });
    });

    // Sort by largest client volume
    return groups.sort((a, b) => b.totalClients - a.totalClients);
  }, [clients]);

  const totalClients = clients.length;
  const contactedCount = clients.filter((c) => c.status === 'contacted').length;
  const generatedCount = clients.filter((c) => !!c.generatedMessage).length;

  const handleImportSuccess = (newClients: Client[]) => {
    setClients(newClients);
  };

  const handleLoadSample = () => {
    setClients(SAMPLE_CLIENTS);
  };

  const handleClearData = () => {
    if (window.confirm('Tem certeza que deseja limpar todos os clientes cadastrados?')) {
      setClients([]);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  };

  const handleUpdateClientMessage = (clientId: string, newMessage: string) => {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, generatedMessage: newMessage } : c))
    );
  };

  const handleToggleStatus = (clientId: string) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id === clientId) {
          const newStatus = c.status === 'contacted' ? 'pending' : 'contacted';
          return {
            ...c,
            status: newStatus,
            contactedAt: newStatus === 'contacted' ? new Date().toISOString() : undefined,
          };
        }
        return c;
      })
    );
  };

  // Generate unique messages for all clients with AI
  const handleGenerateAll = async () => {
    if (clients.length === 0) return;
    setIsGeneratingAll(true);

    try {
      const res = await fetch('/api/generate-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clients: clients.map((c) => ({
            id: c.id,
            name: c.name,
            daysInactive: c.daysInactive,
            seller: c.seller,
            phone: c.phone,
            city: c.city,
          })),
          context: config.context,
          keywords: config.keywords,
          tone: config.tone,
          mentionDays: config.mentionDays,
          mentionSeller: config.mentionSeller,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao gerar mensagens com IA.');
      }

      if (Array.isArray(data.messages)) {
        const messageMap = new Map<string, string>();
        data.messages.forEach((m: any) => {
          if (m.clientId && m.message) {
            messageMap.set(m.clientId, m.message);
          }
        });

        setClients((prev) =>
          prev.map((c) => {
            const msg = messageMap.get(c.id);
            return msg ? { ...c, generatedMessage: msg } : c;
          })
        );
      }
    } catch (err: any) {
      console.error('Error in handleGenerateAll:', err);
      alert('Erro ao gerar mensagens: ' + (err.message || 'Falha na conexão com a IA.'));
    } finally {
      setIsGeneratingAll(false);
    }
  };

  // Regenerate single client message with AI
  const handleRegenerateSingle = async (client: Client) => {
    setRegeneratingClientId(client.id);

    try {
      const res = await fetch('/api/generate-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client,
          context: config.context,
          keywords: config.keywords,
          tone: config.tone,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao regenerar mensagem.');
      }

      if (data.message) {
        handleUpdateClientMessage(client.id, data.message);
      }
    } catch (err: any) {
      console.error('Error in handleRegenerateSingle:', err);
      alert('Erro ao regenerar mensagem: ' + (err.message || 'Erro de conexão.'));
    } finally {
      setRegeneratingClientId(null);
    }
  };

  // Export data with WhatsApp links to CSV
  const handleExportCsv = () => {
    if (clients.length === 0) return;

    const headers = [
      'Vendedor',
      'Cliente',
      'Telefone',
      'Dias sem Comprar',
      'Status',
      'Link WhatsApp',
      'Mensagem Gerada',
    ];

    const rows = clients.map((c) => {
      const link = buildWhatsAppLink(c.cleanPhone, c.generatedMessage);
      return [
        `"${(c.seller || '').replace(/"/g, '""')}"`,
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${(c.phone || c.cleanPhone || '').replace(/"/g, '""')}"`,
        c.daysInactive || 0,
        c.status === 'contacted' ? 'Contatado' : 'Pendente',
        `"${link.replace(/"/g, '""')}"`,
        `"${(c.generatedMessage || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `clientes_reativacao_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <Header
        totalClients={totalClients}
        totalSellers={sellerGroups.length}
        contactedCount={contactedCount}
        onOpenImport={() => setIsImportModalOpen(true)}
        onLoadSample={handleLoadSample}
        onClearData={handleClearData}
        onExportCsv={handleExportCsv}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {totalClients === 0 ? (
          <EmptyState
            onOpenImport={() => setIsImportModalOpen(true)}
            onLoadSample={handleLoadSample}
          />
        ) : (
          <div className="space-y-6">
            {/* Quick Stats Summary */}
            <SummaryStats clients={clients} sellerGroups={sellerGroups} />

            {/* Campaign Config with AI Message Generator */}
            <CampaignConfig
              config={config}
              onChangeConfig={setConfig}
              onGenerateAll={handleGenerateAll}
              isGenerating={isGeneratingAll}
              totalClients={totalClients}
              generatedCount={generatedCount}
            />

            {/* Seller Group View Accordions & Clients */}
            <SellerGroupView
              sellerGroups={sellerGroups}
              config={config}
              onUpdateClientMessage={handleUpdateClientMessage}
              onToggleStatus={handleToggleStatus}
              onRegenerateSingle={handleRegenerateSingle}
              regeneratingClientId={regeneratingClientId}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Sistema de Reativação WhatsApp por Vendedor • Powered by Google Gemini AI
          </span>
          <span className="text-[11px] text-slate-400">
            Dica: Ao clicar no botão WhatsApp, o contato é aberto com o texto preenchido pronto para envio.
          </span>
        </div>
      </footer>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
        onLoadSample={handleLoadSample}
      />
    </div>
  );
}
