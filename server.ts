import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const PORT = 3000;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Robust retry helper with model cascade to handle 503 UNAVAILABLE / high demand spikes
 */
async function generateContentWithRetry(
  ai: GoogleGenAI,
  primaryModel = 'gemini-3.1-flash-lite',
  params: any,
  maxRetries = 1
): Promise<any> {
  // Try fast lite model first to bypass high-demand spikes on 3.8-flash
  const modelsToTry = [primaryModel, 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
  const uniqueModels = Array.from(new Set(modelsToTry));

  let lastError: any = null;

  for (const model of uniqueModels) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...params,
          model,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = (err?.message || JSON.stringify(err)).toLowerCase();
        const isTransient =
          errMsg.includes('503') ||
          errMsg.includes('unavailable') ||
          errMsg.includes('high demand') ||
          errMsg.includes('429') ||
          errMsg.includes('resource_exhausted') ||
          errMsg.includes('overloaded');

        if (isTransient && attempt < maxRetries) {
          const delayMs = 800;
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        // Move immediately to next model in cascade without spamming console
        break;
      }
    }
  }

  throw lastError;
}

/**
 * Extracts plain text from PDF buffer using pdfjs-dist
 */
async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: true,
    });
    const pdfDoc = await loadingTask.promise;
    let fullText = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');
      fullText += `--- PÁGINA ${i} ---\n` + pageText + '\n';
    }
    return fullText.trim();
  } catch (e) {
    console.warn('pdfjs-dist extraction failed, will use direct PDF payload:', e);
    return '';
  }
}

// Fallback rule-based generator if no API key is provided or AI is unavailable
function generateFallbackMessage(
  clientName: string,
  sellerName: string,
  daysInactive: number,
  context: string,
  keywords: string,
  index: number
): string {
  const firstName = clientName.split(' ')[0] || clientName;
  const greetings = [
    `Olá ${firstName}, tudo bem?`,
    `Oi ${firstName}, como você está?`,
    `Bom dia, ${firstName}! Tudo bem por aí?`,
    `Olá ${firstName}, espero que esteja tendo uma excelente semana!`,
    `Oi ${firstName}, aqui é da equipe comercial, tudo certo?`,
    `${firstName}, como vão os negócios por aí?`,
  ];

  const inactPhrases = [
    `Notei que faz cerca de ${daysInactive} dias que não fazemos um pedido juntos e passei para saber se está precisando de algo.`,
    `Vi aqui no nosso sistema que seu último pedido foi há ${daysInactive} dias, sentimos sua falta por aqui!`,
    `Faz um tempinho (${daysInactive} dias) desde sua última compra conosco e queríamos saber como estão seus estoques.`,
    `Estava revisando os contatos de clientes especiais e lembrei de você, já faz uns ${daysInactive} dias sem conversar!`,
  ];

  const greeting = greetings[index % greetings.length];
  const inactPhrase = inactPhrases[index % inactPhrases.length];
  const kwList = keywords ? keywords.split(',').map((k) => k.trim()).filter(Boolean) : [];
  const highlight = kwList.length > 0 ? `Estamos com condições especiais com foco em *${kwList.join(', ')}*.` : '';

  const ctas = [
    'Consegue me responder por aqui se posso te enviar nosso catálogo atualizado?',
    'Posso te passar a tabela com as condições de hoje para você avaliar?',
    'Me fala como posso te ajudar no pedido dessa semana!',
    'Tem algum item específico que você está precisando repor hoje?',
  ];
  const cta = ctas[index % ctas.length];

  return `${greeting}\n\n${inactPhrase}\n\n${context ? context + '\n\n' : ''}${highlight ? highlight + '\n\n' : ''}${cta}\n\nAtenciosamente,\n*${sellerName}*`;
}

