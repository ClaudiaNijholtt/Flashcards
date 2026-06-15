import type { Flashcard, AnthropicResponse } from './types';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === 'application/pdf') {
    return extractFromPdf(file);
  }
  // Plain text / markdown fallback
  return file.text();
}

async function extractFromPdf(file: File): Promise<string> {
  // We send PDF as base64 to Claude directly
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Kon PDF niet lezen'));
    reader.readAsDataURL(file);
  });
}

export async function generateFlashcards(
  apiKey: string,
  file: File,
  onProgress: (msg: string) => void
): Promise<Flashcard[]> {
  onProgress('Document verwerken...');

  const isPdf = file.type === 'application/pdf';
  let messageContent: unknown;

  if (isPdf) {
    const dataUrl = await extractFromPdf(file);
    const base64 = dataUrl.split(',')[1];
    messageContent = [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      },
      {
        type: 'text',
        text: FLASHCARD_PROMPT,
      },
    ];
  } else {
    const text = await file.text();
    messageContent = `${FLASHCARD_PROMPT}\n\n---\n\n${text}`;
  }

  onProgress('Flashcards genereren met AI...');

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: messageContent }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `API fout: ${response.status}`);
  }

  const data = await response.json() as AnthropicResponse;
  const text = data.content.map(b => (b.type === 'text' ? b.text : '')).join('');

  onProgress('Antwoord verwerken...');
  return parseFlashcards(text);
}

function parseFlashcards(text: string): Flashcard[] {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Find JSON array
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('Geen geldige flashcards ontvangen van AI.');

  const json = cleaned.slice(start, end + 1);
  const parsed = JSON.parse(json) as unknown;

  if (!Array.isArray(parsed)) throw new Error('Onverwacht formaat ontvangen.');

  return parsed
    .filter((item): item is { question: string; answer: string } =>
      typeof item === 'object' && item !== null &&
      'question' in item && 'answer' in item
    )
    .map(item => ({
      question: String(item.question).trim(),
      answer: String(item.answer).trim(),
    }));
}

const FLASHCARD_PROMPT = `
Analyseer dit document en maak zo veel mogelijk goede flashcards in het NEDERLANDS.
Doel: een student helpen de stof te leren voor een tentamen.

Regels:
- Maak MINIMAAL 15 en MAXIMAAL 40 flashcards, afhankelijk van de hoeveelheid stof
- Elke flashcard heeft een duidelijke vraag en een volledig antwoord
- Dek alle belangrijke concepten, definities, onderscheiden en lijsten
- Gebruik de taal van het document (Nederlands als het document in het Nederlands is)
- Antwoorden mogen meerdere regels bevatten (gebruik \\n voor regeleinden)
- Focus op tentamenstof: definities, onderscheiden, lijsten, processen, regels

Geef ALLEEN een JSON-array terug, zonder uitleg, zonder markdown omheen:
[
  { "question": "Wat is X?", "answer": "X is..." },
  { "question": "Noem de stappen van Y.", "answer": "1. Stap A\\n2. Stap B\\n3. Stap C" }
]
`.trim();
