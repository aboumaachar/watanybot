/**
 * Speech sanitization — prepare text for TTS output.
 * Strips markdown, URLs, reference markers; truncates for spoken delivery.
 */

/**
 * Sanitize text for TTS consumption. Removes formatting artifacts,
 * simplifies punctuation, and truncates to a max word count.
 */
export function sanitizeForSpeech(text: string, maxWords = 45): string {
  let s = text;
  // Strip fenced code blocks
  s = s.replace(/```[\s\S]*?```/g, "");
  // Strip inline code
  s = s.replace(/`[^`]+`/g, "");
  // Strip markdown headings, bold, italic, strikethrough
  s = s.replace(/[#*_~]/g, "");
  // Strip URLs
  s = s.replace(/https?:\/\/\S+/g, "");
  // Strip reference markers [1], [2], etc.
  s = s.replace(/\[\d+\]/g, "");
  // Strip bracketed metadata and technical identifiers that are often spelled character by character
  s = s.replace(/\[(?:TX|PROC|LAW|ART)[^\]]*\]/gi, " ");
  s = s.replace(/\b(?:tx|proc|law|art|case|ref)[-_:/#]?\w+\b/gi, " ");
  // Strip source citations like (المصدر: ...)
  s = s.replace(/\(المصدر:[^)]*\)/g, "");
  // Remove leftover Latin-heavy tokens that sound robotic in Arabic TTS
  s = s.replace(/\b[A-Za-z][A-Za-z0-9._:/-]*\b/g, " ");
  // Convert punctuation that commonly causes spelling pauses into softer separators
  s = s.replace(/[|\\/_]+/g, "، ");
  s = s.replace(/[()[\]{}<>]+/g, " ");
  s = s.replace(/\s*[:;]+\s*/g, "، ");
  s = s.replace(/\s*[=-]{2,}\s*/g, "، ");
  // Strip bullet/list markers
  s = s.replace(/^\s*[-•]\s+/gm, "");
  // Normalize repeated punctuation for smoother prosody
  s = s.replace(/[!؟?]{2,}/g, "؟");
  s = s.replace(/[.]{2,}/g, ".");
  s = s.replace(/،\s*،+/g, "، ");
  // Collapse newlines and whitespace
  s = s.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  // Truncate to max words
  const words = s.split(/\s+/);
  if (words.length > maxWords) {
    s = words.slice(0, maxWords).join(" ") + ".";
  }
  return s;
}
