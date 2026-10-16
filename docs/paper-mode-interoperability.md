# Paper Mode: Multi-QR and Wayground interoperability

## Implemented scanner (October 2026)
- The native Barcode Detection API (where browser support permits) discovers several QR markers from a single captured canvas frame.
- Each native candidate is independently re-decoded with jsQR to establish its physical orientation. Native corner ordering alone is not enough to trust answer orientation.
- Fallback for other browsers: repeated jsQR decoding of the same captured frame, masking found QR regions to find additional cards (up to 16 candidates). This is computationally heavier and may miss densely packed/distant cards.
- Two consecutive processed frames at the same A/B/C/D rotation are required before accepting a card; duplicate card IDs in a frame are ignored.
- Scan UI visually outlines detections, shows per-frame count, lets teachers correct A/B/C/D, and submits the reviewed batch to the server.
- The camera image is handled inside the browser; only reviewed numbered card answers are sent to the session backend.

## Wayground Q-Card compatibility — NOT YET SUPPORTED
Wayground/Quizizz Paper Mode uses specialized visual codes, not necessarily standards-compliant QR. A Wayground card is not expected to be parsed by BarcodeDetector or jsQR. Its four answer labels and per-card printed number do not guarantee the internal pattern's decoding scheme.

For real re-use of Wayground cards, request the official 60-card Q-Cards PDF or clean close-up images of card IDs 1,2,3,4 at A/B/C/D rotations, then separately:
1. Determine whether the marker family is an encoded matrix, ArUco-like fiducial, or proprietary pattern.
2. Build an isolated template/dictionary decoder with explicit card-ID and rotation mapping.
3. Validate all 60 cards at all four rotations, plus skew, shadow, print scaling, crowd overlap, and mixed marker types.
4. Require on-screen confirmation and keep manual corrections as a fallback.
5. Indicate compatibility is independently implemented and not affiliated with or endorsed by Wayground. Do not request its private APIs, tokens, or account data.

## Quality gates
- Verify 1, 2, 4, 10 cards in the same photo/frame, not merely accumulated across seconds.
- Validate all four rotations of two or more distinct ZoKivo cards.
- Reject non-ZoKivo strings and unreadable/mismatched orientations.
- Validate no duplicate score awarded for repeated capture or submits.
- Test Chrome Android and desktop, and jsQR fallback on browsers without BarcodeDetector.
- Compare reported count to manually enumerated visible cards for precision/recall.

## Security
The existing Paper Mode POST session-creation route defaults to disabled behind PAPER_MODE_ENABLED. Keep disabled in public production until teacher auth, throttling and access controls are in place. The QR scanner does not make claims of compatibility with third-party specialized markers.
