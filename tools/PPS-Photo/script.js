

// Main Logic
const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const previewImage = document.getElementById('previewImage');
const previewPlaceholder = document.getElementById('previewPlaceholder');
const generateBtn = document.getElementById('generateBtn');
const clearBtn = document.getElementById('clearBtn');
const resultImage = document.getElementById('resultImage');
const resultPlaceholder = document.getElementById('resultPlaceholder');
const loadingSpinner = document.getElementById('loadingSpinner');
const statusMessage = document.getElementById('statusMessage');
const downloadBtn = document.getElementById('downloadBtn');


// Customization controls
const bgColorPicker = document.getElementById('bgColorPicker');
const bgColorInput = document.getElementById('bgColorInput');
const suitColorSelect = document.getElementById('suitColor');
const customSuitColor = document.getElementById('customSuitColor');
const tieColorSelect = document.getElementById('tieColor');
const customTieColor = document.getElementById('customTieColor');

let selectedFile = null;
let generatedImageUrl = null;
let uploadedBase64 = null; // New fallback variable

// Sync background color picker and input
bgColorPicker.addEventListener('change', (e) => {
    bgColorInput.value = e.target.value;
    localStorage.setItem('bgColor', e.target.value);
});

bgColorInput.addEventListener('change', (e) => {
    bgColorPicker.value = e.target.value;
    localStorage.setItem('bgColor', e.target.value);
});

// Handle suit color selection
suitColorSelect.addEventListener('change', (e) => {
    customSuitColor.style.display = e.target.value === 'custom suit' ? 'block' : 'none';
});

customSuitColor.addEventListener('change', (e) => {
    // No storage
});

// Handle tie color selection
tieColorSelect.addEventListener('change', (e) => {
    customTieColor.style.display = e.target.value === 'custom tie' ? 'block' : 'none';
});

customTieColor.addEventListener('change', (e) => {
    // No storage
});

// Upload box click handler
if (uploadBox) {
    uploadBox.addEventListener('click', () => fileInput.click());
}

// File input change handler
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileSelect(file);
        }
    });
}

// Drag and drop handlers
if (uploadBox) {
    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.classList.add('active');
    });

    uploadBox.addEventListener('dragleave', () => {
        uploadBox.classList.remove('active');
    });

    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('active');
        const file = e.dataTransfer.files[0];
        if (file) {
            fileInput.files = e.dataTransfer.files;
            handleFileSelect(file);
        }
    });
}

function handleFileSelect(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showMessage('Please select a valid image file', 'error');
        return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
        showMessage('File size must be less than 10MB', 'error');
        return;
    }

    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        uploadedBase64 = e.target.result; // Store for fallback
        previewImage.src = e.target.result;
        previewImage.classList.add('show');
        previewPlaceholder.classList.add('hidden');
        generateBtn.disabled = false;
        showMessage(`Selected: ${file.name}`, 'info');
    };
    reader.readAsDataURL(file);
}

if (generateBtn) generateBtn.addEventListener('click', generatePassportPhoto);
if (clearBtn) clearBtn.addEventListener('click', clearAll);
if (downloadBtn) downloadBtn.addEventListener('click', downloadImage);

// ── Smart Pre-Crop ─────────────────────────────────────────────────────────
// Before sending to AI, crop the image to head+shoulders (top-center 3:4 crop).
// This ensures the AI receives a passport-framed input even when the original
// is a wide shot, so it always outputs properly aligned results.
function smartCropForPassport(file) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const srcW = img.naturalWidth;
            const srcH = img.naturalHeight;

            // Passport ratio: 35mm wide x 45mm tall = ~0.778 (width/height)
            const passportRatio = 35 / 45;

            // Strategy: take the top 80% of the image (head area), centered horizontally
            let cropH = Math.round(srcH * 0.80);
            let cropW = Math.round(cropH * passportRatio);

            // If crop width exceeds image width, constrain by width
            if (cropW > srcW) {
                cropW = srcW;
                cropH = Math.round(cropW / passportRatio);
            }

            // Center horizontally; start from the very top
            const cropX = Math.round((srcW - cropW) / 2);
            const cropY = 0;

            // Output at 600x770 (standard high-res passport dimensions)
            canvas.width = 600;
            canvas.height = 770;

            ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, 600, 770);

            resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        img.onerror = () => resolve(null); // fallback: return null on error
        img.src = URL.createObjectURL(file);
    });
}

