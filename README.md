# Godic Transcript Extractor

Paste a Godic listening URL to extract the complete German transcript from the page's embedded `translate.subtitles` payload.

## Clean transcript copying

Two independent copy actions are available: **复制（带时间戳）** preserves the original per-subtitle timestamp format, while **复制原文（无时间戳）** joins consecutive subtitle sentences into readable paragraphs without timestamps or translations. The displayed transcript and TXT download use the latter format.

Source paragraph IDs are often one-per-sentence, so they no longer force a paragraph break. The formatter generally groups 3–4 sentence-ending subtitle entries, breaks long groups after at least two completed entries, and merges a short trailing singleton into the preceding paragraph. An unfinished sentence is not split just because the source paragraph ID changes. This is rule-based formatting, not semantic rewriting.

Run regression tests with `python -m unittest discover -s tests -v` and `node tests/test_frontend.cjs`.

## Audio playback

When the target page publicly exposes an audio URL, the app displays an HTML5 player. The browser tries the original URL first (so an existing Godic browser session can be used), then falls back to `/api/audio`. The proxy forwards `Range`, `Referer`, and the upstream media headers so seeking and playback work more reliably when the original host blocks cross-origin requests or direct browser requests. The original URL is still available as a link.

The Godic desktop player commonly stores the media endpoint in `Webting_play.initPlayPage(...)` instead of an `<audio src>` attribute. The parser recognizes that extensionless `api.frdic.com` URL and infers its MP3 type from the query string.

If the server response contains no public audio URL, the app reports that clearly instead of inventing a playable link. It does not bypass login, payment, client-only playback, or dynamic access controls.

Godic can respond with `upgrade_info.mp3`, a short upgrade/audition prompt, from an otherwise valid media endpoint. The proxy now detects that redirect/filename and refuses to present it as the article's complete audio. If the Godic page plays the full file only in a logged-in or entitled browser session, use the original playback link in that session; the extractor cannot copy those private cookies or bypass the access control.

## Render

This repository includes `render.yaml`. In Render, create a Blueprint from this repository. The service runs `python app.py`, binds to `0.0.0.0`, and reads Render's `PORT` environment variable.

The app only parses data publicly returned by the target page. It does not bypass login, payment, or access controls.
