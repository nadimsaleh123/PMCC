/**
 * Minimal Telegram Bot API client.
 *
 * Deliberately dependency-free - Node 18+ has fetch, and a bot that must keep
 * running unattended on a Mac mini for months is better off with no supply
 * chain at all.
 */

const API = 'https://api.telegram.org';

export class Telegram {
  constructor(token, { fetchImpl = fetch } = {}) {
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
    this.token = token;
    this.fetch = fetchImpl;
    this.offset = 0;
  }

  async call(method, payload = {}, { timeoutMs = 90_000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.fetch(`${API}/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const body = await response.json();
      if (!body.ok) {
        throw new Error(`Telegram ${method} failed: ${body.description ?? response.status}`);
      }
      return body.result;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Long poll. Telegram holds the connection open until something arrives, so
   * this is a push channel in practice - no polling interval to tune, and no
   * wasted requests.
   */
  async getUpdates({ timeout = 50 } = {}) {
    const updates = await this.call(
      'getUpdates',
      { offset: this.offset, timeout, allowed_updates: ['message'] },
      { timeoutMs: (timeout + 20) * 1000 },
    );
    for (const update of updates) {
      if (update.update_id >= this.offset) this.offset = update.update_id + 1;
    }
    return updates;
  }

  /**
   * Telegram's MarkdownV2 escapes are hostile and a single stray character
   * fails the whole send. Activity names routinely contain brackets, dashes and
   * dots, so use legacy Markdown and strip the few characters that break it.
   */
  async send(chatId, text, options = {}) {
    return this.call('sendMessage', {
      chat_id: chatId,
      text: truncate(text),
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...options,
    }).catch(async (error) => {
      // Fall back to plain text rather than losing the message entirely.
      if (!/parse|entity/i.test(error.message)) throw error;
      return this.call('sendMessage', {
        chat_id: chatId,
        text: truncate(stripMarkdown(text)),
        disable_web_page_preview: true,
        ...options,
      });
    });
  }

  async sendDocument(chatId, filename, content, caption) {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    if (caption) form.append('caption', caption);
    form.append('document', new Blob([content]), filename);

    const response = await this.fetch(`${API}/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: form,
    });
    const body = await response.json();
    if (!body.ok) throw new Error(`Telegram sendDocument failed: ${body.description}`);
    return body.result;
  }

  /** Resolve a file_id to a download URL - used for photos and voice notes. */
  async fileUrl(fileId) {
    const file = await this.call('getFile', { file_id: fileId });
    return `${API}/file/bot${this.token}/${file.file_path}`;
  }

  async download(fileId) {
    const response = await this.fetch(await this.fileUrl(fileId));
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
}

/** Telegram hard-caps messages at 4096 characters. */
export function truncate(text, limit = 4000) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 40)}\n\n…(truncated)`;
}

export function stripMarkdown(text) {
  return text.replace(/[*_`[\]]/g, '');
}

/** Split a long report across several messages on paragraph boundaries. */
export function chunk(text, limit = 3800) {
  if (text.length <= limit) return [text];
  const chunks = [];
  let current = '';
  for (const paragraph of text.split('\n\n')) {
    if (current.length + paragraph.length + 2 > limit) {
      if (current) chunks.push(current);
      current = paragraph.length > limit ? paragraph.slice(0, limit) : paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