// ── Brightness Normalization ────────────────────────────────────────────────
// Analyzes the image brightness and applies a canvas filter to reduce extreme
// highlights/shadows before sending to AI. This helps the AI see a more
// balanced image and apply better retouching.
function normalizeBrightness(source) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.naturalWidth || 600;
            canvas.height = img.naturalHeight || 770;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Sample brightness from a center region of the image
            const sampleW = Math.min(canvas.width, 200);
            const sampleH = Math.min(canvas.height, 200);
            const sampleX = Math.floor((canvas.width - sampleW) / 2);
            const sampleY = Math.floor((canvas.height - sampleH) / 4); // upper-center (face area)

            const data = ctx.getImageData(sampleX, sampleY, sampleW, sampleH).data;
            let totalBrightness = 0;
            const pixelCount = data.length / 4;
            for (let i = 0; i < data.length; i += 4) {
                // Perceived brightness formula
                totalBrightness += (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
            }
            const avgBrightness = totalBrightness / pixelCount; // 0-255

            // If brightness is normal (100-170), no adjustment needed
            if (avgBrightness >= 90 && avgBrightness <= 175) {
                resolve(canvas.toDataURL('image/jpeg', 0.95));
                return;
            }

            // Apply CSS filter correction to normalize extreme lighting
            let brightnessFilter = 1.0;
            let contrastFilter = 1.0;

            if (avgBrightness > 175) {
                // Too bright (overexposed) — darken slightly
                brightnessFilter = 0.85;
                contrastFilter = 1.1;
            } else if (avgBrightness < 90) {
                // Too dark (underexposed) — brighten slightly
                brightnessFilter = 1.25;
                contrastFilter = 1.1;
            }

            // Apply correction using a second canvas with filter
            const correctedCanvas = document.createElement('canvas');
            correctedCanvas.width = canvas.width;
            correctedCanvas.height = canvas.height;
            const correctedCtx = correctedCanvas.getContext('2d');
            correctedCtx.filter = `brightness(${brightnessFilter}) contrast(${contrastFilter})`;
            correctedCtx.drawImage(canvas, 0, 0);

            resolve(correctedCanvas.toDataURL('image/jpeg', 0.95));
        };
        img.onerror = () => resolve(null);

        // Source can be a File object or a base64 string
        if (typeof source === 'string') {
            img.src = source;
        } else {
            img.src = URL.createObjectURL(source);
        }
    });
}


