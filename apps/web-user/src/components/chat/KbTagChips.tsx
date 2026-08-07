import type { LiveKbTagResult } from "../../hooks/useLiveKbSearch";

type KbTagChipsProps = Readonly<{
  tags: LiveKbTagResult[];
  selectedTags: string[];
  onSelectTag: (tag: LiveKbTagResult) => void;
}>;

const TECHNICAL_TOKEN_PATTERN = /(^|[\s_.-])(canonical|cluster|clusters|script|command|implementation|report|debug|diagnostic|pipeline|manifest|snapshot|fixture|spec|test|pilot|rankmeta|rank-meta)([\s_.-]|$)|\.(md|json|csv|tsx?|jsx?|ps1)$/i;

function cleanTagLabel(value: string): string {
  return value
    .replace(/["',]+/g, " ")
    .replace(/[_.\/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTagLabel(tag: LiveKbTagResult): string {
  const preferred = cleanTagLabel(tag.labelAr || tag.label || tag.id || "");
  if (!preferred || TECHNICAL_TOKEN_PATTERN.test(preferred)) {
    return "وسم مرتبط";
  }
  return preferred;
}

export function KbTagChips({ tags, selectedTags, onSelectTag }: KbTagChipsProps) {
  if (!tags.length) {
    return null;
  }

  return (
    <div className="hybrid-kb-tag-chips" data-hybrid-kb-tag-chips="true">
      {tags.map((tag) => {
        const selected = selectedTags.includes(tag.id);
        return (
          <button
            key={tag.id}
            data-feature-key={tag.id}
            type="button"
            className={`hybrid-kb-tag-chip${selected ? " hybrid-kb-tag-chip--selected" : ""}`}
            aria-pressed={selected}
            data-hybrid-kb-tag-id={tag.id}
            onClick={() => onSelectTag(tag)}
          >
            <span>{getTagLabel(tag)}</span>
          </button>
        );
      })}
    </div>
  );
}