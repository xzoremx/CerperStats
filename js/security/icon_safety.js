// Icon Safety Utilities
// - Hash check (SHA-256) against trusted list
// - Optional ECDSA P-256 signature verification (spki public key in JSON)
// - Strict sanitization for untrusted inline SVG
// - Sandboxed iframe (allow-scripts only) for signed icons with advanced CSS/JS

(function(){
  const STATE = {
    trusted: null,
    pubKey: null,
  };

  async function loadTrusted() {
    if (STATE.trusted) return STATE.trusted;
    try {
      if (window.iconConfig && typeof window.iconConfig.getTrustedIcons === 'function') {
        STATE.trusted = window.iconConfig.getTrustedIcons();
      } else {
        const res = await fetch('js/security/trusted_icons.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('trusted_icons.json missing');
        STATE.trusted = await res.json();
      }
    } catch (_) {
      STATE.trusted = {};
    }
    return STATE.trusted;
  }

  async function loadPublicKey() {
    if (STATE.pubKey !== null) return STATE.pubKey;
    try {
      let data;
      if (window.iconConfig && typeof window.iconConfig.getIconPublicKey === 'function') {
        data = window.iconConfig.getIconPublicKey();
      } else {
        const res = await fetch('js/security/icon_public_key.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('icon_public_key.json missing');
        data = await res.json();
      }
      if (data && data.spki_base64) {
        const spki = base64ToArrayBuffer(data.spki_base64);
        STATE.pubKey = await crypto.subtle.importKey(
          'spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']
        );
      } else if (data && data.jwk) {
        STATE.pubKey = await crypto.subtle.importKey(
          'jwk', data.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']
        );
      } else {
        STATE.pubKey = undefined;
      }
    } catch (_) {
      STATE.pubKey = undefined;
    }
    return STATE.pubKey;
  }

  function base64ToArrayBuffer(b64) {
    const bin = atob(b64.replace(/\s+/g, ''));
    const len = bin.length;
    const buf = new Uint8Array(len);
    for (let i=0; i<len; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
  }

  // Convert DER-encoded ECDSA signature to raw (r||s) for P-256
  function ecdsaDerToRaw(derBuf, componentLen = 32) {
    const der = new Uint8Array(derBuf);
    if (der[0] !== 0x30) return derBuf; // not DER sequence, assume already raw
    let offset = 2; // skip 0x30, length
    if (der[1] & 0x80) {
      const lenBytes = der[1] & 0x7f;
      offset = 2 + lenBytes; // skip long-form length
    }
    if (der[offset] !== 0x02) return derBuf; // r INTEGER
    let rLen = der[offset+1];
    let rStart = offset + 2;
    offset = rStart + rLen;
    if (der[offset] !== 0x02) return derBuf; // s INTEGER
    let sLen = der[offset+1];
    let sStart = offset + 2;
    const r = der.slice(rStart, rStart + rLen);
    const s = der.slice(sStart, sStart + sLen);
    // Remove leading zeros and left-pad to componentLen
    const trimPad = (arr) => {
      let a = arr;
      while (a.length > 0 && a[0] === 0) a = a.slice(1);
      if (a.length > componentLen) a = a.slice(a.length - componentLen);
      const out = new Uint8Array(componentLen);
      out.set(a, componentLen - a.length);
      return out;
    };
    const rP = trimPad(r);
    const sP = trimPad(s);
    const raw = new Uint8Array(componentLen * 2);
    raw.set(rP, 0);
    raw.set(sP, componentLen);
    return raw.buffer;
  }

  function bufToHex(buf) {
    const arr = new Uint8Array(buf);
    return Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function sha256Hex(str) {
    const enc = new TextEncoder();
    const digest = await crypto.subtle.digest('SHA-256', enc.encode(str));
    return bufToHex(digest);
  }

  async function verifySignatureECDSA_P256(dataStr, sigBase64) {
    try {
      const key = await loadPublicKey();
      if (!key) return false;
      const enc = new TextEncoder();
      const sigDer = base64ToArrayBuffer(sigBase64);
      const sigRaw = ecdsaDerToRaw(sigDer, 32);
      return await crypto.subtle.verify({ name: 'ECDSA', hash: { name: 'SHA-256' } }, key, sigRaw, enc.encode(dataStr));
    } catch (_) { return false; }
  }

  // Strict whitelist sanitizer (inline SVG only, no CSS/JS)
  function sanitizeSvgStrict(source) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(source, 'image/svg+xml');
      const root = doc.documentElement;
      if (!root || root.nodeName.toLowerCase() === 'parsererror') return '';

      const SVG_NS = 'http://www.w3.org/2000/svg';
      const allowedTags = new Set(['svg','g','path','circle','rect','line','polyline','polygon','ellipse','use','defs','symbol','title','desc']);
      const allowedAttrs = new Set(['id','class','transform','opacity','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','fill-opacity','stroke-opacity','x','y','cx','cy','r','rx','ry','width','height','viewBox','d','points','x1','y1','x2','y2','preserveAspectRatio','href','xlink:href']);
      const urlLike = /url\(\s*[^#]/i; // only url(#id)
      const badProto = /^(?:javascript:|data:text\/html)/i;

      const isSafeAttr = (name, value) => {
        const n = (name || '').toLowerCase();
        const v = String(value ?? '').trim();
        if (!allowedAttrs.has(n)) return false;
        if (n.startsWith('on') || n === 'style') return false;
        if (n === 'href' || n === 'xlink:href') return v.startsWith('#') || v.startsWith('data:image');
        if (['fill','stroke','filter','clip-path','mask'].includes(n)) {
          if (urlLike.test(v) || badProto.test(v)) return false;
        }
        return true;
      };

      const rebuild = (el) => {
        const tag = el.tagName.toLowerCase();
        if (!allowedTags.has(tag)) return null;
        const out = document.createElementNS(SVG_NS, tag);
        Array.from(el.attributes).forEach(attr => { if (isSafeAttr(attr.name, attr.value)) out.setAttribute(attr.name, attr.value); });
        Array.from(el.childNodes).forEach(node => {
          if (node.nodeType === 1) { const c = rebuild(node); if (c) out.appendChild(c); }
          else if (node.nodeType === 3 && (tag === 'title' || tag === 'desc')) out.appendChild(document.createTextNode(node.nodeValue));
        });
        return out;
      };

      const safe = rebuild(root);
      if (!safe) return '';
      if (!safe.getAttribute('xmlns')) safe.setAttribute('xmlns', SVG_NS);
      return safe.outerHTML;
    } catch (e) { console.warn('[IconSafety] sanitizeSvgStrict error:', e); return ''; }
  }

  // Heuristics to block obviously dangerous constructs even in signed content
  function basicSignedChecks(raw) {
    const s = String(raw);
    if (/\bforeignObject\b|<iframe\b|<object\b|<embed\b|<link\b|<audio\b|<video\b/i.test(s)) return false;
    if (/\b(on\w+)\s*=/.test(s)) return false; // inline handlers
    if (/javascript\s*:/.test(s)) return false;
    if (/url\(\s*https?:/i.test(s)) return false;
    // Size limit (50 KB)
    if (new Blob([s]).size > 50 * 1024) return false;
    return true;
  }

  function createSandboxedIframe(srcdoc) {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.border = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.pointerEvents = 'none';
    iframe.srcdoc = srcdoc;
    return iframe;
  }

  async function attachIcon(el, rawIcon, opts={}) {
    try {
      const raw = (rawIcon || '').trim();
      if (!raw) return false;

      // Lucide / Feather shortcuts
      if (raw.startsWith('lucide:')) {
        const name = raw.split(':')[1] || 'bar-chart-2';
        el.innerHTML = `<i data-lucide="${name}"></i>`;
        return true;
      }
      if (!raw.startsWith('<svg') && !raw.startsWith('signed:')) {
        const name = raw || 'bar-chart-2';
        el.innerHTML = `<i data-feather="${name}"></i>`;
        return true;
      }

      // Signed icon path: signed:{ svg, css?, js?, sig? }
      if (raw.startsWith('signed:')) {
        let payload;
        try { payload = JSON.parse(raw.slice('signed:'.length)); } catch (_) { return false; }
        const { svg, css, js, sig } = payload || {};
        if (!svg || !basicSignedChecks(svg + (css||'') + (js||''))) return false;

        // Signature check (optional but recommended)
        let verified = false;
        if (sig) {
          const canonical = JSON.stringify({ svg, css: css||'', js: js||'' });
          verified = await verifySignatureECDSA_P256(canonical, sig);
        }

        // Hash allowlist: accept either sanitized-strict hash or raw hash (developer convenience)
        const trusted = await loadTrusted();
        const svgSan = sanitizeSvgStrict(svg);
        const hSan = await sha256Hex(svgSan);
        const hRaw = await sha256Hex(svg);
        const allowed = !!(trusted[hSan] || trusted[hRaw]);

        // Policy: require BOTH a valid signature and an allowlisted hash
        if ((sig && verified) && allowed) {
          // Render sandboxed iframe with full creative freedom
          const srcdoc = `<!doctype html><meta charset="utf-8">`
            + `<style>html,body{margin:0;padding:0;overflow:hidden}${css||''}</style>`
            + `${svg}`
            + (js ? `<script>${js}<\/script>` : '');
          const frame = createSandboxedIframe(srcdoc);
          el.innerHTML = '';
          el.appendChild(frame);
          return true;
        }
        return false;
      }

      // Raw inline SVG (untrusted) → if hash trusted, render as-is in sandbox; else strict sanitize
      const trusted = await loadTrusted();
      const hSan = await sha256Hex(sanitizeSvgStrict(raw));
      const hRaw = await sha256Hex(raw);
      if (false && (trusted[hSan] || trusted[hRaw])) {
        // Allow advanced rendering in sandbox even without signature
        const srcdoc = `<!doctype html><meta charset="utf-8">${raw}`;
        const frame = createSandboxedIframe(srcdoc);
        el.innerHTML = '';
        el.appendChild(frame);
        return true;
      }
      const safe = sanitizeSvgStrict(raw);
      if (safe) { el.innerHTML = safe; return true; }
      return false;
    } catch (e) {
      console.warn('[IconSafety] attachIcon error:', e);
      return false;
    }
  }

  window.IconSafety = {
    attachIcon,
    sanitizeSvgStrict,
    sha256Hex,
  };
})();