async function generatePassportPhoto() {
    if (!selectedFile) {
        showMessage('Please select an image first', 'error');
        return;
    }

    generateBtn.disabled = true;
    loadingSpinner.classList.add('show');
    resultImage.classList.remove('show');
    downloadBtn.classList.remove('show');
    showMessage('Analyzing and cropping photo...', 'info');

    try {
        // Step 1: Pre-crop to passport framing before sending to AI
        showMessage('Pre-cropping to passport frame...', 'info');
        const croppedBase64 = await smartCropForPassport(selectedFile);

        // Step 2: Apply canvas brightness normalization to fix extreme lighting
        const normalizedBase64 = await normalizeBrightness(croppedBase64 || selectedFile);

        // Step 3: Use normalized+cropped version, fallback chain
        const base64Image = normalizedBase64 || croppedBase64 || await fileToBase64(selectedFile);
        showMessage('Processing with AI...', 'info');

        // Get customization values
        const bgColor = bgColorInput.value;
        const suitSelection = suitColorSelect.value;
        const tieSelection = tieColorSelect.value;

        // Build outfit instructions based on selections
        const keepOriginalOutfit = suitSelection === 'keep original';

        let outfitInstructions = '';
        if (keepOriginalOutfit && tieSelection === 'no tie') {
            // Use "reproduce" language — this forces the AI to fully regenerate
            // the image (like it does when changing suit) rather than doing a
            // minimal edit that skips cropping and retouching.
            outfitInstructions = `CLOTHING & OUTFIT:
- REPRODUCE the person wearing the EXACT SAME clothes visible in the photo.
- Match every detail: fabric color, clothing type, jacket/shirt style, collar.
- The goal is an identical outfit — regenerated in high quality and sharpness.
- Do NOT change or modify the clothing color, type, or style.`;

        } else if (keepOriginalOutfit && tieSelection !== 'no tie') {
            let tieInstruction = tieSelection === 'custom tie'
                ? `a professional tie in color ${customTieColor.value}`
                : `a professional ${tieSelection}`;
            outfitInstructions = `CLOTHING & OUTFIT:
- REPRODUCE the person wearing the EXACT SAME clothes visible in the photo.
- Match every detail: fabric color, clothing type, jacket/shirt style, collar.
- Additionally, add ${tieInstruction} to the outfit.`;

        } else {
            let suitColor = suitSelection === 'custom suit'
                ? `professional suit in color ${customSuitColor.value}`
                : `professional ${suitSelection}`;
            let tieColor = tieSelection === 'no tie'
                ? 'without a tie'
                : tieSelection === 'custom tie'
                    ? `with a professional tie in color ${customTieColor.value}`
                    : `with a professional ${tieSelection}`;
            outfitInstructions = `CLOTHING & OUTFIT:
- REPLACE the person's clothing with a ${suitColor} ${tieColor}.
- The new outfit must look natural, well-fitted, and professional.
- Ensure collar and shirt are visible under the jacket.`;
        }

        const bgDescription = bgColor === '#ffffff'
            ? 'Replace background with a clean, plain white (#ffffff) studio background'
            : `Replace background with a solid flat color ${bgColor} — no gradients, no shadows, no objects`;

        // --- PROFESSIONAL PASSPORT PHOTO PROMPT ---
        // IMPORTANT: Face retouching is listed FIRST because AI models weight
        // earlier instructions more heavily. This ensures retouching always
        // happens regardless of what other changes are requested.

        const promptParts = [];

        promptParts.push("CRITICAL PRIORITY #1 — FACE RETOUCHING (MUST DO FIRST, NO EXCEPTIONS):");
        promptParts.push("This is the most important task. Before doing anything else, fully retouch the face:");
        promptParts.push("- DETECT AND FIX uneven lighting on the face: if one side is darker, lighter, or has shadow from sunlight or a lamp, equalize it to studio-quality even lighting.");
        promptParts.push("- Remove ALL shadows from the face — side shadows, under-chin shadows, forehead shadows.");
        promptParts.push("- Remove ALL acne, pimples, blemishes, dark spots, scars, and skin imperfections from the face and neck.");
        promptParts.push("- Remove under-eye dark circles and redness.");
        promptParts.push("- Smooth skin texture naturally — realistic, not plastic.");
        promptParts.push("- Brighten and even out skin tone across the entire face and neck.");
        promptParts.push("- Sharpen the face, eyes, and hair for crisp high-resolution output.");
        promptParts.push("- Keep beard, eyebrows, moustache, and all facial hair exactly as they are.");
        promptParts.push("");

        promptParts.push("CRITICAL PRIORITY #2 — LIGHTING CORRECTION:");
        promptParts.push("- Replace any harsh, uneven, or directional lighting with flat, even studio lighting.");
        promptParts.push("- If sunlight or a lamp is hitting one side of the face, REMOVE that directional light and replace with uniform frontal lighting.");
        promptParts.push("- No shadows should remain on the face, neck, or background.");
        promptParts.push("- Lighting should look like a professional studio passport photo taken with a ring light.");
        promptParts.push("");

        promptParts.push("PRIORITY #3 — IDENTITY (DO NOT CHANGE THESE):");
        promptParts.push("- This MUST be the same person. Keep face shape, bone structure, and all facial features identical.");
        promptParts.push("- Do NOT change eye shape, nose, lips, ears, or facial proportions.");
        promptParts.push("- Do NOT make the person look like a different individual.");
        promptParts.push("");

        promptParts.push("PRIORITY #4 — FRAMING & ALIGNMENT:");
        promptParts.push("- The image has already been pre-cropped to passport framing.");
        promptParts.push("- Center the face horizontally. Top of head near top edge with small margin.");
        promptParts.push("- Face (chin to top of head) should occupy 70-80% of frame height.");
        promptParts.push("- Straighten any slight head tilt. Person must face directly forward.");
        promptParts.push("");

        promptParts.push("PRIORITY #5 — BACKGROUND:");
        promptParts.push(bgDescription + ".");
        promptParts.push("- Clean, completely flat background. No objects, no shadows, no gradients.");
        promptParts.push("");

        promptParts.push("PRIORITY #6 — OUTFIT:");
        promptParts.push(outfitInstructions);
        promptParts.push("");

        promptParts.push("FINAL OUTPUT:");
        promptParts.push("- Single high-resolution professional studio passport photo.");
        promptParts.push("- No text, borders, watermarks, or extra elements.");
        promptParts.push("- Face must look visibly retouched: clear skin, even lighting, sharp eyes.");

        const extraPrompt = document.getElementById('extraPrompt').value.trim();
        if (extraPrompt) {
            promptParts.push("");
            promptParts.push("ADDITIONAL USER INSTRUCTIONS (apply strictly):");
            promptParts.push(extraPrompt);
        }

        const prompt = promptParts.join("\n");

        const editStrength = 0.92;  // High: forces aggressive face retouch & lighting fix

        // --- CREDIT CHECK ---
        const hasCredit = await checkAndDeductCredit(false); // Check only
        if (!hasCredit) {
            showMessage('Insufficient Credits. Please contact admin.', 'error');
            generateBtn.disabled = true; // Keep disabled
            loadingSpinner.classList.remove('show');
            return;
        }

        // FAL AI API Key (Fetch from Database)
        let FAL_KEY;
        try {
            FAL_KEY = await getUserApiKey();
        } catch (error) {
            alert(error.message);
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Photo';
            return;
        }

        // Debug: Log the prompt to verify it's being built
        // console.log("GENERATED PROMPT:", prompt);

        // Call FAL AI Direct
        const response = await fetch('https://fal.run/fal-ai/nano-banana/edit', {
            method: 'POST',
            headers: {
                'Authorization': `Key ${FAL_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: prompt,
                image_url: base64Image,
                image_urls: [base64Image],
                num_images: 1,
                output_format: 'png',
                strength: editStrength,
                guidance_scale: 12,            // Max adherence — ensures retouching instructions are followed
                safety_checker_version: "v1"
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API Error: ${response.status}`);
        }

        const result = await response.json();

        // Handle response from nano-banana/edit model
        if (result.images && result.images.length > 0) {

            // --- DEDUCT CREDIT NOW ---
            await checkAndDeductCredit(true); // Deduct

            generatedImageUrl = result.images[0].url;
            resultImage.src = result.images[0].url;
            resultImage.classList.add('show');
            resultPlaceholder.classList.add('hidden');
            downloadBtn.classList.add('show');
            showMessage('Photo generated successfully!', 'success');
        } else {
            throw new Error('No images returned from API');
        }

    } catch (error) {
        console.error('Error:', error);
        showMessage(`Error: ${error.message}`, 'error');
    } finally {
        generateBtn.disabled = false;
        loadingSpinner.classList.remove('show');
        // Re-check to update UI
        checkAndDeductCredit(false);
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function clearAll() {
    selectedFile = null;
    generatedImageUrl = null;
    fileInput.value = '';
    previewImage.src = '';
    previewImage.classList.remove('show');
    previewPlaceholder.classList.remove('hidden');
    resultImage.src = '';
    resultImage.classList.remove('show');
    resultPlaceholder.classList.remove('hidden');
    downloadBtn.classList.remove('show');
    generateBtn.disabled = true;
    statusMessage.innerHTML = '';
    statusMessage.classList.remove('show');

    // Reset customization
    bgColorPicker.value = '#ffffff';
    bgColorInput.value = '#ffffff';
    suitColorSelect.value = 'keep original';
    tieColorSelect.value = 'no tie';
    customSuitColor.style.display = 'none';
    customTieColor.style.display = 'none';
}

function downloadImage() {
    if (!generatedImageUrl) {
        showMessage('Please generate a photo first', 'error');
        return;
    }

    showMessage('Downloading image...', 'info');

    // Fetch the image as a blob and download it
    fetch(generatedImageUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to download image');
            }
            return response.blob();
        })
        .then(blob => {
            // Create blob URL
            const blobUrl = window.URL.createObjectURL(blob);

            // Create and trigger download
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `passport-photo-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();

            // Cleanup
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
            }, 100);

            showMessage('Image downloaded successfully!', 'success');
        })
        .catch(error => {
            console.error('Download error:', error);
            showMessage('Error downloading image. Please try again.', 'error');
        });
}

function showMessage(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message show ${type}`;
}

// Load customization preferences
const savedBgColor = localStorage.getItem('bgColor');
if (savedBgColor) {
    bgColorPicker.value = savedBgColor;
    bgColorInput.value = savedBgColor;
}

// Default Suit/Tie to 'keep original' (No storage loading)
suitColorSelect.value = 'keep original';
customSuitColor.style.display = 'none';

tieColorSelect.value = 'no tie';
customTieColor.style.display = 'none';

// Page Navigation
const generatorPage = document.querySelector('.page:first-of-type') || document.querySelector('[style*="display: block"]');
const printPage = document.getElementById('printPage');
const nextPageBtn = document.getElementById('nextPageBtn');
const backBtn = document.getElementById('backBtn');
const a4Container = document.getElementById('a4Container');
const layoutSelect = document.getElementById('layoutSelect');

// Show generator page by default
if (generatorPage) {
    generatorPage.classList.add('active');
}

if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
        // Failsafe: Ensure uploadedBase64 is populated from preview if missing
        if (!uploadedBase64 && previewImage && previewImage.src && previewImage.src.length > 100) {
            uploadedBase64 = previewImage.src;
        }

        // Check if we have any image to print (generated or uploaded)
        if (!generatedImageUrl && !uploadedBase64) {
            showMessage('Please select an image first', 'error');
            return;
        } else if (!generatedImageUrl && uploadedBase64) {
            // Silent fallback to uploaded image
            console.log('Using uploaded image as fallback');
        }

        // Hide generator page, show print page
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => page.classList.remove('active'));

        // Show first page as inactive, then print page as active
        printPage.classList.add('active');

        // Generate initial layout
        generatePrintLayout();
    });
}

