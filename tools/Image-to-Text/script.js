
const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const previewSection = document.getElementById('previewSection');
const previewImage = document.getElementById('previewImage');
const convertBtn = document.getElementById('convertBtn');
const clearBtn = document.getElementById('clearBtn');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const resultSection = document.getElementById('resultSection');
const resultText = document.getElementById('resultText');
const copyBtn = document.getElementById('copyBtn');

let selectedFile = null;

// --- Upload Handlers ---

uploadBox.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
    }
});

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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
    }
});

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please upload a valid image file.');
        return;
    }

    selectedFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result;
        uploadBox.style.display = 'none';
        previewSection.style.display = 'flex';
        resultSection.style.display = 'none'; // Hide previous results
        progressContainer.style.display = 'none';

        // Reset Layer
        document.getElementById('textLayer').innerHTML = '';
    };
    reader.readAsDataURL(file);
}

// --- OCR Logic with Overlay ---

convertBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    // Reset UI
    convertBtn.disabled = true;
    progressContainer.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.innerText = 'Initializing Tesseract...';
    resultSection.style.display = 'none';
    resultText.value = '';

    // Clear previous overlay
    const textLayer = document.getElementById('textLayer');
    textLayer.innerHTML = '';

    try {
        const worker = await Tesseract.createWorker({
            logger: m => {
                if (m.status === 'recognizing text') {
                    const pct = Math.round(m.progress * 100);
                    progressFill.style.width = `${pct}%`;
                    progressText.innerText = `Recognizing text... ${pct}%`;
                } else {
                    progressText.innerText = m.status;
                }
            }
        });

        await worker.loadLanguage('eng+ara');
        await worker.initialize('eng+ara');

        progressText.innerText = 'Processing image (English & Arabic)...';

        const result = await worker.recognize(selectedFile);
        const { text, words } = result.data;

        await worker.terminate();

        // Show Result
        resultText.value = text;
        resultSection.style.display = 'block';
        progressContainer.style.display = 'none';

        // --- RENDER OVERLAY (Enhanced Selection) ---
        // Calculate scale ratio (Displayed Image / Natural Image)
        const naturalWidth = previewImage.naturalWidth;
        const naturalHeight = previewImage.naturalHeight;

        // Wait for latest dimensions (to ensure display metrics are fresh)
        // requestAnimationFrame(() => {
        const displayWidth = previewImage.width;
        const displayHeight = previewImage.height;

        const scaleX = displayWidth / naturalWidth;
        const scaleY = displayHeight / naturalHeight;

        // Helper canvas to measure text width
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        words.forEach(word => {
            const { text, bbox } = word;
            if (!text || text.trim() === '') return;

            const span = document.createElement('span');
            span.classList.add('overlay-word');
            span.innerText = text + ' '; // Space for separation

            // Coordinates
            const left = bbox.x0 * scaleX;
            const top = bbox.y0 * scaleY;
            const boxWidth = (bbox.x1 - bbox.x0) * scaleX;
            const boxHeight = (bbox.y1 - bbox.y0) * scaleY;

            // 1. Set Font Size based on height
            const fontSize = boxHeight * 0.85; // Slightly smaller than box to prevent overlap
            span.style.fontSize = `${fontSize}px`;
            span.style.lineHeight = `${boxHeight}px`; // Center vertically

            // 2. Measure Rendered Text Width
            // Use the same font family as CSS (default system fonts)
            ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial`;
            const textMetrics = ctx.measureText(text + ' ');
            const textWidth = textMetrics.width;

            // 3. Calculate Stretch Factor
            let stretchX = 1;
            if (textWidth > 0 && boxWidth > 0) {
                stretchX = boxWidth / textWidth;
            }

            // Limit extreme stretching (e.g. noise)
            if (stretchX > 3) stretchX = 3;
            if (stretchX < 0.5) stretchX = 0.5;

            // Apply Styles
            span.style.left = `${left}px`;
            span.style.top = `${top}px`;
            span.style.width = `${boxWidth}px`; // Force container width
            span.style.height = `${boxHeight}px`;

            // Transform to fit width
            span.style.transform = `scaleX(${stretchX})`;
            // Force transform origin to left to align correctly
            span.style.transformOrigin = 'left center';

            textLayer.appendChild(span);
        });
        // });

    } catch (error) {
        console.error(error);
        alert('Error parsing text: ' + error.message);
        progressContainer.style.display = 'none';
    } finally {
        convertBtn.disabled = false;
    }
});

// --- Controls ---

clearBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    uploadBox.style.display = 'block';
    previewSection.style.display = 'none';
    resultSection.style.display = 'none';
    progressContainer.style.display = 'none';
    document.getElementById('textLayer').innerHTML = '';
});

copyBtn.addEventListener('click', () => {
    resultText.select();
    document.execCommand('copy');

    const originalText = copyBtn.innerHTML;
    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    setTimeout(() => {
        copyBtn.innerHTML = originalText;
    }, 2000);
});
