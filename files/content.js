(function () {
  'use strict';

  // Guard: if this script somehow re-runs inside the print pop-up we
  // generate below (Chrome injects content scripts into about:blank
  // windows opened by a matching page), bail out immediately. Without
  // this, the pop-up's own <img alt="Return Mailing Label"> etc. get
  // matched again and a second button gets added on top of "Print".
  if (document.documentElement.dataset.arp4x6PrintWindow) return;

  let observer = null;

  function findLabelImage() {
    return (
      document.querySelector('img.return-label-image.cut-line-sign') ||
      document.querySelector('img[alt="Return Mailing Label"]')
    );
  }

  function findAuthSlipImage() {
    return document.querySelector('img[alt="Return Authorization Slip"]');
  }

  function findItemTable() {
    const headers = Array.from(document.querySelectorAll('th'));
    const match = headers.find((th) =>
      th.textContent.trim().includes('Item Descriptions')
    );
    return match ? match.closest('table') : null;
  }

  function resolveUrl(src) {
    try {
      return new URL(src, window.location.href).href;
    } catch (e) {
      return src;
    }
  }

  // The label endpoint (documents/download/.../ShipperLabel) appears to
  // reject a second standalone request to the same URL — the same 400
  // "Request Header Or Cookie Too Large" happens whether it's our fetch()
  // or a plain "open in new tab". Since the <img> is same-origin and
  // already loaded on the page, sidestep the network entirely: draw the
  // already-decoded image onto a canvas and export that instead.
  function imageElementToDataUrl(imgEl) {
    return new Promise((resolve, reject) => {
      const draw = () => {
        try {
          if (!imgEl.naturalWidth) {
            reject(new Error('image has no natural width — it may not have actually loaded on the page'));
            return;
          }
          const canvas = document.createElement('canvas');
          canvas.width = imgEl.naturalWidth;
          canvas.height = imgEl.naturalHeight;
          canvas.getContext('2d').drawImage(imgEl, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (err) {
          reject(err);
        }
      };
      if (imgEl.complete) {
        draw();
      } else {
        imgEl.addEventListener('load', draw, { once: true });
        imgEl.addEventListener(
          'error',
          () => reject(new Error('image failed to load')),
          { once: true }
        );
      }
    });
  }

  function injectButton(labelImg, authImg) {
    if (document.getElementById('arp4x6-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'arp4x6-btn';
    btn.textContent = '\uD83D\uDDA8\uFE0F Print 4x6 Return Label';
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '16px',
      right: '16px',
      zIndex: 2147483647,
      padding: '18px 20px',
      background: '#ff9900',
      color: '#111',
      border: 'none',
      borderRadius: '6px',
      fontSize: '20px',
      fontWeight: '600',
      fontFamily: 'Arial, sans-serif',
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    });
    btn.addEventListener('click', () => {
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Preparing\u2026';
      openPrintWindow(labelImg, authImg).finally(() => {
        btn.disabled = false;
        btn.textContent = original;
      });
    });
    document.body.appendChild(btn);

    // Stop watching the DOM once we've done our job — no need to keep
    // re-scanning every mutation on a page this chatty.
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  async function openPrintWindow(labelImg, authImg) {
    const labelUrl = resolveUrl(labelImg.getAttribute('src'));
    const authUrl = resolveUrl(authImg.getAttribute('src'));
    const table = findItemTable();
    const tableHtml = table ? table.outerHTML : '';

    let labelSrc = labelUrl;
    let authSrc = authUrl;

    try {
      labelSrc = await imageElementToDataUrl(labelImg);
    } catch (err) {
      console.error(
        'Amazon Return Prep: could not read the label image via canvas — falling back to its URL, which may fail to load in the pop-up. Check whether the label actually renders on the Amazon page itself first.',
        err
      );
    }
    // The auth-slip barcode is left as its direct URL (not fetched/embedded):
    // Amazon's page CSP can block a script-initiated fetch() to the S3 host
    // even though the exact same URL loads fine as a plain <img> — and since
    // the pop-up document we write has no CSP of its own, a plain <img src>
    // to that URL loads without issue there.

    const html = `<!DOCTYPE html>
<html data-arp4x6-print-window="1">
<head>
<meta charset="utf-8">
<title>4x6 Return Label Prep</title>
<style>
  @page { size: 4in 6in; margin: 0; }
  html, body { margin: 0; padding: 0; }
  .page {
    width: 4in;
    height: 6in;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    overflow: hidden;
    page-break-after: always;
  }

  /* Page 1: shipping label, rotated to fit a portrait 4x6.
     If it prints upside-down, change 90deg to -90deg below. */
  #page1 img {
    transform: rotate(90deg);
    max-width: 6in;
    max-height: 4in;
  }

  /* Page 2: Return Authorization Slip barcode + item table.
     Sized conservatively (with page-break-inside: avoid) so the content
     can't overflow into a near-empty 3rd page. */
  #page2 {
    flex-direction: column;
    padding: 0.2in;
    page-break-inside: avoid;
  }
  #page2 img {
    max-width: 3.2in;
    max-height: 1.5in;
    margin-bottom: 0.15in;
  }
  #page2 table {
    width: 100%;
    border-collapse: collapse;
    font-family: Arial, sans-serif;
    font-size: 8px;
  }
  #page2 th, #page2 td {
    border: 1px solid #000;
    padding: 3px;
    text-align: left;
  }
  /* ID selector beats the .page class rule on specificity, so this can't
     lose to page-break-after: always above no matter how the DOM shakes out. */
  #page2 { page-break-after: auto; }

  .no-print { text-align: center; padding: 10px; font-family: Arial, sans-serif; }
  .no-print button {
    padding: 8px 16px;
    font-size: 14px;
    cursor: pointer;
  }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <div class="no-print"><button id="arp4x6-manual-print">Print</button></div>
  <div class="page" id="page1">
    <img src="${labelSrc}" alt="Return Mailing Label">
  </div>
  <div class="page" id="page2">
    <img src="${authSrc}" alt="Return Authorization Slip">
    ${tableHtml}
  </div>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=500,height=800');
    if (!w) {
      alert('Pop-up blocked. Please allow pop-ups for Amazon to use this extension.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();

    const manualBtn = w.document.getElementById('arp4x6-manual-print');
    if (manualBtn) {
      manualBtn.addEventListener('click', () => w.print());
    }

    // Auto-open the print dialog so there's no extra click. Triggered from
    // here (rather than a <script> inside the written document) because the
    // pop-up's own `load` event fired inconsistently with data: URI images.
    // The manual "Print" button in the pop-up still works as a fallback if
    // this gets blocked or the dialog is dismissed.
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch (err) {
        console.error('Amazon Return Prep: auto-print failed', err);
      }
    }, 300);
  }

  function init() {
    const labelImg = findLabelImage();
    const authImg = findAuthSlipImage();
    if (!labelImg || !authImg) return; // Not a return-instructions page, or not rendered yet.
    injectButton(labelImg, authImg);
  }

  init();

  // Amazon renders this content client-side after an initial load, so watch
  // for it to appear rather than relying on a single check at document_idle.
  observer = new MutationObserver(() => init());
  observer.observe(document.body, { childList: true, subtree: true });
})();
