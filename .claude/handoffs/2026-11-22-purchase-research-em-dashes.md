# Remove em dashes from product-purchase-research

- **Found:** 2026-11-22, while applying retro a116e5.
- **Problem:** `skills/product-purchase-research/SKILL.md` has em dashes on lines 3, 29, 36, 42, 53, 78, 88, 151 and 152. The shared writing rule (AGENTS.md section 5) bans em and en dashes.
- **Fix:** reword each line with a period, colon, comma or parentheses. Never swap in a hyphen.
- **Done when:** `grep -n '[—–]' skills/product-purchase-research/SKILL.md` prints nothing.
