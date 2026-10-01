const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');
let src = fs.readFileSync(serverPath, 'utf8');
const lines = src.split('\n');

let startLine = -1;
let endLine = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Mistral OCR: Extract prescription text from image')) {
    startLine = i;
  }
  // End marker: closing brace of function, found after start,
  // where next non-empty line is the IPFS helper
  if (startLine !== -1 && i > startLine + 5 && lines[i].trim() === '}') {
    // Look ahead to find next non-empty line
    let nextNonEmpty = i + 1;
    while (nextNonEmpty < lines.length && lines[nextNonEmpty].trim() === '') nextNonEmpty++;
    if (lines[nextNonEmpty] && lines[nextNonEmpty].includes('IPFS Upload Helper')) {
      endLine = i;
      break;
    }
  }
}

if (startLine === -1 || endLine === -1) {
  console.error('Could not locate function. startLine=' + startLine + ' endLine=' + endLine);
  // Debug: show lines around position 248
  for (let i = 248; i < 325; i++) {
    console.log(i + ': ' + JSON.stringify(lines[i]));
  }
  process.exit(1);
}

console.log('Found function: lines ' + (startLine+1) + ' to ' + (endLine+1));

const newFunction = [
  '// \u2500\u2500\u2500 Mistral OCR: Extract prescription text from image \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
  '// Flow: base64 \u2192 Buffer \u2192 Blob (in-memory) \u2192 Mistral upload \u2192 signed URL \u2192 OCR',
  '// FIX: Mistral SDK requires a Blob/File \u2014 NOT a ReadStream or file path.',
  'async function extractTextFromImage(base64Data, mimeType) {',
  '  const key = getMistralKey();',
  '  if (!key) {',
  '    console.warn("[Mistral OCR] No MISTRAL_API_KEY configured \u2014 skipping OCR.");',
  '    return { text: null, error: "No MISTRAL_API_KEY configured" };',
  '  }',
  '',
  '  const safeType = mimeType || "image/jpeg";',
  '  const ext = safeType.split("/")[1]?.split("+")[0] || "jpg";',
  '',
  '  try {',
  '    // 1. Decode base64 \u2192 Buffer \u2192 Blob (what Mistral SDK actually accepts)',
  '    const imgBuffer = Buffer.from(base64Data, "base64");',
  '    const imgBlob = new Blob([imgBuffer], { type: safeType });',
  '',
  '    // 2. Upload the Blob to Mistral Files API (purpose = "ocr")',
  '    const client = new Mistral({ apiKey: key });',
  '    console.log(',
  '      `[Mistral OCR] Uploading image (${(imgBlob.size / 1024).toFixed(1)} KB, type=${safeType}) to Mistral\u2026`,',
  '    );',
  '    const uploadedFile = await client.files.upload({',
  '      file: {',
  '        fileName: `prescription.${ext}`,',
  '        content: imgBlob,',
  '      },',
  '      purpose: "ocr",',
  '    });',
  '',
  '    // 3. Get a short-lived signed URL for the uploaded file',
  '    console.log(',
  '      `[Mistral OCR] File uploaded (id=${uploadedFile.id}). Getting signed URL\u2026`,',
  '    );',
  '    const signedUrl = await client.files.getSignedUrl({',
  '      fileId: uploadedFile.id,',
  '    });',
  '',
  '    // 4. Run OCR using mistral-ocr-latest',
  '    console.log("[Mistral OCR] Running OCR with mistral-ocr-latest\u2026");',
  '    const ocrResponse = await client.ocr.process({',
  '      model: "mistral-ocr-latest",',
  '      document: {',
  '        type: "image_url",',
  '        imageUrl: signedUrl.url,',
  '      },',
  '    });',
  '',
  '    // 5. Concatenate all page markdown into one string',
  '    const text = ocrResponse.pages',
  '      .map((page) => page.markdown)',
  '      .join("\\n\\n")',
  '      .trim();',
  '',
  '    console.log(',
  '      `[Mistral OCR] OCR completed \u2014 ${text.length} characters extracted across ${ocrResponse.pages.length} page(s)`,',
  '    );',
  '',
  '    // 6. Delete the remote file to keep usage clean (non-blocking)',
  '    client.files.delete({ fileId: uploadedFile.id }).catch(() => {});',
  '',
  '    return { text: text || null, error: null };',
  '  } catch (err) {',
  '    console.error("[Mistral OCR] OCR failed:", err.message);',
  '    return { text: null, error: err.message };',
  '  }',
  '}',
].join('\n');

const before = lines.slice(0, startLine);
const after = lines.slice(endLine + 1);
const result = [...before, newFunction, ...after].join('\n');

fs.writeFileSync(serverPath, result, 'utf8');
console.log('PATCHED OK');

// Verify
const verify = fs.readFileSync(serverPath, 'utf8');
console.log('Has Blob fix:', verify.includes('new Blob([imgBuffer]'));
console.log('ReadStream removed:', !verify.includes('createReadStream'));
console.log('Temp file write removed:', !verify.includes('writeFileSync(tmpPath'));
