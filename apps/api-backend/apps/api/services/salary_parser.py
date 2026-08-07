import re

AR_DIGITS = {"٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9"}
ORDINALS = {
    "الأولى": 1, "الأول": 1, "الاولى": 1, "الاول": 1,
    "الثانية": 2, "الثاني": 2, "الثان": 2, "الثانئ": 2,
    "الثالثة": 3, "الثالث": 3,
    "الرابعة": 4, "الرابع": 4,
    "الخامسة": 5, "الخامس": 5,
    "السادسة": 6, "السادس": 6,
    "السابعة": 7, "السابع": 7,
    "الثامنة": 8, "الثامن": 8,
    "التاسعة": 9, "التاسع": 9,
    "العاشرة": 10, "العاشر": 10
}

RANKS = ["عميد", "لواء", "عقيد", "مقدم", "رائد", "نقيب", "رقيب", "ملازم"]


def to_western_digits(s: str) -> str:
    return ''.join(AR_DIGITS.get(ch, ch) for ch in (s or ""))


def extract_rank_degrees(text: str):
    """Return list of (rank, degree) tuples found in text.
    Supports Arabic digits and common ordinal words (الأولى, الثانية, ...).
    """
    if not text:
        return []
    t = text.strip()
    # build regex to capture rank and optional degree or ordinal
    rank_pat = '|'.join(re.escape(r) for r in RANKS)
    # match rank with optional "درجة N" or ordinal word
    pat = re.compile(rf"(?:ال)?({rank_pat})(?:\s*(?:درجة|الدرجة)?\s*([0-9٠-٩]{{1,2}}))?(?:|\s*([^\s]+))", re.UNICODE)

    results = []
    for m in pat.finditer(t):
        rank = m.group(1)
        deg_raw = m.group(2)
        ordinal_candidate = m.group(3)
        deg = None
        if deg_raw:
            deg_w = to_western_digits(deg_raw)
            try:
                deg = str(int(deg_w))
            except Exception:
                deg = None
        elif ordinal_candidate and ordinal_candidate in ORDINALS:
            deg = str(ORDINALS[ordinal_candidate])
        if not deg:
            deg = "1"
        results.append((rank, deg))

    # deduplicate preserving order
    out = []
    seen = set()
    for r in results:
        key = (r[0], r[1])
        if key in seen: continue
        seen.add(key)
        out.append(r)
    return out
