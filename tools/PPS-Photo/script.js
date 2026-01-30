

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

async function generatePassportPhoto() {
    if (!selectedFile) {
        showMessage('Please select an image first', 'error');
        return;
    }

    // API Key check moved to backend

    generateBtn.disabled = true;
    loadingSpinner.classList.add('show');
    resultImage.classList.remove('show');
    downloadBtn.classList.remove('show');
    showMessage('Processing your photo...', 'info');

    try {
        // Convert image to base64
        const base64Image = await fileToBase64(selectedFile);

        // Get customization values
        const bgColor = bgColorInput.value;
        const suitSelection = suitColorSelect.value;
        const tieSelection = tieColorSelect.value;

        // Build outfit instructions based on selections
        const keepOriginalOutfit = suitSelection === 'keep original';

        let outfitInstructions = '';
        if (keepOriginalOutfit && tieSelection === 'no tie') {
            // Keep everything as is
            outfitInstructions = `CLOTHING & OUTFIT:
- PRESERVE the person's original clothing/outfit. 
- Enhance the clearity of the outfit if it is blurry`;

        } else if (keepOriginalOutfit && tieSelection !== 'no tie') {
            // Keep outfit but add/change tie
            let tieInstruction = '';
            if (tieSelection === 'custom tie') {
                const customColor = customTieColor.value;
                tieInstruction = `add a professional tie in color ${customColor}`;
            } else {
                tieInstruction = `add a professional ${tieSelection}`;
            }
            outfitInstructions = `CLOTHING & OUTFIT:
- PRESERVE the person's original clothing/outfit.
- DO NOT modify shirt, jacket, or other garments design.
- Enhance the clearity of the outfit if it is blurry
- Only ${tieInstruction} if not already wearing one, or update tie color if already present
`;
        } else {
            // Change outfit
            let suitColor = '';
            let tieColor = '';

            if (suitSelection === 'custom suit') {
                const customColor = customSuitColor.value;
                suitColor = `professional suit in color ${customColor}`;
            } else {
                suitColor = `professional ${suitSelection}`;
            }

            if (tieSelection === 'no tie') {
                tieColor = 'without a tie';
            } else if (tieSelection === 'custom tie') {
                const customColor = customTieColor.value;
                tieColor = `with a professional tie in color ${customColor}`;
            } else {
                tieColor = `with a professional ${tieSelection}`;
            }

            outfitInstructions = `CLOTHING & OUTFIT:
- CHANGE the person's outfit to wear a ${suitColor} ${tieColor}
- Replace current clothing with the new professional outfit
- Ensure the new outfit looks natural and professional`;
        }

        const bgDescription = bgColor === '#ffffff' ? 'Replace background with plain white' : `Replace background with solid color ${bgColor}`;

        // NEW SIMPLIFIED PROMPT - Clear and concise for better AI understanding
        const promptParts = [];

        promptParts.push("Create a professional passport photo from this image.");
        promptParts.push("");
        promptParts.push("FACE ENHANCEMENT (PRIMARY FOCUS):");
        promptParts.push("- Carefully examine the face and remove ALL blemishes, spots, acne, and skin imperfect, do not remove beard ions");
        promptParts.push("- Remove dark spots, dark circles, and shadows from the face and neck area");
        promptParts.push("- Clear the face completely - make skin look clean and spotless");
        promptParts.push("- Brighten the entire face evenly - enhance the facial color to look fresh and healthy");
        promptParts.push("- Smooth skin texture naturally while keeping it realistic, not over-processed");
        promptParts.push("- Make the face look clear, radiant, and professional");
        promptParts.push("");
        promptParts.push("Keep the same person and identity exactly. Do not change face shape, facial proportions, or recognizable features.");
        promptParts.push("");
        promptParts.push("Improve overall image clarity and sharpness. Remove blur completely.");
        promptParts.push("");
        promptParts.push("Apply clean, even studio lighting with no harsh shadows on the face.");
        promptParts.push("");
        promptParts.push("Center the f if head and neck not straightace, align it straight, and ensure the person looks directly at the camera.");
        promptParts.push("");
        promptParts.push(bgDescription + ".");
        promptParts.push("");
        promptParts.push(outfitInstructions);

        const extraPrompt = document.getElementById('extraPrompt').value;
        if (extraPrompt) {
            promptParts.push("");
            promptParts.push("IMPORTANT USER REQUEST:");
            promptParts.push("- " + extraPrompt);
            promptParts.push("- Follow this instruction strictly while maintaining other requirements.");
        }

        const prompt = promptParts.join("\n");

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
        console.log("GENERATED PROMPT:", prompt);

        // Call FAL AI Direct
        const response = await fetch('https://fal.run/fal-ai/nano-banana/edit', {
            method: 'POST',
            headers: {
                'Authorization': `Key ${FAL_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: prompt,
                image_url: base64Image, // Try singular image_url for standard compatibility
                image_urls: [base64Image], // Keep plural just in case
                num_images: 1,
                output_format: 'png',
                strength: 0.85, // Allow significant changes (for outfit)
                guidance_scale: 7.5, // Standard adherence to prompt
                safety_checker_version: "v1" // Standard
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API Error: ${response.status}`);
        }

        const result = await response.json();

        // Handle response from nano-banana/edit model
        if (result.images && result.images.length > 0) {
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
