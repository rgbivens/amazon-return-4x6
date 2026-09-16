# 4x6 Return Label Prep for Amazon

A Chrome extension for anyone printing Amazon return labels on a 4x6 label
printer. Amazon's return-instructions page gives you a shipping label in
the wrong orientation and a separate Return Authorization Slip you have to
handle yourself — this extension turns both into two ready-to-print 4x6
pages with one click.

<!-- TODO: replace with the live listing URL once published -->
<!--**[Install from the Chrome Web Store](#)** -->
<img width="1400" height="560" alt="marquee_1400x560" src="https://github.com/user-attachments/assets/7f8e4343-d605-4e21-b4a3-3fd1bbbfdd68" />

## What it does

On any Amazon return-instructions page, a "🖨️ Print 4x6 Return Label"
button appears in the bottom right-hand corner once the page has 
loaded a shipping label. Clicking it opens a new tab containing:

1. **Page 1** — your shipping label, rotated to print correctly in
   portrait orientation on a 4x6 label.
2. **Page 2** — the Return Authorization Slip barcode and item description,
   sized to print as a second 4x6 label (handy to tuck inside the package
   in case the outer label gets damaged).

The print dialog opens automatically, so there's nothing else to click —
just confirm the print.

<img width="50%" alt="Return-Page" src="https://github.com/user-attachments/assets/fb11b061-f24c-40be-a387-0cfeaa869adc" />

Amazon Return Instructions Page

<img width="50%" alt="Directions" src="https://github.com/user-attachments/assets/bc306135-a2b5-4cc3-9b73-d7a79a7bacf5" />

Click the "Print 4x6 Return Label" button

<img width="50%" alt="Return-Pop-Up" src="https://github.com/user-attachments/assets/3ddb75ac-3ddc-49ba-bbfa-11fab5881836" />

Window opens and launches the print dialog automatically

## Privacy

This extension collects, stores, and transmits nothing. It reads the label
and slip already displayed on the Amazon page you're viewing and builds
the printable pages entirely inside your browser. See
[`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md) for the full policy.

## Permissions

The extension requests no special Chrome permissions. Its content script
runs only on `amazon.com` (and all location based TLDs .au, .fr, .de, etc...) pages, 
solely to detect the label and slip already visible there.

## Development

This is a plain Manifest V3 extension — no build step, no dependencies.

```
├── manifest.json
├── content.js       # all the logic: detects the label/slip, builds the print pages
├── icons/            # 16/32/48/128px extension icons
└── PRIVACY_POLICY.md
```

To run it locally from source:

1. Clone this repo.
2. Go to `chrome://extensions`, turn on **Developer mode**.
3. Click **Load unpacked** and select the cloned folder.
4. Visit an Amazon return-instructions page and try the button.

### Notes on how it works

- The shipping label image is same-origin (amazon.com), but a second
  network request to its endpoint has proven unreliable — so instead of
  re-fetching it, `content.js` copies the already-loaded `<img>` onto an
  offscreen `<canvas>` and reads it back as a data URL.
- The Return Authorization Slip barcode is hosted on S3 with a
  short-lived signed URL. It's referenced directly rather than fetched,
  since Amazon's page CSP can block a script-initiated `fetch()` to that
  host even though the same URL loads fine as a plain `<img>`.
- If the label ever prints upside-down, flip the `90deg` in the
  `#page1 img { transform: rotate(...) }` rule to `-90deg`.
- To support other Amazon regions, add their domain to the `matches`
  array in `manifest.json` (e.g. `"*://*.amazon.co.uk/*"`).

## Contributing

Issues and pull requests are welcome. Since Amazon can change its page
markup at any time, the most useful bug reports include a snippet of the
current HTML around the label/barcode images.

## License

MIT — see [LICENSE](LICENSE).
