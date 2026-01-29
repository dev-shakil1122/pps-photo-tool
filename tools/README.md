# Tool Developer Guide

This guide explains how to build tools for NLGenerator, specifically focusing on the **"Live Editor"** pattern, Toolbar functionality, and strict A4 Printing logic.

## 1. Tool Architecture

The standard flow for a tool is:
1.  **Input Form** (`input.html`): User enters raw data (names, dates, amounts).
2.  **Live View** (`view.html`): Displays the document on an A4 canvas with a floating toolbar.

## 2. The Floating Toolbar

All tools must have a fixed top toolbar that allows users to tweak the appearance before printing.

### HTML Structure
Place this at the very top of `<body>`. Use FontAwesome icons.

```html
<div class="pdf-toolbar">
    <!-- Font Controls -->
    <button class="action-btn" onclick="adjustAppearance('font', 1)">A+</button>
    <button class="action-btn" onclick="adjustAppearance('font', -1)">A-</button>
    
    <!-- Spacing Controls -->
    <button class="action-btn" onclick="adjustAppearance('padTop', 5)">Top Padding</button>
    
    <!-- Actions -->
    <button class="action-btn btn-icon" onclick="window.print()">
        <i class="fas fa-print"></i>
    </button>
</div>
```

### CSS Styling
The toolbar should be fixed and hidden during print.

```css
.pdf-toolbar {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 60px;
    background: #2c3e50;
    color: white;
    z-index: 1000;
    display: flex; /* ...justify-content center... */
}

/* Hide in Print */
@media print {
    .pdf-toolbar { display: none !important; }
}
```

## 3. Dynamic Appearance Logic

We use **CSS Variables** to control spacing and fonts dynamically without reloading.

### Step 1: Define Roots
In your `<style>` block:
```css
:root {
    --font-size: 12pt;
    --line-height: 1.6;
    --pad-top: 40mm;
}

.content {
    font-size: var(--font-size);
    padding-top: var(--pad-top);
}
```

### Step 2: JS Logic
Add this function to handle button clicks:

```javascript
let currentFontSize = 12;
let currentPadTop = 40;

function adjustAppearance(type, step) {
    if (type === 'font') {
        currentFontSize += step;
        document.documentElement.style.setProperty('--font-size', currentFontSize + 'pt');
    } 
    else if (type === 'padTop') {
        currentPadTop += step;
        document.documentElement.style.setProperty('--pad-top', currentPadTop + 'mm');
    }
}
```

## 4. Perfect A4 Printing

To ensure **Exact A4 Output** and remove browser headers/footers (date, URL), follow these strict rules.

### CSS `@page` Rule
This triggers the browser's "Print Graphics" mode and removes default margins.

```css
@media print {
    @page {
        size: A4;
        margin: 0; /* IMPT: Removes browser headers */
    }

    body {
        padding: 0;
        background: white;
    }

    .page {
        width: 100%;
        height: 297mm; /* Force A4 Height */
        margin: 0;
        box-shadow: none;
        border: none;
        overflow: hidden; /* Prevents 2nd blank page */
    }
}
```

### PDF Generation (html2pdf.js)
If using the "Save as PDF" button, use these settings to match the Print output:

```javascript
/* Requires html2pdf.js library */
function downloadPDF() {
    const element = document.querySelector('.page');
    html2pdf().set({
        margin: 0,
        filename: 'document.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 }, // Higher quality
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(element).save();
}
```

---
*Follow this guide to ensure all tools feel part of the same premium family.*
