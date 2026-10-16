# Wayground/Quizizz original paper Q-Cards optical compatibility

Original source: https://cf.quizizz.com/pdf/Quizizz-QCards/en.pdf

Verified from the original PDF (61 pages including instructions):
- Pages 2–61 encode 60 numbered cards.
- Each card contains an independent black-square 6x6 binary marker rather than a standard QR payload.
- The outer ring is black; the interior changes with the card number.
- Extracted 60 binary patterns and all 4 quarter turns: 240 unique variants, minimum Hamming distance of 3 across rotations.
- The printed top/right/bottom/left letters for upright card are A/B/C/D.
- The recognition dictionary is embedded in src/lib/wayground-cards.ts.

ZoKivo implementation:
- Independently decodes six-by-six optical codes in camera frames, including several markers in one frame, using browser canvas.
- Finds approximately square black connected components, then samples 36 cell centers and compares against all 240 known variants. Exact or uniquely closest one-bit errors only; other codes rejected.
- Supports A/B/C/D rotation and teacher review before submitting.

Current limits:
- Experimental: detector currently assumes nearly front-facing, axis-aligned square markers and good lighting and contrast. It is not perspective-corrected.
- No on-device photographic test conducted. Do not claim all 60 cards actually scan correctly on arbitrary phones.
- Unsupported high-skew, distant, occluded or severely perspective-distorted cards may be missed.
- No Wayground login, API or account access. This independent interoperability implementation is not endorsed by Wayground.
- Server Paper Mode sessions remain behind PAPER_MODE_ENABLED and require proper database and host token setup before use.

QA next: actual printed page photo with 2, 4, 10 markers simultaneously; all 4 rotations of ID 1, ID 2 and ID 60; assess true positives/false positives and test several phones. Do not open this classroom prototype to children until real-world and authorization testing is complete.
