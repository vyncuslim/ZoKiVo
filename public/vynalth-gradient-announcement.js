/* Vynalth AI Gradient 2026 — calm, accessible 40%-cohort announcement.
 * Does not determine cohort: the first-paint bootstrap owns that decision.
 * Display is optional; do not block any application functions.
 */
(() => {
  'use strict';
  if (typeof document === 'undefined' || document.documentElement.dataset.vynGradient !== 'new') return;
  const seenKey = 'vynalth-gradient-celebrated-v2';
  let alreadySeen = document.cookie.split(';').some(part => part.trim() === seenKey + '=1');
  try { alreadySeen ||= localStorage.getItem(seenKey) === '1'; } catch (_) {}
  if (alreadySeen) return;

  const css = document.createElement('style');
  css.dataset.vynalthCelebration = 'true';
  css.textContent = `
    #vyn-gradient-announce {position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:20px;background:rgba(17,28,41,.43);font:inherit;color:#182737}
    #vyn-gradient-announce * {box-sizing:border-box}
    #vyn-gradient-announce .vyn-ga-dialog {position:relative;width:min(510px,100%);background:#fffdf9;border:1px solid #c6d4d0;border-radius:14px;box-shadow:0 20px 60px rgba(20,36,51,.22);padding:clamp(24px,5vw,38px);outline:none}
    #vyn-gradient-announce .vyn-ga-rule {width:100%;height:5px;background:linear-gradient(90deg,#9FB6D9 0%,#D9F0E3 25%,#8FC9BD 45%,#EEDDF9 65%,#BA8DB9 82%,#F4DC84 100%);margin:0 0 27px}
    #vyn-gradient-announce .vyn-ga-label {font-size:11px;letter-spacing:.17em;text-transform:uppercase;color:#4D6570;font-weight:750;margin:0 0 16px}
    #vyn-gradient-announce h2 {font-family:Georgia,'Times New Roman',serif;font-size:clamp(27px,5vw,36px);font-weight:500;letter-spacing:-.035em;line-height:1.11;margin:0 28px 16px 0;color:#142B36}
    #vyn-gradient-announce .vyn-ga-desc {font-size:15px;line-height:1.7;color:#415966;margin:0 0 24px}
    #vyn-gradient-announce .vyn-ga-note {font-size:12px;line-height:1.55;color:#5C6D74;margin:19px 0 0}
    #vyn-gradient-announce .vyn-ga-actions {display:flex;flex-wrap:wrap;gap:9px}
    #vyn-gradient-announce .vyn-ga-actions a,#vyn-gradient-announce .vyn-ga-actions button {font:600 13px/1.3 ui-sans-serif,system-ui,sans-serif;display:inline-flex;align-items:center;justify-content:center;min-height:42px;border-radius:7px;padding:11px 14px;text-decoration:none;cursor:pointer;transition:background .15s ease}
    #vyn-gradient-announce .vyn-ga-actions a {background:#1B3C48;color:#fff;border:1px solid #1B3C48}
    #vyn-gradient-announce .vyn-ga-actions a:hover {background:#2D5964}
    #vyn-gradient-announce .vyn-ga-actions button {border:1px solid #B7C8C7;background:#fff;color:#244752}
    #vyn-gradient-announce .vyn-ga-actions button:hover {background:#F0F5F2}
    #vyn-gradient-announce .vyn-ga-close {position:absolute;right:17px;top:18px;background:transparent;color:#48616D;border:0;border-radius:5px;font-size:23px;line-height:1;padding:6px 9px;cursor:pointer}
    #vyn-gradient-announce :focus-visible {outline:3px solid #315D73;outline-offset:3px}
    @media(prefers-reduced-motion:no-preference){#vyn-gradient-announce .vyn-ga-dialog {animation:vyn-ga-appear .2s ease-out both}@keyframes vyn-ga-appear{from{transform:translateY(8px);opacity:0}to{transform:none;opacity:1}}}
  `;
  const markSeen = () => {
    const host = location.hostname.toLowerCase();
    const domain = host === 'vynalthai.com' || host.endsWith('.vynalthai.com') ? '; Domain=.vynalthai.com' : '';
    try {
      document.cookie = seenKey + '=1; Path=/; Max-Age=31536000; SameSite=Lax' +
        (location.protocol === 'https:' ? '; Secure' : '') + domain;
      localStorage.setItem(seenKey, '1');
    } catch (_) {}
  };
  const show = () => {
    if (document.getElementById('vyn-gradient-announce')) return;
    document.head.append(css);
    const overlay = document.createElement('div');
    overlay.id = 'vyn-gradient-announce';
    const dialog = document.createElement('section');
    dialog.className = 'vyn-ga-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'vyn-ga-title');
    dialog.setAttribute('aria-describedby', 'vyn-ga-desc');
    dialog.tabIndex = -1;
    const rule = document.createElement('div');
    rule.className = 'vyn-ga-rule';
    rule.setAttribute('aria-hidden', 'true');
    const label = document.createElement('p');
    label.className = 'vyn-ga-label';
    label.textContent = 'VYNALTH AI · DESIGN PREVIEW';
    const title = document.createElement('h2');
    title.id = 'vyn-ga-title';
    title.textContent = 'You got the new look.';
    const description = document.createElement('p');
    description.className = 'vyn-ga-desc';
    description.id = 'vyn-ga-desc';
    description.textContent = 'Congratulations! You’re among the 40% selected to see Vynalth AI’s new visual design. Share it with your friends and see who else gets lucky.';
    const note = document.createElement('p');
    note.className = 'vyn-ga-note';
    note.textContent = 'Your experience is yours to explore. Sharing is entirely optional.';
    const close = document.createElement('button');
    close.className = 'vyn-ga-close';
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close announcement');
    const actions = document.createElement('div');
    actions.className = 'vyn-ga-actions';
    const pageUrl = location.origin + location.pathname;
    const caption = 'I got the new look! 🎨 I’m among the 40% seeing Vynalth AI’s new design. Visit ' + pageUrl + ' and see if you’re lucky too. #VynalthAI';
    const x = document.createElement('a');
    x.textContent = 'Share on X';
    x.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(caption);
    x.target = '_blank'; x.rel = 'noopener noreferrer';
    const linkedIn = document.createElement('a');
    linkedIn.textContent = 'LinkedIn';
    linkedIn.href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(pageUrl);
    linkedIn.target = '_blank'; linkedIn.rel = 'noopener noreferrer';
    const instagram = document.createElement('button');
    instagram.type = 'button';
    instagram.textContent = 'Copy for Instagram';
    instagram.setAttribute('aria-label', 'Copy a share caption for Instagram');
    instagram.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(caption);
        instagram.textContent = 'Caption copied ✓';
      } catch (_) {
        instagram.textContent = 'Copy unavailable';
      }
    });
    actions.append(x, linkedIn, instagram);
    dialog.append(rule, label, title, description, actions, note, close);
    overlay.append(dialog);
    const previousFocus = document.activeElement;
    const dismiss = () => {
      overlay.remove();
      css.remove();
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
    function onKeyDown(event) {
      if (event.key === 'Escape') dismiss();
      if (event.key !== 'Tab') return;
      const focusable = [close, x, linkedIn, instagram];
      const index = focusable.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); focusable[focusable.length-1].focus(); }
      else if (!event.shiftKey && index === focusable.length-1) { event.preventDefault(); focusable[0].focus(); }
    }
    close.addEventListener('click', dismiss);
    overlay.addEventListener('click', event => { if (event.target === overlay) dismiss(); });
    document.addEventListener('keydown', onKeyDown);
    document.body.append(overlay);
    markSeen();
    close.focus();
  };
  const begin = () => {
    const randomMs = 1000 + Math.random() * 4000;
    window.setTimeout(show, randomMs);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin, { once: true });
  else begin();
})();