if (backBtn) {
    backBtn.addEventListener('click', () => {
        printPage.classList.remove('active');
        const pages = document.querySelectorAll('.page');
        pages.forEach((page, index) => {
            if (index === 0) page.classList.add('active');
        });
    });
}

if (layoutSelect) layoutSelect.addEventListener('change', generatePrintLayout);

// --- NEW FUNCTIONS FOR ENHANCED PRINT PAGE ---

let currentPadding = 0; // mm
let currentGap = 3.5; // mm

function generatePrintLayout() {
    const layout = document.getElementById('layoutSelect').value;
    const [cols, rows] = layout.split('x').map(Number);

    // Adjust photo Width based on layout to fit A4 (210mm)

    let photoWidth = 38; // Default standard size
    let pagePadding = 2; // Default page padding in mm

    if (cols === 2) {
        photoWidth = 50;
        currentGap = 15;
    } else if (cols === 5) {
        // 5x1 Fix
        currentGap = 3.5; // Evenly spaced
        currentPadding = 1.5; // Symmetrical vertical spacing
        pagePadding = 2; // Narrow page padding
        photoWidth = 38;
    } else {
        // 4x1 standard
        currentGap = 10;
        currentPadding = 0;
        pagePadding = 2;
    }

    // Apply Page Padding
    if (a4Container) a4Container.style.padding = `${pagePadding}mm`;

    // Re-render
    a4Container.innerHTML = '';

    // Robust Image Source Fallback
    // Prioritize Generated > Uploaded > Preview DOM
    let imgSrc = generatedImageUrl || uploadedBase64;

    if (!imgSrc && previewImage && previewImage.src && previewImage.src.length > 100) {
        imgSrc = previewImage.src;
    }

    if (!imgSrc) {
        console.warn('No image source available for print layout');
    }

    for (let r = 0; r < rows; r++) {
        addRow(cols, photoWidth, imgSrc);
    }

    applyLayoutStyles();
}

