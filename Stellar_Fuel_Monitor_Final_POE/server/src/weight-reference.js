const clean = v => String(v || '').toUpperCase().replace(/\s+/g, ' ').trim();

function axleCount(asset) {
  const text = clean(asset?.axleConfiguration);
  if (/\b3\b|3 AXLE|3 SINGLE/.test(text)) return 3;
  if (/\b2\b|2 AXLE|2 DOUBLE/.test(text)) return 2;
  if (/\b1\b|1 X AXLE/.test(text)) return 1;
  return null;
}

export function estimateAssetTare(asset) {
  if (!asset) return { tareKg: null, source: 'No asset master record', confidence: 'none', isEstimate: true };
  const text = clean(`${asset.assetType || ''} ${asset.description || ''} ${asset.vehicleGroup || ''}`);
  const axles = axleCount(asset);

  if (asset.isTrailer === true) {
    let tareKg = null;
    let rule = '';
    if (text.includes('FLAT BED')) {
      tareKg = axles === 2 ? 6000 : 7000;
      rule = `${axles || 3}-axle flat-bed fleet estimate`;
    } else if (text.includes('EMULSION')) {
      tareKg = axles === 2 ? 7000 : 8300;
      rule = `${axles || 3}-axle emulsion tanker fleet estimate`;
    } else if (text.includes('SOLUTION')) {
      tareKg = axles === 2 ? 6900 : 8100;
      rule = `${axles || 3}-axle solution tanker fleet estimate`;
    } else if (text.includes('PRILL') || text.includes('SILO') || text.includes('TANKER')) {
      tareKg = axles === 2 ? 6800 : 8000;
      rule = `${axles || 3}-axle prill/silo tanker fleet estimate`;
    } else if (text.includes('BOX BODY')) {
      tareKg = 8000;
      rule = 'box-body trailer fleet estimate';
    } else if (axles === 3) {
      tareKg = 7800;
      rule = 'generic 3-axle trailer fleet estimate';
    } else if (axles === 2) {
      tareKg = 6500;
      rule = 'generic 2-axle trailer fleet estimate';
    } else if (axles === 1) {
      tareKg = 4200;
      rule = 'generic 1-axle trailer fleet estimate';
    } else {
      tareKg = 7200;
      rule = 'generic heavy-trailer fleet estimate';
    }
    return { tareKg, source: rule, confidence: text ? 'estimated' : 'low', isEstimate: true };
  }

  let tareKg = null;
  let rule = '';
  if (text.includes('IVECO 480') || text.includes('STRALIS') || text.includes('S-WAY')) {
    tareKg = 9200; rule = 'Iveco 6x4 tractor fleet estimate';
  } else if (text.includes('FAW')) {
    tareKg = 9300; rule = 'FAW 6x4 tractor fleet estimate';
  } else if (text.includes('INTERNATIONAL') || text.includes('9800') || text.includes('ISX') || text.includes('N-14')) {
    tareKg = 9000; rule = 'International heavy tractor fleet estimate';
  } else if (text.includes('ACTROS') || text.includes('MERC')) {
    tareKg = 9200; rule = 'Mercedes-Benz heavy tractor fleet estimate';
  } else if (text.includes('DAEWOO')) {
    tareKg = 9000; rule = 'Daewoo heavy tractor fleet estimate';
  } else if (text.includes('SITRAK') || text.includes('SHACMAN')) {
    tareKg = 9400; rule = 'Sitrak/Shacman heavy tractor fleet estimate';
  } else if (text.includes('SCANIA') || text.includes('VOLVO') || text.includes('DAF') || text.includes('MAN TGS')) {
    tareKg = 9100; rule = 'European heavy tractor fleet estimate';
  } else if (text.includes('BAKKIE') || text.includes('RANGER')) {
    tareKg = 2300; rule = 'light-vehicle fleet estimate';
  } else if (text.includes('ISUZU') || text.includes('HINO') || text.includes('EUROCARGO')) {
    tareKg = 6500; rule = 'medium rigid-truck fleet estimate';
  } else {
    const ax = clean(asset.axleConfiguration);
    if (ax.includes('6 X 4') || ax.includes('6X4')) { tareKg = 9200; rule = 'generic 6x4 tractor fleet estimate'; }
    else if (ax.includes('4 X 2') || ax.includes('4X2')) { tareKg = 7600; rule = 'generic 4x2 tractor fleet estimate'; }
    else { tareKg = 9000; rule = 'generic heavy-truck fleet estimate'; }
  }
  return { tareKg, source: rule, confidence: text ? 'estimated' : 'low', isEstimate: true };
}

export function trailerReferencePayloadKg(asset, permits = []) {
  const valid = (permits || [])
    .map(p => Number(p?.permissibleWeightKgParsed))
    .filter(v => Number.isFinite(v) && v >= 5000 && v <= 50000);
  if (valid.length) {
    // Use the largest sensible permit payload as the trailer's route-load reference.
    return { payloadKg: Math.max(...valid), source: 'largest sensible permit payload', confidence: 'medium' };
  }
  const text = clean(`${asset?.assetType || ''} ${asset?.description || ''}`);
  if (text.includes('FLAT BED')) return { payloadKg: 28000, source: 'flat-bed default reference payload', confidence: 'estimated' };
  if (text.includes('TANKER') || text.includes('PRILL') || text.includes('EMULSION') || text.includes('SOLUTION') || text.includes('SILO')) return { payloadKg: 30000, source: 'tanker default reference payload', confidence: 'estimated' };
  return { payloadKg: 30000, source: 'generic heavy-trailer reference payload', confidence: 'estimated' };
}
