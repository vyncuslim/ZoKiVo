# ZoKivo Weird Wonder Quiz Bank — 2026-11-05

**Purpose.** Extend ZoKivo's published library with 12 unusual but educational categories and 240 original multiple-choice questions. This is an additive content expansion, not a change to authentication or WAF rules.

## Categories

Chinese: 脑洞谜题, 反常识科学, 搞怪数学, 外星逻辑 (80 questions).

English: Weird Animals, Strange Space, Physics What-Ifs, Wacky Inventions, Funny Mysteries, Weird Everyday Science (120 questions).

Bahasa Melayu: Teka-Teki Pelik, Sains Pelik (40 questions).

Every pack contains exactly 20 questions with four distinct options, one answer key and a short explanation. Fictional situations are clearly defined by the question, so every item has a checkable answer.

## Accuracy references used for unusual science claims

- NASA, Venus facts (243-Earth-day rotation, 225-Earth-day orbit, unusual apparent sunrise): https://science.nasa.gov/venus/venus-facts/
- NASA, Uranus facts (axial tilt near 90 degrees): https://science.nasa.gov/uranus/facts/
- Smithsonian Ocean, cephalopods (three hearts, copper-based blue blood): https://ocean.si.edu/ocean-life/invertebrates/octopuses-squids-and-relatives
- Smithsonian Institution, butterfly foot taste sensors: https://www.si.edu/object/silgoi_68308
- National Geographic, male seahorse brood pouch: https://www.nationalgeographic.com/animals/fish/facts/seahorses

Other questions are based on common classroom mathematics, defined hypothetical rules, elementary physics and everyday observations. These links support specific factual assertions; they do not imply external review of all 240 questions.

## Release process

1. Validate `content/curated-weird-wonder-20261105-part{1,2,3}.json` against `scripts/verify-weird-wonder-questions.cjs`, including all source questions against SQL migration contents.
2. Check currently published production stems for duplicates.
3. Apply `migrations/022_weird_wonder_question_bank.sql` **only to an isolated Neon Preview branch**, in a single transaction; verify 12 new packs/240 questions, answer distribution and exact content parity.
4. Review PR and Vercel Preview. Do **not** auto-run migration during a build.
5. Before any production migration, verify production deployment matches merged commit, create separate Neon pre-release snapshot branch, and confirm baseline counts.
6. Apply migration once transactionally, then verify exact production totals, source parity and unchanged historical data.
7. Keep real Google OAuth/Cloudflare security challenge and 20/100 physical classroom tests independent. Deploying content does not constitute those tests passing.

**Safety:** No secrets, private accounts or user content are included in these questions. No WAF rules are bypassed.