// Smart text parser for ERP tables and unstructured reports
function parseTextFallback(text: string) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const clients: any[] = [];
  let currentSeller = 'Geral';

  for (const line of lines) {
    // Check if line looks like a seller header
    const sellerMatch = line.match(/(?:Vendedor|Representante|Consultor|VEND|REP)[\s:=-]+([A-Za-zÀ-ÖØ-öø-ÿ\s]{3,})/i);
    if (sellerMatch && sellerMatch[1]) {
      const candidate = sellerMatch[1].trim();
      if (!candidate.match(/\d{4}/)) {
        currentSeller = candidate;
        continue;
      }
    }

    // Check for phone
    const phoneMatch = line.match(/(?:\(?\d{2}\)?\s*)?(?:9\s?\d{4}|\d{4})[-.\s]?\d{4}/);
    // Check for days
    const daysMatch = line.match(/(\d{1,4})\s*(?:dias|d\b|dias\s+sem\s+comprar)/i) || line.match(/\b(\d{1,4})\s*$/);

    if (phoneMatch) {
      const phone = phoneMatch[0];
      const days = daysMatch ? parseInt(daysMatch[1], 10) : 30;

      // Clean name by removing phone, days, dates and symbols
      let name = line
        .replace(phone, '')
        .replace(/(?:\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b)/g, '') // dates
        .replace(/(?:dias|sem comprar|\bd\b|\d{1,4})/gi, '')
        .replace(/[-|;,]/g, ' ')
        .trim();

      name = name.replace(/\s+/g, ' ');

      if (name.length < 3) {
        name = `Cliente ${phone.slice(-4)}`;
      }

      clients.push({
        name,
        phone,
        daysInactive: isNaN(days) ? 30 : days,
        seller: currentSeller,
      });
    }
  }

  return clients;
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY',
    });
  });

  // Extract clients from PDF base64 or raw text with automatic 503 fallback
  app.post('/api/extract-pdf', async (req, res) => {
    try {
      const { pdfBase64, text, filename } = req.body;

      if (!pdfBase64 && !text) {
        return res.status(400).json({ error: 'Nenhum arquivo PDF ou texto foi fornecido.' });
      }

      let extractedText = text || '';

      // If PDF base64 is provided, first extract text via pdfjs-dist to save token costs and reduce AI load
      if (pdfBase64) {
        try {
          const buffer = Buffer.from(pdfBase64, 'base64');
          const pdfText = await extractTextFromPdfBuffer(buffer);
          if (pdfText && pdfText.length > 20) {
            extractedText = pdfText;
          }
        } catch (pdfErr) {
          console.warn('pdfjs extraction notice:', pdfErr);
        }
      }

      const ai = getGeminiClient();

      if (ai) {
        const prompt = `Você é um extrator de dados de relatórios comerciais de vendas e inatividade de clientes.
Analise com atenção o documento/texto fornecido.
Sua tarefa é extrair TODOS os clientes encontrados no documento, identificando obrigatoriamente:
1. "name": Nome do cliente ou razão social da empresa
2. "phone": Número de telefone / celular / WhatsApp (mantenha DDD). Se tiver mais de um, pegue o WhatsApp/celular principal.
3. "daysInactive": Quantidade de dias sem comprar (número inteiro). Se houver apenas data da última compra ou coluna 'dias', extraia o valor numérico.
4. "seller": Nome do vendedor responsável (se estiver agrupado por cabeçalho de vendedor, associe todos os clientes abaixo dele ao vendedor correto).
5. "lastPurchaseDate": Data da última compra no formato DD/MM/AAAA (opcional se constar).
6. "city": Cidade/Estado se constar (opcional).

Certifique-se de extrair todos os registros sem truncar. Limpe os telefones para conter apenas dígitos válidos com DDD brasileiro se possível.`;

        let contentsPayload: any;
        if (extractedText && extractedText.length > 20) {
          // Sending extracted plain text is 10x lighter and far less prone to 503 high demand spikes
          contentsPayload = {
            parts: [{ text: `${prompt}\n\nTEXTO DO RELATÓRIO:\n${extractedText.slice(0, 50000)}` }],
          };
        } else if (pdfBase64) {
          contentsPayload = {
            parts: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: pdfBase64,
                },
              },
              { text: prompt },
            ],
          };
        } else {
          contentsPayload = {
            parts: [{ text: `${prompt}\n\nDOCUMENTO/TEXTO:\n${text}` }],
          };
        }

        try {
          const response = await generateContentWithRetry(ai, 'gemini-3.1-flash-lite', {
            contents: contentsPayload,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    phone: { type: Type.STRING },
                    daysInactive: { type: Type.INTEGER },
                    seller: { type: Type.STRING },
                    lastPurchaseDate: { type: Type.STRING },
                    city: { type: Type.STRING },
                  },
                  required: ['name', 'phone', 'daysInactive', 'seller'],
                },
              },
            },
          });

          const rawText = response.text || '[]';
          let parsed: any[] = [];
          try {
            parsed = JSON.parse(rawText);
          } catch (e) {
            const match = rawText.match(/\[.*\]/s);
            if (match) {
              parsed = JSON.parse(match[0]);
            }
          }

          if (Array.isArray(parsed) && parsed.length > 0) {
            return res.json({
              success: true,
              clients: parsed,
              rawCount: parsed.length,
              source: 'gemini',
            });
          }
        } catch (aiErr: any) {
          // If AI fails with 503 or any error, continue to fallback parser below!
        }
      }

      // Seamless fallback parser so user never sees a 503 error
      const fallbackList = parseTextFallback(extractedText || text || '');
      if (fallbackList.length > 0) {
        return res.json({
          success: true,
          clients: fallbackList,
          rawCount: fallbackList.length,
          source: 'fallback',
          warning: 'Processado pelo extrator interno com sucesso.',
        });
      }

      return res.status(422).json({
        error:
          'Não foi possível encontrar clientes legíveis no arquivo. Verifique se o PDF contém colunas de nome, telefone e vendedor ou tente copiar e colar o texto.',
      });
    } catch (err: any) {
      console.error('Error extracting PDF/Text:', err);
      res.status(500).json({
        error: err.message || 'Erro ao processar e extrair dados do PDF.',
      });
    }
  });

  // Batch generate distinct unique messages with retry and model cascade
  app.post('/api/generate-messages', async (req, res) => {
    try {
      const {
        clients,
        context,
        keywords,
        tone = 'amigavel',
        mentionDays = true,
        mentionSeller = true,
        customInstructions = '',
      } = req.body;

      if (!Array.isArray(clients) || clients.length === 0) {
        return res.status(400).json({ error: 'Nenhum cliente fornecido.' });
      }

      const ai = getGeminiClient();

      if (!ai) {
        const generated = clients.map((c: any, idx: number) => ({
          clientId: c.id,
          message: generateFallbackMessage(
            c.name,
            c.seller,
            c.daysInactive,
            context || 'Estamos com condições imperdíveis para retorno esta semana.',
            keywords || 'desconto, frete grátis',
            idx
          ),
        }));
        return res.json({ success: true, messages: generated, source: 'fallback' });
      }

      const clientBatchSummaries = clients.map((c: any) => ({
        id: c.id,
        name: c.name,
        daysInactive: c.daysInactive,
        seller: c.seller,
        city: c.city || '',
      }));

      const toneDescriptions: Record<string, string> = {
        amigavel: 'Caloroso, próximo, empático e atencioso, como um consultor parceiro.',
        consultivo: 'Profissional, focado em entender as necessidades do negócio do cliente e agregar valor.',
        promocional: 'Animado, focado em oportunidade única, senso de oportunidade e benefício financeiro.',
        direto: 'Objetivo, rápido de ler, sem rodeios, ideal para empresários ocupados.',
        formal: 'Polido, respeitoso, corporativo e bem articulado.',
      };

      const prompt = `Você é um copywriter sênior especialista em mensagens de alta conversão de vendas para WhatsApp (B2B e B2C).
O objetivo é reativar clientes que estão há vários dias sem comprar.

DIRETRIZES CRÍTICAS:
1. VOCÊ DEVE GERAR UMA MENSAGEM TOTALMENTE ÚNICA E DISTINTA PARA CADA UM DOS CLIENTES ABAIXO.
   - Nenhuma mensagem pode parecer cópia ou modelo genérico com apenas o nome trocado!
   - Varie aberturas, saudações, ordem dos argumentos, metáforas, ganchos e chamadas para ação (CTA).
   - O estilo deve soar 100% humano, natural, como se o próprio vendedor tivesse digitado diretamente no WhatsApp.

2. CONTEXTO COMERCIAL:
   "${context || 'Campanha especial de reativação com condições exclusivas e reposição de estoque.'}"

3. PALAVRAS-CHAVE OBRIGATÓRIAS / RELEVANTES:
   "${keywords || 'oportunidade especial, condições exclusivas'}"

4. TOM DESEJADO:
   ${toneDescriptions[tone] || toneDescriptions.amigavel}

5. REGRAS DE PERSONALIZAÇÃO:
   - Adapte a abordagem pelo tempo sem comprar:
     * Menos de 30 dias: lembrete leve, checagem rápida de estoque.
     * De 30 a 90 dias: abordagem de parceria, perguntando como estão as demandas.
     * Mais de 90 dias: acolhimento caloroso, resgate, apresentação de novidades e condição exclusiva de reativação.
   - ${mentionDays ? 'Faça menção amigável e educada ao tempo em que não se falam (sem soar cobrança chata).' : 'Não cite explicitamente o número de dias sem comprar.'}
   - ${mentionSeller ? 'O vendedor responsável deve assinar ou se apresentar com seu nome no texto.' : 'Não precisa citar o nome do vendedor.'}
   ${customInstructions ? `- INSTRUÇÃO ADICIONAL DO USUÁRIO: "${customInstructions}"` : ''}

6. FORMATAÇÃO WHATSAPP:
   - Use quebras de linha duplas para parágrafos curtos e legíveis no celular.
   - Pode usar *negrito* sutil em 1 ou 2 palavras-chave.
   - Emojis moderados e adequados ao contexto comercial.

LISTA DE CLIENTES:
${JSON.stringify(clientBatchSummaries, null, 2)}

Retorne um JSON estrito no formato de lista de objetos:
[
  {
    "clientId": "id_do_cliente",
    "message": "Texto completo e pronto para envio no WhatsApp"
  }
]`;

      try {
        const response = await generateContentWithRetry(ai, 'gemini-3.1-flash-lite', {
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  clientId: { type: Type.STRING },
                  message: { type: Type.STRING },
                },
                required: ['clientId', 'message'],
              },
            },
          },
        });

        const rawText = response.text || '[]';
        let parsed: any[] = [];
        try {
          parsed = JSON.parse(rawText);
        } catch (e) {
          const match = rawText.match(/\[.*\]/s);
          if (match) {
            parsed = JSON.parse(match[0]);
          }
        }

        return res.json({ success: true, messages: parsed, source: 'gemini' });
      } catch (genErr: any) {
        // Fallback generator to ensure user is never blocked
        const generated = clients.map((c: any, idx: number) => ({
          clientId: c.id,
          message: generateFallbackMessage(
            c.name,
            c.seller,
            c.daysInactive,
            context || 'Estamos com condições imperdíveis para retorno esta semana.',
            keywords || 'desconto, frete grátis',
            idx
          ),
        }));
        return res.json({ success: true, messages: generated, source: 'fallback', note: 'Gerado com template inteligente devido à alta demanda da IA.' });
      }
    } catch (err: any) {
      console.error('Error generating batch messages:', err);
      res.status(500).json({ error: err.message || 'Erro ao gerar mensagens.' });
    }
  });

  // Single client message regeneration with retry and fallback
  app.post('/api/generate-single', async (req, res) => {
    try {
      const { client, context, keywords, tone = 'amigavel', instructions } = req.body;
      if (!client) {
        return res.status(400).json({ error: 'Cliente não informado.' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        const fallback = generateFallbackMessage(
          client.name,
          client.seller,
          client.daysInactive,
          context,
          keywords,
          Math.floor(Math.random() * 10)
        );
        return res.json({ success: true, message: fallback, source: 'fallback' });
      }

      const prompt = `Gere uma nova mensagem de WhatsApp única, personalizada e persuasiva para o seguinte cliente:
Nome: ${client.name}
Vendedor: ${client.seller}
Dias sem comprar: ${client.daysInactive} dias
Cidade: ${client.city || 'Não informada'}

Contexto da campanha: "${context || 'Campanha de reativação de clientes'}"
Palavras-chave: "${keywords || 'desconto, novidades'}"
Tom: ${tone}
${instructions ? `Instrução extra do operador: "${instructions}"` : ''}

A mensagem deve ser pronta para enviar pelo WhatsApp (com quebras de linha e emojis adequados).
Retorne SOMENTE a mensagem final, sem introdução ou aspas externas.`;

      try {
        const response = await generateContentWithRetry(ai, 'gemini-3.1-flash-lite', {
          contents: prompt,
        });
        return res.json({ success: true, message: response.text?.trim() || '', source: 'gemini' });
      } catch (err: any) {
        const fallback = generateFallbackMessage(
          client.name,
          client.seller,
          client.daysInactive,
          context,
          keywords,
          Math.floor(Math.random() * 10)
        );
        return res.json({ success: true, message: fallback, source: 'fallback' });
      }
    } catch (err: any) {
      console.error('Error generating single message:', err);
      res.status(500).json({ error: err.message || 'Erro ao regenerar mensagem.' });
    }
  });

  // Vite middleware in dev, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
