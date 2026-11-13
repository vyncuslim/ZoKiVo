/* Vynalth AI Gradient 2026 — calm, accessible 40%-cohort announcement.
 * Does not determine cohort: the first-paint bootstrap owns that decision.
 * Display is optional; do not block any application functions.
 */
(() => {
  'use strict';
  if (typeof document === 'undefined') return;
  // Visiting ?vyn_celebrate=1 is a production cohort check, never a way to
  // override the 40% lottery. The 60% legacy group gets an honest explanation.
  if (document.documentElement.dataset.vynGradient !== 'new') {
    if (new URLSearchParams(location.search).get('vyn_celebrate') === '1') {
      const explainLegacy = () => {
        if (document.getElementById('vyn-gradient-legacy-status')) return;
        const surface = document.createElement('section');
        surface.id = 'vyn-gradient-legacy-status';
        surface.setAttribute('role', 'dialog');
        surface.setAttribute('aria-modal', 'true');
        surface.setAttribute('aria-labelledby', 'vyn-gradient-legacy-title');
        surface.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:20px;background:rgba(17,28,41,.4);font-family:ui-sans-serif,system-ui,sans-serif;color:#1b3441';
        const box = document.createElement('div');
        box.style.cssText = 'width:min(480px,100%);padding:clamp(22px,5vw,36px);background:#fffdf9;border:1px solid #ccd9d4;border-radius:14px;box-shadow:0 16px 60px rgba(20,36,51,.22)';
        const title = document.createElement('h2');
        title.id = 'vyn-gradient-legacy-title';
        title.textContent = 'You’re viewing the classic design.';
        title.style.cssText = 'font-size:clamp(23px,5vw,30px);line-height:1.2;margin:0 0 12px';
        const body = document.createElement('p');
        body.textContent = 'Your browser is in the 60% classic group. Only the randomly selected 40% see the new colors and celebration card. Your original assignment stays the same.';
        body.style.cssText = 'font-size:15px;line-height:1.65;color:#445c65;margin:0 0 22px';
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Got it';
        close.style.cssText = 'padding:12px 18px;background:#1B3C48;color:white;border:0;border-radius:8px;cursor:pointer;min-height:44px';
        const dismiss = () => { surface.remove(); document.removeEventListener('keydown', keyHandler); };
        const keyHandler = event => { if (event.key === 'Escape') dismiss(); };
        close.addEventListener('click', dismiss);
        surface.addEventListener('click', event => { if (event.target === surface) dismiss(); });
        document.addEventListener('keydown', keyHandler);
        box.append(title,body,close);surface.append(box);document.body.append(surface);close.focus();
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', explainLegacy, {once:true});
      else explainLegacy();
    }
    return;
  }
  // Each product gets its own announcement, instead of suppressing all
  // products after the very first website. Cohort odds are unchanged.
  const host = location.hostname.toLowerCase();
  const chat = host === 'vynalthai.com' && /^\/(?:en\/|cn\/|ms\/)?c(?:\/|$)/.test(location.pathname);
  const product = chat ? 'vynalth-chat' : host;
  const seenKey = 'vynalth-gradient-celebrated-v3-' + product.replace(/[^a-z0-9-]/g, '-');
  const replayRequested = new URLSearchParams(location.search).get('vyn_celebrate') === '1';
  let alreadySeen = document.cookie.split(';').some(part => part.trim() === seenKey + '=1');
  try { alreadySeen ||= localStorage.getItem(seenKey) === '1'; } catch (_) {}

  // Already-seen visitors still get an unobtrusive, optional replay control.

  const palettes = {
    'vynalthai.com':['#9FB6D9','#D9F0E3'],
    'search.vynalthai.com':['#9FB6D9','#D9F0E3'],
    'vynalth-chat':['#8FC9BD','#EEDDF9'],
    'vynchapp.vynalthai.com':['#BA8DB9','#FFF0E1'],
    'zokivo.xyz':['#F4DC84','#79BEDF'],
    'zokivo.vynalthai.com':['#F4DC84','#79BEDF'],
    'vynova.vynalthai.com':['#FFA6A0','#C0D392'],
    'utility.vynalthai.com':['#8A8D8E','#FAF2D9'],
    'pedia.vynalthai.com':['#729A93','#FBFFE5'],
    'dict.vynalthai.com':['#73AE52','#FBF1D7'],
    'vpn.page.vynalthai.com':['#0E61AC','#FAF2E0']
  };
  const [brandStart, brandEnd] = palettes[product] || ['#9FB6D9','#D9F0E3'];
  const css = document.createElement('style');
  css.dataset.vynalthCelebration = 'true';
  css.textContent = `
    #vyn-gradient-announce {position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:20px;background:rgba(17,28,41,.43);font:inherit;color:#182737}
    #vyn-gradient-announce * {box-sizing:border-box}
    #vyn-gradient-announce .vyn-ga-dialog {position:relative;width:min(510px,100%);background:#fffdf9;border:1px solid #c6d4d0;border-radius:14px;box-shadow:0 20px 60px rgba(20,36,51,.22);padding:clamp(24px,5vw,38px);outline:none}
    #vyn-gradient-announce .vyn-ga-rule {width:100%;height:5px;background:linear-gradient(90deg,var(--ga-brand-start),var(--ga-brand-end));margin:0 0 27px}
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
    #vyn-gradient-replay{position:fixed;right:16px;bottom:16px;z-index:2147482999;border:1px solid rgba(33,76,90,.23);border-radius:999px;background:linear-gradient(110deg,var(--ga-brand-start),var(--ga-brand-end));padding:10px 15px;color:#172F3A;font:650 12px/1.4 ui-sans-serif,system-ui,sans-serif;box-shadow:0 3px 18px rgba(20,50,60,.14);cursor:pointer}
    #vyn-gradient-replay[hidden]{display:none}
    #vyn-gradient-replay:focus-visible{outline:3px solid #315D73;outline-offset:3px}
    @media(prefers-reduced-motion:no-preference){#vyn-gradient-announce .vyn-ga-dialog {animation:vyn-ga-appear .2s ease-out both}@keyframes vyn-ga-appear{from{transform:translateY(8px);opacity:0}to{transform:none;opacity:1}}}
  `;
  const replay = document.createElement('button');
  replay.id = 'vyn-gradient-replay';
  replay.type = 'button';
  replay.textContent = '🎉 Your lucky 40% card';
  replay.setAttribute('aria-label', 'Show your new look celebration again');
  replay.style.setProperty('--ga-brand-start', brandStart);
  replay.style.setProperty('--ga-brand-end', brandEnd);
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
    replay.hidden = true;
    const overlay = document.createElement('div');
    overlay.id = 'vyn-gradient-announce';
    overlay.style.setProperty('--ga-brand-start', brandStart);
    overlay.style.setProperty('--ga-brand-end', brandEnd);
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
    label.textContent = 'VYNALTH AI · THE NEW LOOK';
    const title = document.createElement('h2');
    title.id = 'vyn-ga-title';
    title.textContent = '🎉 Congratulations! You got the new look!';
    const description = document.createElement('p');
    description.className = 'vyn-ga-desc';
    description.id = 'vyn-ga-desc';
    description.textContent = 'You were randomly selected! Only 40% of visitors get the new Vynalth AI colors. Celebrate your lucky new look on Instagram, X or LinkedIn, and see whether your friends get selected too!';
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
    [x, linkedIn, instagram].forEach(el => el.addEventListener('click', markSeen));
    actions.append(x, linkedIn, instagram);
    dialog.append(rule, label, title, description, actions, note, close);
    overlay.append(dialog);
    const previousFocus = document.activeElement;
    const dismiss = () => {
      markSeen();
      overlay.remove();
      replay.hidden = false;
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
    close.focus();
  };
  replay.addEventListener('click', show);
  const begin = () => {
    // Attach after DOM ready. This button permits revisiting a missed card,
    // without re-randomizing or letting an old-cohort visitor change cohort.
    document.head.append(css);
    document.body.append(replay);
    if (!alreadySeen || replayRequested) {
      const randomMs = 1000 + Math.random() * 4000;
      window.setTimeout(show, randomMs);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin, { once: true });
  else begin();
})();