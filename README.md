# Godic Transcript Extractor

Paste a Godic listening URL to extract the complete German transcript from the page's embedded `translate.subtitles` payload.

## Clean transcript copying

Two independent copy actions are available: **复制（带时间戳）** preserves the original per-subtitle timestamp format, while **复制原文（无时间戳）** joins consecutive subtitle sentences into readable paragraphs without timestamps or translations. The displayed transcript and TXT download use the latter format.

The clean formatter runs locally in `transcript_nlp.js`. It uses a **TextTiling-inspired lexical-cohesion algorithm**, not fixed groups of subtitle lines:

1. Merge subtitle fragments and normalize whitespace; source paragraph IDs do not force breaks.
2. Detect German sentence boundaries with `Intl.Segmenter`, with a conservative fallback and repairs for common abbreviations, initials, dates, and decimal numbers.
3. Remove German stopwords and lightly normalize inflections **for analysis only**. Compare adjacent three-sentence windows with TF-IDF cosine similarity, then find local cohesion valleys as candidate topic boundaries.
4. Use dynamic programming to balance topic boundaries, weak transition phrases, paragraph length, and a penalty against isolated short sentences. A soft target of 95 words and a 260-word limit (except unsplittable sentences) guide readability; there is no fixed number of sentences per paragraph.
5. Separate paragraphs with one blank line. A lossless check ensures all original words, punctuation, and their order are preserved; if segmentation would lose text, return the original merged text instead.

This is a lightweight adaptation, **not a complete reproduction of TextTiling, a semantic embedding model, or a German lemmatizer**. It does not rewrite, correct, translate, invent headings, or infer speakers. Lexical topic changes are heuristic, so ambiguous transitions may differ from human editing. No API key, downloaded model, third-party upload, or extra runtime dependency is needed. Spoken times such as `12:30 Uhr` remain intact; only subtitle timestamp metadata is excluded in clean mode.

Algorithm reference: Marti A. Hearst (1997), [TextTiling: Segmenting Text into Multi-paragraph Subtopic Passages](https://aclanthology.org/J97-1003/).

Run regression tests:

```sh
python -m unittest discover -s tests -v
node tests/test_frontend.cjs
node tests/test_nlp.cjs
```

## Audio playback

When the target page publicly exposes an audio URL, the app displays an HTML5 player. The browser tries the original URL first (so an existing Godic browser session can be used), then falls back to `/api/audio`. The proxy forwards `Range`, `Referer`, and the upstream media headers so seeking and playback work more reliably when the original host blocks cross-origin requests or direct browser requests. The original URL is still available as a link.

The Godic desktop player commonly stores the media endpoint in `Webting_play.initPlayPage(...)` instead of an `<audio src>` attribute. The parser recognizes that extensionless `api.frdic.com` URL and infers its MP3 type from the query string.

If the server response contains no public audio URL, the app reports that clearly instead of inventing a playable link. It does not bypass login, payment, client-only playback, or dynamic access controls.

Godic can respond with `upgrade_info.mp3`, a short upgrade/audition prompt, from an otherwise valid media endpoint. The proxy now detects that redirect/filename and refuses to present it as the article's complete audio. If the Godic page plays the full file only in a logged-in or entitled browser session, use the original playback link in that session; the extractor cannot copy those private cookies or bypass the access control.

## Render

This repository includes `render.yaml`. In Render, create a Blueprint from this repository. The service runs `python app.py`, binds to `0.0.0.0`, and reads Render's `PORT` environment variable.

The app only parses data publicly returned by the target page. It does not bypass login, payment, or access controls.