function addRow(cols, w, imgSrc) {
    const row = document.createElement('div');
    row.className = 'a4-row';

    for (let c = 0; c < cols; c++) {
        const photoDiv = document.createElement('div');
        photoDiv.className = 'a4-photo';
        // Enforce STRICT sizing and prevent shrinking
        photoDiv.style.width = w + 'mm';
        photoDiv.style.minWidth = w + 'mm';
        photoDiv.style.flexShrink = '0'; // Prevent squishing

        // Aspect ratio 38:48
        const h = w * (48 / 38);
        photoDiv.style.height = h + 'mm';
        photoDiv.style.minHeight = h + 'mm';

        if (imgSrc) {
            const img = document.createElement('img');
            img.src = imgSrc;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.display = 'block';
            photoDiv.appendChild(img);
        } else {
            photoDiv.innerHTML = '<span style="font-size:10px; color:#ccc;">No Img</span>';
        }

        row.appendChild(photoDiv);
    }
    a4Container.appendChild(row);
}

function duplicateRow() {
    if (a4Container.children.length > 0) {
        const lastRow = a4Container.lastElementChild;
        const newRow = lastRow.cloneNode(true);
        a4Container.appendChild(newRow);
    }
}

function removeRow() {
    if (a4Container.children.length > 0) {
        a4Container.lastElementChild.remove();
    }
}

