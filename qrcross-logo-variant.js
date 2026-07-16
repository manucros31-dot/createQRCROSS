/**
 * QRCROSS — Logo overlay
 * ------------------------------------------------------------------
 * Dessine un logo "finder pattern" (carré noir/blanc concentrique +
 * coche blanche épaisse) par-dessus un QR code déjà rendu sur un
 * <canvas>. Le logo est un OVERLAY : il est peint après coup, il ne
 * modifie jamais les modules du QR lui-même.
 *
 * IMPORTANT : le QR doit être généré avec correctLevel = H (~30% de
 * correction d'erreur) pour rester lisible malgré le logo. Voir
 * forceHighErrorCorrection() ci-dessous.
 *
 * Usage basique :
 *   drawQRCrossLogo(canvas);                    // options par défaut
 *   drawQRCrossLogo(canvas, { ratio: 0.20 });    // logo plus grand
 *
 * Le style suit les proportions d'un vrai "finder pattern" QR
 * (anneaux 7 / 5 / 3 modules) : anneau noir extérieur, anneau blanc
 * intermédiaire, carré noir central — avec une coche blanche à la
 * place du point central plein.
 */

function forceHighErrorCorrection(qrcodeCorrectLevelEnum) {
  // Utilitaire : retourne toujours le niveau H, quel que soit ce que
  // l'utilisateur a sélectionné dans l'UI. Le logo occupe ~18-20% de
  // la surface du QR ; seul le niveau H (tolérance ~30%) garantit
  // que le code reste décodable après overlay.
  return qrcodeCorrectLevelEnum.H;
}

function drawQRCrossLogo(canvas, options = {}) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  const opts = Object.assign({
    ratio: 0.19,          // taille du logo / largeur du QR (recommandé 0.18 - 0.20)
    position: 'bottom-right',
    quietZone: 0.10,      // marge blanche autour du logo, relative à sa taille
    edgeMargin: 0.015,    // marge entre le logo et le bord du QR, relative à la largeur du QR
    colorOuter: '#469E74',  // vert QRCROSS (issu du logo bouclier)
    colorRing: '#ffffff',
    colorCenter: '#469E74', // vert QRCROSS (issu du logo bouclier)
    colorCheck: '#ffffff',
    cornerRadius: 0,      // 0 = carré net (fidèle aux finder patterns du QR)
  }, options);

  const logoSize = Math.round(Math.min(w, h) * opts.ratio);
  const quiet = Math.round(logoSize * opts.quietZone);
  const footprint = logoSize + quiet * 2;

  const px = positionX(opts.position, w, footprint, Math.round(w * opts.edgeMargin));
  const py = positionY(opts.position, h, footprint, Math.round(h * opts.edgeMargin));

  // 1. Zone blanche ("quiet zone") — isole le logo du motif du QR,
  //    exactement comme la marge blanche qui entoure chaque finder pattern.
  drawSquare(ctx, px, py, footprint, footprint, '#ffffff', opts.cornerRadius);

  const x0 = px + quiet;
  const y0 = py + quiet;

  // 2. Anneau noir extérieur — proportions finder pattern (7 modules / 7)
  drawSquare(ctx, x0, y0, logoSize, logoSize, opts.colorOuter, opts.cornerRadius);

  // 3. Anneau blanc intermédiaire — bordure interne (5 modules / 7)
  const ring = logoSize * (5 / 7);
  const ringOffset = (logoSize - ring) / 2;
  drawSquare(ctx, x0 + ringOffset, y0 + ringOffset, ring, ring, opts.colorRing, opts.cornerRadius * 0.7);

  // 4. Carré noir central — fond de la coche (3 modules / 7)
  const center = logoSize * (3 / 7);
  const centerOffset = (logoSize - center) / 2;
  drawSquare(ctx, x0 + centerOffset, y0 + centerOffset, center, center, opts.colorCenter, opts.cornerRadius * 0.4);

  // 5. Coche blanche épaisse, centrée sur le carré noir
  drawCheckmark(ctx, x0 + centerOffset, y0 + centerOffset, center, opts.colorCheck);

  return { x: px, y: py, size: footprint };
}

