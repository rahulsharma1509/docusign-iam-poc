function escapePdfText(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function textLine(text, x, y, size = 12) {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET\n`;
}

export function createSamplePdfBase64({ signerName = 'Sample Signer', dealName = 'Pilot Agreement' } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const content = [
    textLine('DocuSign Integration POC Agreement', 72, 730, 18),
    textLine(`Deal: ${dealName}`, 72, 690),
    textLine(`Signer: ${signerName}`, 72, 670),
    textLine(`Generated: ${today}`, 72, 650),
    textLine('This sample PDF includes anchor tags for the DocuSign tabs.', 72, 610),
    textLine('Signature:', 72, 540),
    textLine('/sn1/', 150, 540),
    textLine('Date:', 72, 500),
    textLine('/date1/', 150, 500)
  ].join('');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}endstream`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, 'utf8');
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8').toString('base64');
}