// Window functions for HTML onclick attributes, made global
window.duplicateRow = duplicateRow;
window.removeRow = removeRow;
window.generatePrintLayout = generatePrintLayout;

function adjustLayout(type, val) {
    if (type === 'padding') {
        currentPadding += val;
        if (currentPadding < 0) currentPadding = 0;
    } else if (type === 'gap') {
        currentGap += val;
        if (currentGap < 0) currentGap = 0;
    }
    applyLayoutStyles();
}
window.adjustLayout = adjustLayout;

function applyLayoutStyles() {
    // Apply Gap (Horizontal) to rows
    const rows = document.querySelectorAll('.a4-row');
    rows.forEach(r => {
        r.style.gap = currentGap + 'mm';
    });

    // Remove inner padding from photos (or reset to 0)
    const photos = document.querySelectorAll('.a4-photo');
    photos.forEach(p => {
        p.style.padding = '0mm';
    });
}

// Mobile Fit Logic
function fitToScreen() {
    const page = document.querySelector('.print-sheet');
    if (!page) return;

    const pageWidth = 794; // A4 px approx
    const windowWidth = window.innerWidth;

    if (windowWidth < pageWidth) {
        const scale = (windowWidth - 20) / pageWidth;
        page.style.transform = `scale(${scale})`;
        page.style.transformOrigin = 'top center';
        page.style.marginBottom = '-50%'; // HACK to reduce whitespace
    } else {
        page.style.transform = '';
        page.style.marginBottom = '';
    }
}
window.addEventListener('resize', fitToScreen);
// Call fitToScreen when showing print page
const observer = new MutationObserver(() => {
    if (printPage.classList.contains('active')) fitToScreen();
});
if (printPage) observer.observe(printPage, { attributes: true, attributeFilter: ['class'] });

// --- Credit System (Robust + Debugging) ---
async function checkAndDeductCredit(deduct) {
    const user = firebase.auth().currentUser;
    if (!user) return false;

    // console.log("CheckCredit - User:", user.email);

    // Use global 'db' from auth.js
    const userRef = db.collection('users').doc(user.email);
    const doc = await userRef.get();

    if (!doc.exists) {
        // console.log("No user doc found.");
        // Create user doc if missing
        await userRef.set({ credits: 0 }, { merge: true });
        updateCreditUI(0);
        return false;
    }

    const data = doc.data();
    // console.log("Firestore Data:", data);

    // ROBUSTNESS FIX: Handle 'credit' (singular) OR 'credits' (plural)
    // AND handle String comparisons ("1") vs Numbers (1)
    let val = data.credits;
    if (val === undefined) val = data.credit; // check singular

    // Parse Int safely
    const credits = parseInt(val || 0, 10);
    // console.log("Parsed Credits:", credits);

    updateCreditUI(credits);

    if (credits < 1) return false;

    if (deduct) {
        // Determine which field to debit
        const fieldName = (data.credit !== undefined) ? 'credit' : 'credits';
        // console.log("Deducting from field:", fieldName);

        // Firestore increment works on numbers. If it's a string in DB, this might fail or cast.
        // Safer to just set the new value if we know it.
        await userRef.update({
            [fieldName]: credits - 1
        });
        updateCreditUI(credits - 1);
    }

    return true;
}

function updateCreditUI(amount) {
    const el = document.getElementById('creditDisplay');
    if (el) {
        el.innerHTML = `Credits: ${amount}`;
        if (amount === 0) {
            el.style.color = '#ff4444'; // Red for empty
        } else {
            el.style.color = '#2ecc71'; // Green for credit
        }
    }
}

// Initialize Credit Watcher on Load
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        checkAndDeductCredit(false);
        // Real-time listener
        db.collection('users').doc(user.email).onSnapshot(doc => {
            const data = doc.data();

            // Handle both fields in listener too
            let val = data?.credits;
            if (val === undefined) val = data?.credit;

            const credits = parseInt(val || 0, 10);
            // console.log("Realtime Update:", credits);

            updateCreditUI(credits);
            if (credits < 1) {
                if (generateBtn) generateBtn.disabled = true;
            } else {
                if (generateBtn && selectedFile) generateBtn.disabled = false;
            }
        });
    }
});