function positionX(position, canvasW, footprint, margin) {
  if (position === 'bottom-left' || position === 'top-left') return margin;
  return canvasW - footprint - margin; // bottom-right / top-right (défaut)
}

function positionY(position, canvasH, footprint, margin) {
  if (position === 'top-left' || position === 'top-right') return margin;
  return canvasH - footprint - margin; // bottom-right / bottom-left (défaut)
}

function drawSquare(ctx, x, y, w, h, color, radius = 0) {
  ctx.fillStyle = color;
  if (!radius) {
    ctx.fillRect(x, y, w, h);
    return;
  }
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function drawCheckmark(ctx, x, y, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.16;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + size * 0.22, y + size * 0.52);
  ctx.lineTo(x + size * 0.42, y + size * 0.72);
  ctx.lineTo(x + size * 0.80, y + size * 0.28);
  ctx.stroke();
  ctx.restore();
}

// Support Node.js (tests) et navigateur (script classique)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { drawQRCrossLogo, forceHighErrorCorrection, applyQRCrossLogoSafely };
}

/**
 * applyQRCrossLogoSafely
 * ------------------------------------------------------------------
 * Dessine le logo QRCROSS puis VÉRIFIE réellement, par décodage
 * (jsQR), que le QR reste scannable. Si ce n'est pas le cas, la
 * taille du logo est réduite progressivement jusqu'à ce que le QR
 * redevienne lisible (ou jusqu'à une taille minimale de sécurité).
 *
 * Pourquoi : le seuil de lisibilité dépend de la longueur du texte
 * encodé (donc de la version/densité du QR généré), pas seulement de
 * la taille du logo. Un ratio fixe de 18-20% est fiable pour des URLs
 * courtes mais peut casser silencieusement le QR pour des textes plus
 * longs. Ce test empirique a été vérifié avec Node + jsQR avant
 * d'écrire cette fonction.
 *
 * Nécessite jsQR chargé globalement (window.jsQR), ou passé en 3e
 * argument pour les tests Node.
 *
 * @returns {{ success: boolean, ratio: number }}
 */
function applyQRCrossLogoSafely(canvas, expectedText, options = {}) {
  const jsQRFn = options.jsQR || (typeof jsQR !== 'undefined' ? jsQR : (typeof window !== 'undefined' ? window.jsQR : null));
  if (!jsQRFn) {
    throw new Error('jsQR est requis pour applyQRCrossLogoSafely (chargez-le via CDN avant ce script).');
  }

  const opts = Object.assign({
    startRatio: 0.19,
    minRatio: 0.10,
    step: 0.01,
  }, options);

  const ctx = canvas.getContext('2d');
  const pristine = ctx.getImageData(0, 0, canvas.width, canvas.height); // QR propre, sans logo

  let ratio = opts.startRatio;
  while (ratio >= opts.minRatio - 1e-9) {
    ctx.putImageData(pristine, 0, 0); // reset avant chaque essai
    drawQRCrossLogo(canvas, Object.assign({}, options, { ratio }));

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const decoded = jsQRFn(imageData.data, canvas.width, canvas.height);

    if (decoded && decoded.data === expectedText) {
      return { success: true, ratio: Math.round(ratio * 100) / 100 };
    }
    ratio -= opts.step;
  }

  // Même à la taille minimale, la lecture n'est pas garantie : on
  // applique quand même le minimum (meilleur compromis visuel) et on
  // prévient l'appelant pour qu'il puisse avertir l'utilisateur.
  ctx.putImageData(pristine, 0, 0);
  drawQRCrossLogo(canvas, Object.assign({}, options, { ratio: opts.minRatio }));
  return { success: false, ratio: opts.minRatio };
}
