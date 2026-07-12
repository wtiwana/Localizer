import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveGlob } from './glob.js';

export interface QAItem {
  question: string;
  answer: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(text: string, fallback: string): string {
  const heading = text.match(/^(?:#+\s+)?(.{8,120})/);
  return heading?.[1]?.trim() ?? fallback;
}

function chunkText(text: string, maxLength = 500): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > maxLength && current) {
      chunks.push(current.trim());
      current = sentence;
      continue;
    }
    current = current ? `${current} ${sentence}` : sentence;
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, maxLength)];
}

function buildQuestions(title: string, chunk: string): QAItem[] {
  const shortTitle = title.length > 80 ? `${title.slice(0, 77)}...` : title;
  return [
    {
      question: `What does ${shortTitle} cover?`,
      answer: chunk,
    },
    {
      question: `How do I get started with ${shortTitle}?`,
      answer: chunk,
    },
  ];
}

export async function synthesizeQaFromPages(pagesGlob: string, count: number): Promise<QAItem[]> {
  const files = await resolveGlob(pagesGlob);
  if (files.length === 0) {
    throw new Error(`No files matched pages glob: ${pagesGlob}`);
  }

  const pairs: QAItem[] = [];

  for (const file of files) {
    const raw = await readFile(file, 'utf8');
    const text = file.endsWith('.html') || file.endsWith('.htm') ? stripHtml(raw) : raw.trim();
    if (!text) continue;

    const title = extractTitle(text, path.basename(file, path.extname(file)));
    for (const chunk of chunkText(text)) {
      pairs.push(...buildQuestions(title, chunk));
      if (pairs.length >= count) {
        return pairs.slice(0, count);
      }
    }
  }

  return pairs.slice(0, count);
}
