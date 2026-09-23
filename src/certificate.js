import { drawCertificate, CERT_W, CERT_H } from '../shared/certificate.js';

function load(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

// Draw the certificate in the browser. Returns a PNG blob and an object URL for it.
export async function makeCertificate(data) {
  const [cutout, medallion] = await Promise.all([load(`/cutouts/${data.char}.png`), load('/brand/medallion-384.png')]);
  if (document.fonts) {
    await Promise.all(
      ['700 60px "Libre Caslon Text"', '400 52px "Libre Caslon Text"', '600 36px "IBM Plex Mono"', '400 15px "IBM Plex Mono"', '400 24px "Source Serif 4"', 'italic 22px "Source Serif 4"'].map(
        (f) => document.fonts.load(f).catch(() => {}),
      ),
    );
  }
  const c = document.createElement('canvas');
  c.width = CERT_W;
  c.height = CERT_H;
  drawCertificate(c.getContext('2d'), data, { cutout, medallion });
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return { blob, url: URL.createObjectURL(blob) };
}
